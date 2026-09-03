# Auditoría IR-Sentinel — Propuesta de Arquitectura y Stack

> **Autor:** Onyx (agente de Christopher)  
> **Fecha:** 3 septiembre 2026  
> **Track:** 2 — Incident Response Agent  
> **Modelo:** GLM-5.2 vía kostra.cloud (MaaS Huawei)  
> **Estado:** Propuesta abierta a discusión del equipo  
> **Versión:** 2 — incorpora crítica interna + validación contra mandamientos

---

## 0. Spec (Como/Quiero/Para)

**Como** equipo de la AI Agentic Hackathon Track 2  
**Quiero** construir un agente autónomo de incident response que investigue, diagnostique, remedie y verifique incidentes de infraestructura  
**Para** demostrar capacidades agénticas (autonomía, tools, anti-alucinación) que Huawei Cloud Chile valore como producto potencial para su stack AOM + MaaS

### Gherkin (happy path)
```gherkin
Feature: IR-Sentinel resuelve incidente api502

  Scenario: Nginx 502 por config drift
    Given Nginx proxy apuntando a puerto 8081 (incorrecto)
    And backend FastAPI saludable en puerto 8080
    When se triggera el incidente (POST /trigger-incident)
    Then el agente recibe la alerta
    And investiga logs, métricas, config y deploys recientes
    And genera hipótesis con evidence_ids
    And identifica config drift (8081 vs 8080)
    And confidence >= 80%
    And pide aprobación (policy gate amarillo)
    When se aprueba
    Then respalda config actual
    And restaura config conocida
    And valida config
    And recarga Nginx
    And verifica 502 → 200
    And genera postmortem sanitizado
```

---

## 1. Producto

**IR-Sentinel** — Un agente autónomo de respuesta a incidentes que recibe una alerta, investiga logs/métricas/config/deploys, formula hipótesis con evidencia, ejecuta una remediación segura y reversible, y verifica la recuperación.

El sistema es **Python standalone**. No depende de ningún framework de agentes externo. Se conecta directo al endpoint `ai.kostra.cloud/v1` (OpenAI-compatible) para usar GLM-5.2 como motor de razonamiento, envuelto en guardias deterministas.

### Filosofía: sistemas deterministas que controlan autonomía del LLM

El LLM no decide libremente. Un orquestador Python (state machine explícito) canaliza cada decisión:

- Cada tool devuelve JSON con `evidence_id` — el LLM no puede afirmar nada sin un evidence_id validado por el sistema
- Si el LLM dice "creo que fue el connection pool" pero no tiene evidence_id, el sistema lo marca como `UNVERIFIED` y exige más tools
- El policy gate es código Python, no un prompt "por favor sé cuidadoso"
- Si el LLM entra en loop (misma tool 3 veces), el sistema lo corta (circuit breaker)
- Si GLM-5.2 cae, el sistema tiene respuestas pre-computadas para el happy path (la demo no muere)

**El dashboard debe mostrar esto en vivo:** `LLM dijo: X → sistema validó: Y → evidence_id: Z`. El jurado VE la guardia determinista en acción.

---

## 2. Caso de uso: api502 (con complejidad real)

Nginx proxy apunta a puerto 8081 (incorrecto). Backend FastAPI escucha en 8080 (saludable). Resultado: `502 Bad Gateway` en `/checkout`.

**Síntomas múltiples que requieren correlación:**
- 502 en `/checkout` (error principal)
- Latencia alta en `/api/users` (síntoma secundario — el backend responde pero lento porque el proxy reintenta)
- Deploy reciente (hace 8 min — config "correctamente" modificada pero con error sutil)
- Config de Nginx muestra `proxy_pass http://127.0.0.1:8081` (vs known-good `8080`)

Individualmente, cada síntoma no indica nada. Juntos, el agente debe **correlacionar** para encontrar root cause. Esto es lo que diferencia un agente LLM de un script bash.

El agente:
1. Recibe alerta (simulando webhook de AOM/CES de Huawei)
2. Investiga: logs (LTS), métricas (Cloud Eye), config de Nginx, deploys recientes, health check directo al backend
3. Genera hipótesis con evidence_ids
4. Identifica causa raíz: config drift en upstream port (8081 vs 8080) correlacionado con deploy reciente
5. Pide aprobación (policy gate amarillo — acción reversible)
6. Backup de config → restaura → valida → reload Nginx
7. Verifica 502→200
8. Genera postmortem sanitizado (sin secrets)

**Por qué api502 y no otro caso:**
- Determinista: el resultado es siempre el mismo, no depende de timing
- Reproducible: `docker compose up` y el incidente está listo
- Visible: el jurado VE el 502 y VE el 200 después
- Realista: config drift en Nginx post-deploy es un incidente real
- **Correlación multi-señal:** el agente demuestra valor real (no es un grep)

---

## 3. Arquitectura: State Machine OODA de 5 nodos

```
Alerta → [Nodo 1: Observer] → [Nodo 2: Diagnostician] → [Nodo 3: Containment] → [Nodo 4: Resolution] → [Nodo 5: Verifier] → Postmortem
                                      ↓
                              (confidence < 80% → pausa, pide humano)
```

### Transiciones explícitas del state machine

| Estado | Trigger de salida | Output | Siguiente estado |
|---|---|---|---|
| `OBSERVE` | `incident.json` escrito en `.ir_state/` | severity, servicios, firma | `DIAGNOSE` |
| `DIAGNOSE` | `diagnosis.json` escrito | root_cause, confidence, evidence_ids | confidence >= 0.8 → `CONTAIN` / < 0.8 → `PAUSE_HUMAN` |
| `PAUSE_HUMAN` | `approval.json` recibido | approved/denied | approved → `CONTAIN` / denied → `ABORT` |
| `CONTAIN` | `containment.json` escrito | backup_path, actions, is_stable | is_stable → `RESOLVE` / !stable → `PAUSE_HUMAN` |
| `RESOLVE` | `resolution.json` escrito | config_validated, reloaded | `VERIFY` |
| `VERIFY` | `postmortem.md` + `closure.json` escritos | 502→200 confirmed | `DONE` |

### Persistencia de estado

Cada nodo escribe su output a `.ir_state/{incident_id}/` como archivo JSON. El siguiente nodo lee de ahí, no de memoria. Si el proceso cae, puede reanudar desde el último estado.

### Manejo de errores por nodo

- Si un nodo falla: retry 1 vez con timeout 30s
- Si falla de nuevo: escribir `error.json` en `.ir_state/` y pausar
- Si GLM-5.2 devuelve 5xx: usar fallback determinista (respuestas pre-computadas para happy path)
- Si GLM-5.2 devuelve 401: abortar con mensaje claro ("MaaS auth falló")

### Nodo 1: Observer (Ingestión y Triaje)
- **Tools:** `read_alerts`, `fetch_metrics_window`, `parse_logs`
- **Input:** Webhook payload (JSON simulando alerta AOM)
- **Output:** `incident.json` — severity, servicios afectados, firma del incidente
- **Temperatura GLM-5.2:** 0.1 (estricto)

### Nodo 2: Diagnostician (Hipótesis Causal)
- **Tools:** `check_health`, `read_logs`, `get_metrics`, `inspect_config`, `query_recent_deploys`, `diff_configs`
- **Input:** `incident.json` del Nodo 1
- **Output:** `diagnosis.json` — causa raíz, confidence score, evidence_ids
- **Gate:** Si confidence < 80% → `human_validation_required: true`
- **Temperatura GLM-5.2:** 0.4 (creativo para asociaciones no obvias)

### Nodo 3: Containment (Respuesta Rápida)
- **Tools:** `backup_config`, `rollback_config`
- **Input:** `diagnosis.json` con confidence >= 80%
- **Output:** `containment.json` — acciones ejecutadas, estado post-mitigación
- **Policy gate:** Solo acciones reversibles. Backup obligatorio antes de cualquier cambio.
- **Temperatura GLM-5.2:** 0.2 (conservador)

### Nodo 4: Resolution (Parcheo)
- **Tools:** `validate_config`, `reload_nginx`
- **Input:** `containment.json` confirmando estabilización
- **Output:** `resolution.json` — config validada, servicio recargado
- **Restricción:** Solo procede si Nodo 3 hizo backup

### Nodo 5: Verifier (Post-Mortem)
- **Tools:** `verify_recovery`, `generate_postmortem`
- **Input:** Todos los JSONs anteriores
- **Output:** `postmortem.md` (sanitizado), `closure.json`
- **Checklist:** 502→200 confirmado, no nuevas alertas, logs sanitizados
- **Temperatura GLM-5.2:** 0.1 (máxima precisión)

---

## 4. Stack técnico

| Componente | Tecnología | Justificación |
|---|---|---|
| Lenguaje | Python 3.14 | Una sola lengua. Menos moving parts. |
| Backend + agente | FastAPI + httpx + uvicorn | Async, ligero, sirve API REST + archivos estáticos |
| LLM | GLM-5.2 vía kostra.cloud | Requisito del hackathon. OpenAI-compatible. |
| Orquestación | Python state machine | Control total. Estados tipados. Transiciones explícitas. |
| Tools | Funciones Python + Pydantic v2 schemas | Validación determinista pre/post call |
| Logging | structlog | Logging estructurado JSON (print no es logging) |
| Frontend | HTML + JS vanilla + SSE (1 archivo <500 líneas) | Sin build step, sin React, sin npm |
| Contenedor | Docker Compose | Nginx + API + agente. `docker compose up` y anda. |
| Tests | pytest + TDD | Happy path E2E obligatorio. Cobertura mínima: state machine + tools. |
| Error handling | Middleware FastAPI + try/except por nodo | Si GLM-5.2 devuelve 500, no crashear |

### Por qué NO usar:

| Descartado | Razón |
|---|---|
| OpenCode como middleware | Python habla directo a kostra.cloud. Menos puntos de fallo. |
| LangGraph / CrewAI / AutoGen | Overhead de framework en 7 horas. State machine Python es suficiente. |
| React / Vite / npm | Build step innecesario. HTML+JS+SSE es suficiente. |
| TypeScript | Arquitectura híbrida duplica lógica. Python hace todo. |
| Engram (MCP) | Nice-to-have. No bloqueante. Si sobra tiempo, se agrega. |
| Voz (Moonshine/Kokoro) | Come 2+ horas. Peso en rúbrica: UX 5%. No justifica. |
| RTK | Overkill para 7 horas. |
| Stryker | No soporta Python. pytest basta. |
| Cucumber.js / Gherkin formal | pytest + docstrings basta como contrato. |

---

## 5. Tools del agente (8 tools, todas Python)

| Tool | Nodo | Riesgo | Función |
|---|---|---|---|
| `check_health` | 1, 2, 5 | Bajo (lectura) | HTTP GET al backend. Devuelve status code + latency. |
| `read_logs` | 1, 2 | Bajo (lectura) | Lee logs de Nginx/API filtrados por ventana temporal. Devuelve líneas + evidence_id. |
| `get_metrics` | 1, 2 | Bajo (lectura) | Devuelve métricas simuladas (error rate, latency, RPS). |
| `inspect_config` | 2 | Bajo (lectura) | Lee config de Nginx. Redacta secrets. Devuelve config. |
| `query_recent_deploys` | 2 | Bajo (lectura) | Lista deploys de las últimas 2h (simulado). Devuelve timestamp + cambios. |
| `diff_configs` | 2 | Bajo (lectura) | Compara config actual vs known-good. Devuelve diff estructurado. |
| `backup_config` | 3 | Bajo (reversible) | Copia config actual a `.backups/` con timestamp. |
| `rollback_config` | 3 | Medio (reversible) | Restaura config desde backup. **Policy gate: amarillo.** |
| `verify_recovery` | 5 | Bajo (lectura) | HTTP GET al proxy. Confirma 200. |

Cada tool:
- Acepta parámetros validados por Pydantic schema
- Devuelve JSON con `evidence_id`, `timestamp`, `source`, `data`
- El orquestador valida el output contra el schema antes de pasarlo al LLM
- Si el output no pasa validación, el sistema le dice al LLM "tu tool call falló porque X"
- **Security:** no secrets en output (redactar `sk-*`, passwords, tokens), no path traversal (validar paths contra allowlist), no command injection (params son strings, no shell)

---

## 6. Policy Gate (autonomía graduada)

```python
GREEN = "auto"      # lectura: logs, métricas, health, config — sin permiso
AMARILLO = "approve" # reversible: rollback, reload — pide aprobación con evidencia
ROJO = "blocked"     # destructivo: bloqueado, solo entrega plan + evidencia
```

El policy gate es código Python. No está en el prompt. El LLM no puede sobrescribirlo.

**En la demo:** botón interactivo en el dashboard. Cris (o el jurado) hace click en "Approve" durante la demo. Muestra human-in-the-loop en vivo.

---

## 7. Anti-alucinación (peso 10% en rúbrica) — priorizado

| # | Estrategia | Prioridad | Tiempo estimado |
|---|---|---|---|
| 1 | **Evidence IDs:** cada conclusión del LLM referencia un evidence_id de una tool call real | OBLIGATORIO | 30 min |
| 2 | **Confidence gate:** si confidence < 80%, pausa y pide humano | OBLIGATORIO | 20 min |
| 3 | **Post-call validation:** output de cada tool se valida contra schema Pydantic antes de pasar al LLM | OBLIGATORIO | 15 min |
| 4 | **Circuit breaker:** si el LLM llama la misma tool 3 veces seguidas, corta | NICE-TO-HAVE | 15 min |
| 5 | **Fallback determinista:** si GLM-5.2 cae, respuestas pre-computadas para happy path | NICE-TO-HAVE | 30 min |
| 6 | **Prompt injection defense:** sanitiza inputs antes del LLM | SKIP (complejo, bajo ROI en 7 hrs) | — |

---

## 8. Frontend (dashboard de demo)

HTML + JS vanilla + SSE. **Un solo archivo `index.html` < 500 líneas.** CSS Grid, JS organizado en funciones. FastAPI sirve el HTML.

**Paneles:**
1. **Alerta incoming** — muestra la alerta que triggered el incidente
2. **Timeline de evidencia** — cada tool call con su evidence_id, timestamp, resultado
3. **Hipótesis** — diagnosis con confidence score y evidence_ids
4. **Policy gate** — verde/amarillo/rojo, botón "Approve" interactivo
5. **Estado del servicio** — 502 (rojo) → 200 (verde) con timestamp
6. **LLM visibilidad** — `LLM dijo: X → sistema validó: Y → evidence_id: Z`
7. **Postmortem** — markdown renderizado al final

**SSE:** FastAPI stream events al frontend en tiempo real. El jurado ve el agente trabajar en vivo.

**El dashboard NO es el producto.** El agente lo es. No perder más de 1 hr acá.

---

## 9. Docker Compose

```yaml
services:
  nginx:        # Proxy con config drift triggerable
  api:          # FastAPI backend (saludable en :8080)
  agent:        # FastAPI + agente (state machine + tool calling)
  dashboard:    # Servido por agent (HTML estático)
```

`docker compose up` → todo levanta. Un endpoint `POST /trigger-incident` activa el config drift en Nginx. El agente detecta y responde.

---

## 10. Posicionamiento para Huawei Cloud Chile

**Narrativa:**

Huawei Cloud tiene:
- ✅ AOM (Application Operations Management) — logs, métricas, traces, alertas, "intelligent insights" básico (RCA suggestions)
- ✅ MaaS (Model as a Service) — GLM-5.2, 1M context
- ❌ **NO tiene un agente autónomo que investigue, decida y actúe** sobre AOM

Azure **anunció** Copilot Observability Agent (preview) para Chile Central. Huawei necesita una respuesta competitiva.

IR-Sentinel es ese agente. Posicionamiento:
- "El SRE copilot nativo Huawei Cloud"
- "Usamos GLM-5.2 vía MaaS — el mismo modelo que Huawei promueve como flagship"
- "Nos integramos nativamente con AOM — no reemplazamos, potenciamos"
- "Producto marketplace-ready para KooGallery"
- vs AWS DevOps Guru: LLM-powered (no solo ML), natural language, agent autonomy
- vs Azure Copilot: Nativo Huawei ecosystem, data sovereignty

**Sectores chilenos donde aplica:**
- Banca/fintech (compliance CMPC/SBIF, audit trail automático)
- Minería (IoT 24/7, SCADA connectivity)
- Retail/e-commerce (CyberDay peak traffic, payment gateway timeouts)
- Telecom (BSS/OSS integration failures)

---

## 11. Scope — REALISTA para 7 hrs

### ORDEN DE EJECUCIÓN (cronológico)

| Hora | Task | Owner | Tiempo |
|---|---|---|---|
| 0:00-0:30 | **SMOKE TEST GLM-5.2 tool calling** — si no funciona, pivot a JSON parse | Cris | 30 min |
| 0:30-1:00 | Repo structure + Docker Compose base + Nginx + API | Alonso | 30 min |
| 1:00-2:00 | State machine 3 nodos (Observe → Diagnose → Act) | Cris | 60 min |
| 1:00-2:00 | Simulación api502 (config drift trigger) | Alonso | 60 min |
| 2:00-3:00 | 8 tools Python + Pydantic schemas | Cris | 60 min |
| 2:00-3:00 | Dashboard HTML base + SSE | Claudio | 60 min |
| 3:00-4:00 | Tool calling integration + policy gate | Cris | 60 min |
| 3:00-4:00 | Timeline de evidencia + policy gate UI | Claudio | 60 min |
| 4:00-5:00 | Evidence IDs + confidence gate + post-call validation | Cris | 60 min |
| 4:00-5:00 | pytest E2E happy path | Vini | 60 min |
| 5:00-6:00 | Integración end-to-end + debug | Todos | 60 min |
| 6:00-6:30 | Nodos 4-5 (Resolution + Verifier) | Cris | 30 min |
| 6:00-6:30 | Postmortem + sanitización | Vini | 30 min |
| 6:30-7:00 | **Code freeze + smoke test + demo dry run** | Todos | 30 min |

### MVP (obligatorio)
- [x] **PRIMERO:** smoke test GLM-5.2 tool calling (plan B: JSON parse)
- [ ] State machine 3 nodos (Observe → Diagnose → Act) — empezar con 3, agregar 2 después
- [ ] 8 tools Python con schemas Pydantic
- [ ] Tool calling a GLM-5.2 vía kostra.cloud (httpx)
- [ ] Simulación api502 (Nginx + FastAPI + config drift + deploy reciente)
- [ ] Policy gate determinista (verde/amarillo/rojo) + botón approve
- [ ] Evidence_ids en cada conclusión
- [ ] Dashboard HTML + SSE (1 archivo <500 líneas)
- [ ] Docker Compose
- [ ] pytest: happy path E2E

### Nice-to-have (si sobra tiempo)
- [ ] Nodos 4-5 (Resolution + Verifier separados de Containment)
- [ ] Circuit breaker
- [ ] Fallback determinista si GLM-5.2 cae
- [ ] Postmortem auto-generado
- [ ] Red/Blue/Auditor (3 hipótesis paralelas)

### Fuera de scope
- Voz, RTK, Engram, Kubernetes real, múltiples incidentes, prompt injection defense, cualquier framework externo

---

## 12. División del equipo (propuesta)

| Persona | Rol | Entregable | Archivos |
|---|---|---|---|
| Cris | Arquitectura + state machine + tool calling | `agent/` núcleo | `agent/*.py` |
| Alonso | Simulación api502 + Nginx + Docker | `simulation/` | `simulation/*`, `docker-compose.yml` |
| Claudio | Frontend dashboard + SSE | `dashboard/` | `dashboard/index.html` |
| Vini | Tests pytest + validación | `tests/` | `tests/*.py` |
| Resto | Docs + demo script + pitch | `docs/`, `demo/` | `docs/*.md` |

**Ownership clara:** cada persona trabaja en sus archivos. Cris escribe `agent/` solo. Merge conflicts minimizados.

---

## 13. Criterios de evaluación y cómo los cubrimos

| Criterio | Peso | Cómo lo cubrimos |
|---|---|---|
| Tareas exitosas/correctas | 50% | api502 determinista con correlación multi-señal. pytest E2E confirma 502→200. |
| Comportamiento y autonomía | 25% | Pipeline completo sin intervención. Confidence gate solo pausa si <80%. |
| Uso de herramientas y orquestación | 15% | 8 tools con evidence_ids visibles. State machine orquesta con transiciones explícitas. |
| Gestión de ambigüedad y fallos | 10% | Confidence gate. Retry logic por nodo. Fallback si tool falla. |
| Fiabilidad y anti-alucinación | 10% | Evidence IDs. Policy gate en código. Post-call validation. Circuit breaker. |
| UX y calidad de demo | 5% | Dashboard SSE en vivo. Timeline de evidencia. Policy gate visible con botón approve. |
| Creatividad | 5% | Deterministic wrapping de LLM. Fallback pre-computado. Huawei AOM+MaaS gap. |

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **GLM-5.2 no soporta tool calling** | MEDIA | **Smoke test PRIMERO.** Plan B: LLM outputea JSON con `{"tool":"X","params":{}}`, Python parsea y ejecuta. |
| GLM-5.2 cae durante la demo | BAJA | Fallback determinista con respuestas pre-computadas |
| Internet del venue inestable | ALTA | Todo local en Docker. Solo kostra.cloud necesita internet. |
| No llega a tiempo | MEDIA | MVP primero (3 nodos + 8 tools + api502 + Docker). Nice-to-haves después. |
| LLM alucina causa raíz | MEDIA | Evidence IDs obligatorios + post-call validation + confidence gate |
| Merge conflicts del equipo | MEDIA | Ownership clara por directorio. Cris escribe agent/ solo. |
| Docker Compose no levanta | MEDIA | Alonso debuggea Docker durante la primera hora. |

---

## 15. Plan B: si GLM-5.2 tool calling no funciona

Si el smoke test (primeros 30 min) muestra que GLM-5.2 no soporta `tools` correctamente:

1. El LLM recibe un prompt con la lista de tools disponibles y sus schemas
2. Outputea JSON: `{"tool": "check_health", "params": {"url": "http://localhost:8080"}}`
3. Python parsea el JSON, valida contra schema, ejecuta la tool
4. El resultado se inyecta en el próximo prompt del LLM
5. Repite hasta que el LLM diga `{"action": "done", "diagnosis": "..."}`

No ideal (más tokens, menos robusto) pero funciona. El state machine y las tools son idénticos.

---

## 16. Decisiones pendientes para el equipo

1. **¿Confirmamos api502 como caso único?** Recomendación: sí, un caso done bien > dos a medias
2. **¿3 nodos o 5?** Recomendación: empezar con 3 (Observe → Diagnose → Act), agregar Resolution + Verifier si sobra tiempo
3. **¿Red/Blue/Auditor en Nodo 2?** Recomendación: NO para MVP. Hipótesis única con evidence. Agregar si sobra tiempo.
4. **¿Engram como memoria?** Recomendación: skip para MVP
5. **¿Validamos porcentajes de rúbrica?** (suma 120% en la imagen) — confirmar con organizadores
6. **¿Quién hace el pitch y la demo?** Recomendación: Cris

---

_Abierto a discusión. Todas las decisiones son reversibles hasta que empecemos a codear._
