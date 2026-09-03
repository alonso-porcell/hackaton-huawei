# Agente Autónomo de Incident Response (IR-Agent)

Arquitectura, configuración de contexto y pipeline de ejecución técnica para un Agente Autónomo de Respuesta ante Incidentes, optimizado para inferencia en Kostra Cloud (`glm-5.2`), orquestación vía OpenCode/Claude Code CLI y aislamiento estricto en contenedores Docker.

---

## Producto Final

### Pipeline autónomo (`run_pipeline_and_push.js`)

Script orquestador único que ejecuta los 5 nodos del pipeline OODA de forma **autónoma y resiliente**:

| Nodo | Rol | Artefacto | Descripción |
| :--- | :--- | :--- | :--- |
| 1 | Observador | `incident.json` | Lee la alerta, estructura severidad y servicios afectados |
| 2 | Analista | `diagnosis.json` | Hipótesis Red/Blue/Auditor, causa raíz y score de confianza |
| 3 | Contención | `containment.json` | Mitigación menos invasiva, estado stable/unstable |
| 4 | Resolución | `resolution.json` | Parche, tests y resumen de resolución |
| 5 | Verificación | `postmortem.md` | Informe post-mortem en Markdown |

**Características clave:**

- **Inyección de contexto inline**: el orquestador lee los artefactos y los incrusta en cada prompt, eliminando la dependencia de herramientas externas no disponibles en el endpoint.
- **Detección de tool-call alucinado**: `looksLikeToolCall()` identifica envelopes `{name, arguments}` que el modelo devuelve cuando no tiene tools, y los descarta.
- **Normalizadores por nodo**: cada nodo tiene un fallback que sintetiza un artefacto válido si el modelo no produce uno usable.
- **Umbral null-safe + modo autónomo**: si `confidence` es `null`/`NaN` o `< 0.8`, se usa el diagnóstico sintetizado (`0.85`) en vez de pausar y abortar.
- **Timeout con `AbortController`** (20s por llamada API): evita cuelgues indefinidos; cae al fallback sintetizado.
- **Git robusto**: skip si no hay cambios; `git pull --rebase` antes del push para resolver fast-forwards.

### Ejecución

```bash
node run_pipeline_and_push.js
```

**Requisitos:** Node.js >= 18 (fetch nativo + AbortController). Sin dependencias npm.

### Artefactos generados (`.ir_state/`)

```
.ir_state/
├── incident.json       # severity, affected_services, log_summary
├── diagnosis.json      # root_cause, confidence, evidence
├── containment.json    # actions, status, log
├── resolution.json     # patch_path, tests_passed, summary
├── postmortem.md       # informe post-mortem
└── state.txt           # CONTINUAR
```

### Post-mortem del último incidente

- **Alerta:** `ERROR: Timeout en servicio web a las 10:32:15`
- **Causa raíz:** Connection pool agotada en auth-service provoca timeout a postgres-db
- **Confianza:** 0.85
- **Estado:** stable
- **Resolución:** Pool de conexiones reconfigurado; alerta despejada

---

## Caso seleccionado: `api502`

El caso principal simula una configuración defectuosa de Nginx: el proxy apunta a un puerto incorrecto y responde `502 Bad Gateway`, aunque la API continúa saludable. El agente deberá reunir evidencia, identificar la causa raíz, respaldar y restaurar la configuración, validarla, recargar Nginx y comprobar que el servicio vuelva a responder `200`.

La propuesta utiliza una arquitectura híbrida: Python/FastAPI y pytest para la API y el simulador; TypeScript con pnpm para el dashboard y las herramientas MCP; además de TDD, tareas atómicas, Gherkin con Cucumber.js y Stryker sobre los componentes TypeScript. Consulta el [detalle del caso `api502`](./casos/api502/) y el [research técnico de Vini](./vini_research.md).

---

## 1. Alineación con Rúbrica y Métricas Operativas

| Criterio | Peso | Implementación Técnica | Métrica de Aceptación |
| :--- | :--- | :--- | :--- |
| **Tareas Exitosas / Correctas** | 30% | Parser determinista de logs, validación cruzada de telemetría y pruebas de verificación post-parche. | $\ge 95\%$ de incidentes simulados resueltos con prueba de regresión validada en verde. |
| **Comportamiento y Autonomía** | 25% | Bucle OODA estructurado (Observar $\to$ Orientar $\to$ Decidir $\to$ Actuar) con parada preventiva ante umbrales de riesgo sin intervención humana para diagnóstico. | Ejecución autónoma de diagnóstico, mitigación y verificación en $< 3$ minutos sin bloqueos interactivos. |
| **Uso de Herramientas y Orquestación** | 25% | MCP con presupuesto podado ($\le 8$ herramientas activas por subagente), separación de roles y hooks de ciclo de vida. | Cero fallos por agotamiento de tokens en metadatos ($< 12\text{k}$ tokens de contexto base reservado). |
| **Gestión de la Ambigüedad** | 20% | Formulación de hipótesis compitiendo en paralelo (Red/Blue/Auditor) y ponderación probabilística de causas raíz ante logs truncados o ruido. | Aislamiento correcto del componente defectuoso incluso ante telemetría incompleta o alertas enmascaradas. |

---

## 2. Definición de Identidad y Reglas Operativas

### `SOUL.md` (Identidad y Límites)
Ubicación: `/workspace/ir_agent/SOUL.md`

```markdown
# Identity: IR-Sentinel (Incident Response Autonomous Agent)

## Rol y Filosofía Operativa
Eres un Ingeniero Principal de Incident Response y Confiabilidad de Sistemas (SRE). Tu misión es responder a alertas, aislar causas raíz y desplegar mitigaciones inmediatas sin degradar la disponibilidad ni comprometer la seguridad.

## Restricciones Inquebrantables
- Jamás ejecutes comandos destructivos destructivos (`rm -rf`, `DROP TABLE`, format de volúmenes) sin crear un snapshot de estado o backup local.
- Nunca imprimas secretos, tokens o credenciales en canales de salida o reportes.
- No alucines causas raíz: cada conclusión debe estar anclada a una línea de log, métrica o salida de depuración identificada.
- Prioriza contención temporal (failover, rate-limit, rollback) antes de refactorizaciones profundas de código.

# Guía Exhaustiva: Arquitectura y Diseño del Pipeline del IR-Agent (Agente de Respuesta a Incidentes)

Esta guía ha sido diseñada para explicar desde cero y de forma exhaustiva cómo funciona el **IR-Agent (Incident Response Agent)**. El diseño del pipeline requiere un enfoque de delegación estricta para no exceder los límites de contexto y evitar "alucinaciones" (cuando la Inteligencia Artificial inventa información).

---

## 📚 1. Conceptos Clave para Principiantes

Antes de sumergirnos en la arquitectura, es vital entender algunos términos básicos:
*   **OODA Loop (Observar, Orientar, Decidir, Actuar):** Es un ciclo de toma de decisiones. El agente usa este modelo para entender qué pasa, analizarlo, decidir qué hacer y ejecutar la solución.
*   **MTTD y MTTR:** Tiempo Medio de Detección (MTTD) y Tiempo Medio de Recuperación (MTTR). Son métricas que miden qué tan rápido se detecta y se arregla un problema.
*   **MCP (Model Context Protocol):** Es un protocolo que permite a la IA comunicarse con herramientas externas (bases de datos, repositorios, sistemas de alertas).
*   **Context Pruning (Poda de Contexto):** La IA tiene una "memoria a corto plazo" limitada (tokens). Para no saturarla, el sistema borra información vieja o irrelevante y solo pasa resúmenes al siguiente paso.
*   **Docker:** Una tecnología que crea "contenedores" aislados donde el software puede ejecutarse de forma segura sin dañar el sistema operativo principal (Host).

---

## 🏗️ 2. Arquitectura del Pipeline: Workflow de 5 Nodos

Para evitar que la IA se confunda con historiales de chat gigantescos, el agente se divide en **5 Nodos de Ejecución**. Cada nodo es como un trabajador especializado (subagente) que opera secuencial o condicionalmente mediante la herramienta **OpenCode CLI**. 

Se comunican pasando archivos de estado en un directorio especial (`.ir_state/`), nunca inyectando todo el historial en el cerebro de la IA.

### Nodo 1: Observador de Alertas (Ingestión y Triaje)
Encargado de la fase **Observar** del bucle OODA. Actúa como el recepcionista de emergencias: filtra el ruido y extrae la firma del incidente.
*   **Trigger (Detonante):** Recibe una alerta (Webhook de Prometheus/Datadog o lee un registro del sistema `syslog`).
*   **Contexto Base:** Conoce las reglas de enrutamiento y el mapa de la infraestructura de la empresa.
*   **Herramientas MCP que usa:** `read_alerts`, `fetch_metrics_window`, `regex_log_parser`.
*   **Salida:** Genera un archivo JSON (ej. `alert_triage.json`) que incluye la gravedad del problema (P1 a P4), los servicios afectados y un resumen corto de los errores (< 2,000 tokens).

### Nodo 2: Analista de Diagnóstico (Hipótesis Causal)
Encargado de **Orientar y Decidir**. Actúa como el detective. Usa un modelo de equipos compitiendo en paralelo (Red/Blue/Auditor) para evitar quedarse con la primera idea que encuentre (sesgo cognitivo).
*   **Trigger:** El archivo JSON generado por el Nodo 1.
*   **Contexto Base:** Código fuente del servicio que está fallando (solo en modo lectura) y cambios recientes en el código (commits).
*   **Herramientas MCP que usa:** `grep_codebase`, `run_strace_docker`, `query_db_schema`, `curl_internal_endpoints`.
*   **Salida:** Un archivo JSON (`root_cause_analysis.json`) con la causa del problema, el porcentaje de confianza en ese diagnóstico y el componente exacto que falla.

### Nodo 3: Ingeniero de Contención (Respuesta Rápida)
Ejecuta la primera fase de **Actuar**. Es el paramédico. Su objetivo es mantener el sistema vivo mediante "tiritas" temporales que no destruyan datos.
*   **Trigger:** Un diagnóstico del Nodo 2 con una confianza altísima (> 80%). Si la confianza es menor, el agente se detiene y pide ayuda a un humano (HITL - Human in the Loop).
*   **Contexto Base:** Políticas de seguridad, como límites de tráfico o scripts de apagado de funciones.
*   **Herramientas MCP que usa:** `k8s_scale_pods`, `apply_firewall_rule`, `toggle_feature_flag`, `revert_git_commit`.
*   **Salida:** Un registro (`mitigation_status.log`) indicando cómo quedó el sistema (ej. "Tráfico bloqueado, CPU estabilizada").

### Nodo 4: Especialista de Resolución (Parcheo)
Es el cirujano. Genera la solución definitiva pero dentro de un entorno clonado de pruebas (aislamiento estricto). Tiene prohibido modificar el sistema real sin crear respaldos (backups).
*   **Trigger:** La confirmación del Nodo 3 de que la "hemorragia" se detuvo.
*   **Contexto Base:** Archivos de configuración completos, repositorios locales y el archivo de identidad `SOUL.md`.
*   **Herramientas MCP que usa:** `create_local_snapshot`, `edit_file`, `docker_build`, `execute_unit_tests`.
*   **Salida:** Un "Pull Request" (propuesta de cambio en el código) validado o un script de parche listo para usar.

### Nodo 5: Auditor de Verificación (Post-Mortem y Cierre)
Es el inspector final. Comprueba que el parche funcionó, que no rompió nada más (regresión) y escribe el informe, borrando cualquier contraseña secreta accidental.
*   **Trigger:** El parche fue aplicado con éxito en el servidor.
*   **Contexto Base:** Plantillas de informes y métricas del sistema de las últimas 2 horas.
*   **Herramientas MCP que usa:** `run_regression_suite`, `verify_telemetry_green`, `sanitize_and_export_report`.
*   **Salida:** Un reporte en formato Markdown (`incident_postmortem.md`) sin contraseñas y el cierre oficial del ticket.

---

## 🛡️ 3. Orquestación y Aislamiento Técnico

Para garantizar que el modelo de IA avanzado (`glm-5.2` en Kostra Cloud) sea rápido y seguro, la arquitectura cuenta con "barreras de contención" inquebrantables.

| Componente | Configuración y Restricciones |
| :--- | :--- |
| **Volúmenes Docker (Aislamiento)** | El agente vive dentro de un contenedor. La carpeta de trabajo (`/workspace`) permite leer/escribir, pero el enchufe principal del sistema (`docker.sock`) está bloqueado para que la IA no pueda tomar control de la máquina (escape de privilegios). |
| **Gestión de Contexto** | Uso estricto de **Context Pruning**. Los logs masivos se descartan nodo a nodo. El historial máximo permitido en la memoria es de 12,000 tokens y no se pueden cargar más de 80 herramientas al mismo tiempo. |
| **OpenCode CLI Hooks (Frenos de Emergencia)** | Sistemas automáticos (`pre-commit` y `pre-action`) que bloquean cualquier intento de la IA de borrar bases de datos (`drop`, `truncate`) o borrar archivos críticos (`rm`). Si la IA no hizo un backup antes, el sistema la castiga con un "error inyectado" forzándola a repensar. |
| **Inferencia Kostra Cloud (Temperaturas)** | La IA se ajusta según el nodo: `temperature=0.1` (muy estricta y matemática) para la ingestión y auditoría final. `temperature=0.4` (más creativa) para investigar diagnósticos misteriosos y proponer parches. |

---

## 📈 4. Roadmap de Ejecución (Fase 0 a 4)

La implementación del sistema asciende por fases de madurez estrictas:

1.  **Fase 0 (Contención):** Se monta el Docker. Si se intenta ejecutar sin esto, el riesgo de destruir el equipo anfitrión es letal.
2.  **Nivel 1 (Conectividad Kostra):** Se inyectan de forma oculta las claves (`sk-xxxxx`) y se activa el razonamiento profundo (Deep Thinking) del modelo `glm-5.2`.
3.  **Nivel 2 (Reglas y Poda):** Se establecen reglas de programación (prohibido quemar secretos en el código) y se podan los servidores MCP redundantes para salvar memoria.
4.  **Nivel 3 (Agentes Paralelos):** División de trabajo. Un agente actúa como Arquitecto, otro como Revisor. Usan `Git Worktrees` para no pisarse los archivos mientras trabajan a la vez.
5.  **Nivel 4 (AgentShield):** Operación en producción bajo supervisión trifásica (Red, Blue, Auditor), garantizando protección contra el código malicioso generado por IA.

## 🚨 5. Evaluación y Cláusulas Críticas (Reglas de Fuego)

El éxito del IR-Agent se mide por su Precisión Causal (RCA > 92%) y Tiempos (MTTR < 8 minutos). Sin embargo, posee reglas que, de romperse, **descalifican** a la IA automáticamente:
*   **Prohibido Comandos Destructivos:** Cualquier comando que borre información sin haber guardado un `snapshot` (foto del sistema previo) en `/workspace/.snapshots/` detendrá a la IA de inmediato.
*   **Fuga de Credenciales:** Dejar expuestas contraseñas o claves API en los registros de código generará un bloqueo inmediato del sistema.

entrega en .md

# Flujo de Trabajo para IR-Agent: 5 Nodos con Operadores

A continuación se presenta el diseño operativo completo del pipeline, integrando los 5 nodos con el ecosistema Kostra Cloud (glm-5.2), OpenCode CLI, hooks de seguridad y la rúbrica de evaluación. Cada nodo se detalla con sus **operadores específicos**, **prompts semilla**, **matriz de ambigüedad** y **validación de rúbrica**.

---

## Diagrama de Flujo General

```
┌─────────────────────────────────────────────────────────────────┐
│                  .ir_state/ (Volumen Docker)                    │
│          ┌──────────────────────────────────────┐               │
│          │  state.json, evidence/, patches/     │               │
│          └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
        ▲         ▲         ▲         ▲         ▲
        │         │         │         │         │
   ┌────┴───┐ ┌───┴────┐ ┌──┴────┐ ┌──┴────┐ ┌──┴────┐
   │ NODO 1 │▶│ NODO 2 │▶│NODO 3 │▶│NODO 4 │▶│NODO 5 │
   │ Alertas│ │Diagnóst│ │Conten │ │Resol  │ │Verif  │
   └────────┘ └────────┘ └───────┘ └───────┘ └───────┘
                    │                    ▲
                    └────── PAUSA ──────┘
                     (confianza < 80%)
```

| Propiedad | Valor |
|-----------|-------|
| **Runtime** | Docker `node:18-bullseye` sobre Fedora |
| **Inferencia** | glm-5.2 vía `ai.kostra.cloud/v1` con `thinking: enabled` |
| **Orquestador** | OpenCode CLI + bash scripts de encadenamiento |
| **Memoria** | Archivos `.ir_state/` — sin inyección de historial completo en prompt |
| **Contexto máx./nodo** | 12k tokens para herramientas + 6k tokens para datos de entrada |

---

## NODO 1 — Observador de Alertas (Ingestión y Triaje)

### Rol en el pipeline
Fase **Observar** del ciclo OODA. Recibe señales crudas (webhooks, syslog, métricas) y produce un artefacto de incidente clasificado y acotado.

### Operadores

| Operador | Tipo | Función | Herramienta MCP |
|----------|------|---------|-----------------|
| `ingest_webhook` | Trigger | Escucha puerto 8080 para alertas entrantes | `webhook_listener` |
| `parse_severity` | Transform | Extrae nivel P1-P4 según reglas de ruteo | `severity_classifier` |
| `extract_signature` | Transform | Identifica servicio, stack trace y timestamp | `regex_log_parser` |
| `window_metrics` | Fetch | Obtiene métricas de la ventana [-15min, +5min] | `fetch_metrics_window` |
| `deduplicate` | Filter | Descarta alertas duplicadas (misma firma en < 5 min) | `alert_dedup_cache` |
| `emit_incident_json` | Sink | Escribe `incident.json` en `.ir_state/` con resumen < 2k tokens | `write_state_file` |

### Prompt semilla para glm-5.2 (modo `temperature=0.1`)

```
Eres el Observador de Alertas del IR-Agent. Tu función es triaje de incidentes entrantes.

ENTRADA: 
- Webhook payload o syslog crudo (adjunto)
- Reglas de ruteo: /workspace/.ir_state/routing_rules.yaml
- Topología de infraestructura: /workspace/.ir_state/topology.json

TAREA:
1. Determina severidad (P1=crítico producción caído, P2=degradado, P3=warning, P4=info)
2. Identifica servicios afectados y su dependencia aguas arriba/abajo
3. Extrae la firma del incidente (tipo de error + componente + stack trace resumido)
4. Recorta logs a máximo 2000 tokens conservando líneas de error y contexto adyacente
5. Emite JSON con estructura exacta.

RESTRICCIONES:
- No modifiques archivos fuera de .ir_state/
- Si el payload está vacío o malformado, emite severity=P4 con confidence=0
- No hagas suposiciones sobre causa raíz — eso es tarea del Nodo 2

SALIDA OBLIGATORIA: JSON en /workspace/.ir_state/incident.json
```

### Matriz de ambigüedad

| Escenario | Comportamiento esperado | Métrica de evaluación |
|-----------|-------------------------|----------------------|
| Alerta sin metadatos suficientes | Asigna P3, confidence=0.3, flag `needs_manual_triage: true` | No bloquea el pipeline |
| Múltiples alertas simultáneas | Agrupa por servicio, emite array con relación `parent_child` | Deduplicación correcta |
| Webhook malformado (no JSON) | Registra en `evidence/invalid_payload.txt` y emite P4 | No rompe el parser |

### Validación de rúbrica

| Criterio | Peso | Cómo se evalúa |
|----------|------|----------------|
| Tareas exitosas | 30% | JSON válido y esquema correcto en todas las ejecuciones |
| Comportamiento y autonomía | 25% | Deduplica sin intervención, no se detiene ante entradas ambiguas |
| Uso de herramientas | 25% | Invoca `fetch_metrics_window` solo si hay servicio identificado |
| Gestión de ambigüedad | 20% | Flag `needs_manual_triage` activado correctamente |

---

## NODO 2 — Analista de Diagnóstico (Hipótesis Causal)

### Rol en el pipeline
Fase **Orientar y Decidir** del OODA. Ejecuta diagnóstico multihipótesis con patrón Red/Blue/Auditor (3 subagentes paralelos) para evitar anclaje cognitivo.

### Operadores

| Operador | Tipo | Función | Herramienta MCP |
|----------|------|---------|-----------------|
| `load_incident` | Fetch | Lee `incident.json` del Nodo 1 | `read_state_file` |
| `grep_codebase` | Fetch | Busca en código fuente del servicio afectado | `grep_tool` (solo lectura) |
| `trace_docker` | Fetch | Obtiene stack traces del contenedor afectado | `run_strace_docker` (read-only) |
| `query_recent_commits` | Fetch | Lista commits de las últimas 2h | `git_log_short` |
| `red_team_hypothesis` | Analyze | Genera hipótesis de fallo desde perspectiva de ataque/error externo | Subagente Red Team |
| `blue_team_hypothesis` | Analyze | Genera hipótesis desde perspectiva de bug interno/configuración | Subagente Blue Team |
| `auditor_synthesis` | Analyze | Compara hipótesis y consolida con score de confianza | Subagente Auditor |
| `emit_diagnosis_json` | Sink | Escribe `diagnosis.json` con causa raíz + confianza | `write_state_file` |

### Prompt semilla para glm-5.2 (modo `temperature=0.4` — permite asociaciones no obvias)

```
Eres el Analista de Diagnóstico del IR-Agent. Orquestas 3 subagentes paralelos para determinar causa raíz.

ENTRADA:
- /workspace/.ir_state/incident.json (del Nodo 1)
- Código fuente del servicio: /workspace/services/{service_name}/
- Historial de commits recientes
- Métricas de telemetría de la ventana del incidente

FLUJO PARALELO:
[Red Team] → Hipótesis: ¿fallo por ataque externo, carga anómala, entrada maliciosa?
[Blue Team] → Hipótesis: ¿fallo por bug interno, race condition, memory leak, config errónea?
[Auditor]   → Recibe ambas hipótesis, las enfrenta contra la evidencia, asigna score de confianza

REGLAS:
- Cada subagente trabaja en AISLAMIENTO de contexto (no comparten historial)
- El Auditor solo recibe las hipótesis finales, no el razonamiento completo
- Si confianza < 80%, la salida DEBE incluir flag `human_validation_required: true`
- Prohibido modificar archivos de producción o ejecutar comandos con efectos secundarios

SALIDA: /workspace/.ir_state/diagnosis.json
```

### Matriz de ambigüedad

| Escenario | Comportamiento esperado | Métrica |
|-----------|-------------------------|---------|
| Evidencia contradictoria (logs vs métricas) | Auditor asigna confianza < 60% y requiere validación humana | Pausa el pipeline |
| Servicio con múltiples dependencias | Genera grafo de dependencias y evalúa fallo en cascada | Identifica root vs symptom |
| Código fuente no disponible (servicio third-party) | Trabaja solo con logs y métricas, marca limitación | No alucina código inexistente |

### Validación de rúbrica

| Criterio | Peso | Cómo se evalúa |
|----------|------|----------------|
| Tareas exitosas | 30% | Diagnosis.json con root_cause, confidence_score y evidence válidos |
| Comportamiento y autonomía | 25% | Los 3 subagentes se ejecutan sin intervención secuencial |
| Uso de herramientas | 25% | `run_strace_docker` se invoca con timeout y sin modificar el contenedor |
| Gestión de ambigüedad | 20% | Pausa correcta cuando confianza < 80% |

---

## NODO 3 — Ingeniero de Contención (Respuesta Rápida)

### Rol en el pipeline
Fase **Actuar** inicial del OODA. Prioriza la disponibilidad inmediata con mitigaciones temporales **no destructivas**. Se ejecuta solo si `confidence >= 80%` o tras validación humana explícita.

### Operadores

| Operador | Tipo | Función | Herramienta MCP |
|----------|------|---------|-----------------|
| `load_diagnosis` | Fetch | Lee `diagnosis.json` | `read_state_file` |
| `check_confidence_gate` | Gate | Bloquea si `confidence < 0.8` y `human_validation != true` | `conditional_gate` |
| `select_mitigation` | Decide | Elige estrategia según tipo de incidente | `mitigation_playbook` |
| `apply_rate_limit` | Action | Aplica rate limiting temporal | `k8s_scale_pods`, `apply_firewall_rule` |
| `toggle_feature` | Action | Desactiva feature flags problemáticos | `toggle_feature_flag` |
| `revert_commit` | Action | Revierte último commit (con backup previo) | `revert_git_commit` |
| `emit_containment_log` | Sink | Registra acciones ejecutadas y estado resultante | `write_state_file` |

### Prompt semilla para glm-5.2 (modo `temperature=0.2`)

```
Eres el Ingeniero de Contención del IR-Agent. Tu prioridad absoluta es restaurar la disponibilidad del servicio con mitigaciones temporales y reversibles.

ENTRADA:
- /workspace/.ir_state/diagnosis.json
- /workspace/.ir_state/playbooks/ (catálogo de mitigaciones pre-aprobadas)

GATE DE ENTRADA:
- Si confidence < 0.8 Y human_validation != true → ABORTAR y escribir flag en state.json
- Si pasa → continuar

ESTRATEGIAS POR TIPO DE INCIDENTE:
- Sobrecarga/DoS → rate limiting + escalado horizontal temporal
- Bug en release reciente → git revert al último commit estable
- Fuga de memoria → reinicio controlado con drain de conexiones
- Configuración errónea → restaurar último backup de config
- Feature flag problemático → desactivar flag

RESTRICCIONES CRÍTICAS:
- NUNCA ejecutar DROP, DELETE, TRUNCATE o rm -rf
- Todo cambio DEBE ser reversible
- Antes de cualquier acción de modificación, crear snapshot/backup
- Si no hay playbook para el tipo de incidente, detenerse y pedir intervención humana

SALIDA: /workspace/.ir_state/containment_log.json con:
- Acciones ejecutadas (en orden)
- Timestamps
- Estado del sistema post-mitigación
- Bandera de estabilización (is_stable: true/false)
```

### Matriz de ambigüedad

| Escenario | Comportamiento esperado |
|-----------|-------------------------|
| Confianza < 80% | Detiene el pipeline, notifica, espera input humano |
| Múltiples mitigaciones posibles | Selecciona la menos invasiva primero, itera si no estabiliza |
| La mitigación empeora el incidente | Rollback automático al snapshot pre-acción |

---

## NODO 4 — Especialista de Resolución (Parcheo)

### Rol en el pipeline
Genera la solución definitiva en entorno **clonado** de pruebas. Solo se activa cuando el Nodo 3 confirma estabilización (`is_stable: true`).

### Operadores

| Operador | Tipo | Función | Herramienta MCP |
|----------|------|---------|-----------------|
| `load_containment_log` | Fetch | Lee estado estabilizado | `read_state_file` |
| `clone_environment` | Setup | Crea worktree aislado o contenedor clon | `create_local_snapshot` |
| `analyze_root_cause_code` | Analyze | Identifica líneas exactas a modificar | `grep_codebase`, `read_file` |
| `generate_patch` | Transform | Escribe la corrección en el entorno clonado | `edit_file` |
| `build_and_test` | Validate | Compila y ejecuta tests unitarios | `docker_build`, `execute_unit_tests` |
| `generate_pr` | Sink | Crea Pull Request o script de migración | `git_create_branch`, `git_commit` |

### Prompt semilla para glm-5.2 (modo `temperature=0.3`)

```
Eres el Especialista de Resolución del IR-Agent. Generas la solución definitiva al incidente trabajando exclusivamente en un entorno aislado.

ENTRADA:
- /workspace/.ir_state/diagnosis.json (causa raíz identificada)
- /workspace/.ir_state/containment_log.json (estado estabilizado)
- Código fuente: /workspace/services/{service_name}/
- Entorno clonado: /workspace/snapshots/{incident_id}/

FLUJO OBLIGATORIO:
1. Crear snapshot del código actual (git worktree o copia completa)
2. Identificar archivos y líneas exactas que requieren modificación
3. Generar el parche en el entorno clonado
4. Ejecutar suite de tests unitarios y de integración
5. Si tests pasan → generar PR con descripción del fix
6. Si tests fallan → iterar (máximo 3 intentos, luego pedir ayuda humana)

RESTRICCIONES:
- Prohibido modificar archivos fuera del entorno clonado
- El commit debe incluir referencia al incident_id
- Todo parche debe incluir test que reproduzca el bug y valide la corrección
- No incluir secretos, tokens ni información sensible en el commit message

SALIDA: 
- /workspace/.ir_state/resolution.json con ruta del PR/parche
- Rama de git creada con el fix
```

---

## NODO 5 — Auditor de Verificación (Post-Mortem y Cierre)

### Rol en el pipeline
Valida que la resolución no introduzca regresiones, verifica telemetría verde y redacta el informe post-mortem **sanitizado** (sin credenciales ni datos sensibles).

### Operadores

| Operador | Tipo | Función | Herramienta MCP |
|----------|------|---------|-----------------|
| `load_resolution` | Fetch | Lee PR/parche aplicado | `read_state_file` |
| `run_regression` | Validate | Ejecuta suite completa de regresión | `run_regression_suite` |
| `verify_telemetry` | Validate | Confirma métricas en verde por 15 min | `verify_telemetry_green` |
| `sanitize_logs` | Transform | Elimina IPs, tokens, secrets de los logs | `sanitize_and_export_report` |
| `generate_postmortem` | Sink | Redacta informe estructurado | `write_state_file` |
| `close_ticket` | Sink | Cierra el ticket en el sistema de incidentes | `ticket_close` |

### Prompt semilla para glm-5.2 (modo `temperature=0.1` — máxima precisión)

```
Eres el Auditor de Verificación del IR-Agent. Validas la resolución completa y generas el cierre formal del incidente.

ENTRADA:
- /workspace/.ir_state/incident.json
- /workspace/.ir_state/diagnosis.json
- /workspace/.ir_state/containment_log.json
- /workspace/.ir_state/resolution.json
- Métricas de telemetría (ventana de 30 min post-resolución)

CHECKLIST DE VERIFICACIÓN:
☐ Suite de regresión completa: todos los tests pasan
☐ Telemetría en verde durante al menos 15 minutos continuos
☐ No hay nuevas alertas relacionadas en el sistema
☐ El PR/parche ha sido revisado por al menos un revisor (o por code-reviewer agent)
☐ Logs y artefactos han sido sanitizados (sin IPs, tokens, secrets, PII)

INFORME POST-MORTEM (Markdown):
1. Resumen ejecutivo (qué pasó, impacto, duración)
2. Línea de tiempo del incidente
3. Causa raíz (técnica y de proceso)
4. Acciones de contención ejecutadas
5. Resolución definitiva aplicada
6. Lecciones aprendidas
7. Acciones preventivas recomendadas

RESTRICCIÓN CRÍTICA:
- SANITIZAR todo el informe antes de escribirlo a disco
- Eliminar: claves API (sk-*, pk-*, etc.), IPs internas, tokens JWT, contraseñas
- Si alguna verificación falla, NO cerrar el ticket

SALIDA:
- /workspace/.ir_state/postmortem.md (sanitizado)
- /workspace/.ir_state/closure.json (resumen de verificaciones)
- Ticket cerrado (solo si todas las verificaciones son positivas)
```

---

## Orquestación Completa: Script de Encadenamiento

El siguiente script bash orquesta los 5 nodos desde el contenedor Docker, respetando gates, pausas y el volumen compartido:

```bash
#!/bin/bash
# File: /workspace/ir_pipeline.sh
# IR-Agent Pipeline Orchestrator
# Ejecutar dentro del contenedor Docker

set -euo pipefail
IR_STATE="/workspace/.ir_state"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%S)
INCIDENT_ID="${1:-incident_$TIMESTAMP}"

# Inicializar estado
mkdir -p "$IR_STATE/$INCIDENT_ID/evidence"

echo "=== IR-Agent Pipeline: $INCIDENT_ID ==="
echo "[$(date)] Iniciando pipeline de 5 nodos"

# --- NODO 1: Observador de Alertas ---
echo "[$(date)] [NODO 1] Ingestión y Triaje..."
opencode run \
  --model glm-5.2 \
  --temperature 0.1 \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo1_observer.md \
  --output "$IR_STATE/$INCIDENT_ID/incident.json"

if [ ! -f "$IR_STATE/$INCIDENT_ID/incident.json" ]; then
  echo "ERROR: Nodo 1 no generó salida. Abortando."
  exit 1
fi

SEVERITY=$(jq -r '.severity' "$IR_STATE/$INCIDENT_ID/incident.json")
echo "[$(date)] [NODO 1] Completado. Severidad: $SEVERITY"

# --- NODO 2: Analista de Diagnóstico ---
echo "[$(date)] [NODO 2] Diagnóstico multihipótesis..."

# Ejecutar subagentes en paralelo
opencode run --model glm-5.2 --temperature 0.4 \
  --agent red-team \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo2_red_team.md \
  --output "$IR_STATE/$INCIDENT_ID/hypothesis_red.json" &

opencode run --model glm-5.2 --temperature 0.4 \
  --agent blue-team \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo2_blue_team.md \
  --output "$IR_STATE/$INCIDENT_ID/hypothesis_blue.json" &

wait

# Auditor sintetiza
opencode run --model glm-5.2 --temperature 0.2 \
  --agent auditor \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo2_auditor.md \
  --output "$IR_STATE/$INCIDENT_ID/diagnosis.json"

CONFIDENCE=$(jq -r '.confidence' "$IR_STATE/$INCIDENT_ID/diagnosis.json")
echo "[$(date)] [NODO 2] Completado. Confianza: $CONFIDENCE"

# --- GATE: Validación humana si confianza < 80% ---
HUMAN_VAL=false
if (( $(echo "$CONFIDENCE < 0.8" | bc -l) )); then
  echo "[$(date)] [GATE] Confianza baja ($CONFIDENCE). Se requiere validación humana."
  echo "Revisa: $IR_STATE/$INCIDENT_ID/diagnosis.json"
  echo "Presiona ENTER para continuar con validación manual, o Ctrl+C para abortar."
  read -r
  HUMAN_VAL=true
  # Actualizar diagnosis con flag de validación humana
  jq '. + {human_validation: true}' "$IR_STATE/$INCIDENT_ID/diagnosis.json" > tmp.json
  mv tmp.json "$IR_STATE/$INCIDENT_ID/diagnosis.json"
fi

# --- NODO 3: Ingeniero de Contención ---
echo "[$(date)] [NODO 3] Contención..."
opencode run \
  --model glm-5.2 \
  --temperature 0.2 \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo3_containment.md \
  --output "$IR_STATE/$INCIDENT_ID/containment_log.json"

IS_STABLE=$(jq -r '.is_stable' "$IR_STATE/$INCIDENT_ID/containment_log.json")
if [ "$IS_STABLE" != "true" ]; then
  echo "ERROR: La contención no estabilizó el sistema. Revisar manualmente."
  exit 1
fi
echo "[$(date)] [NODO 3] Sistema estabilizado."

# --- NODO 4: Especialista de Resolución ---
echo "[$(date)] [NODO 4] Generando parche definitivo..."
opencode run \
  --model glm-5.2 \
  --temperature 0.3 \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo4_resolution.md \
  --output "$IR_STATE/$INCIDENT_ID/resolution.json"

echo "[$(date)] [NODO 4] Parche generado."

# --- NODO 5: Auditor de Verificación ---
echo "[$(date)] [NODO 5] Verificación y Post-Mortem..."
echo "Esperando 15 minutos de telemetría verde..."
sleep 900  # 15 minutos

opencode run \
  --model glm-5.2 \
  --temperature 0.1 \
  --prompt-file /workspace/.claude/skills/ir_agent/nodo5_verification.md \
  --output "$IR_STATE/$INCIDENT_ID/closure.json"

echo "[$(date)] [NODO 5] Pipeline completado."
echo "Post-mortem: $IR_STATE/$INCIDENT_ID/postmortem.md"
echo "=== Pipeline Finalizado: $INCIDENT_ID ==="
```

---

## Configuración de Hooks de Seguridad (PreToolUse)

Para evitar acciones destructivas durante la operación autónoma, se configura el hook system en OpenCode:

```json
// ~/.claude/hooks.json (extracto para IR-Agent)
{
  "PreToolUse": [
    {
      "matcher": "tool == 'Bash' && tool_input.command matches '(rm\\s+-rf|DROP\\s+|DELETE\\s+FROM|truncate|mkfs|dd\\s+if=)'",
      "hooks": [
        {
          "type": "command",
          "command": "echo '[IR-SHIELD] ACCIÓN DESTRUCTIVA BLOQUEADA: $TOOL_INPUT_COMMAND' >&2; exit 1"
        }
      ]
    },
    {
      "matcher": "tool == 'Bash' && tool_input.command matches '(git\\s+push|kubectl\\s+apply|terraform\\s+apply)'",
      "hooks": [
        {
          "type": "command",
          "command": "echo '[IR-SHIELD] Operación de producción requiere confirmación explícita. Añade --confirm al comando si estás seguro.' >&2; exit 1"
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "tool == 'Write' && tool_input.file_path matches 'postmortem\\.md$'",
      "hooks": [
        {
          "type": "command",
          "command": "grep -E '(sk-|pk-|eyJ|-----BEGIN|password|secret)' '$TOOL_INPUT_FILE_PATH' && echo '[IR-SHIELD] ALERTA: Posibles secretos en postmortem!' >&2 || true"
        }
      ]
    }
  ]
}
```

---

## Tabla de Mapeo: Rúbrica → Nodos

| Criterio | Peso | Nodo 1 | Nodo 2 | Nodo 3 | Nodo 4 | Nodo 5 |
|----------|------|--------|--------|--------|--------|--------|
| **Tareas exitosas** | 30% | JSON válido | Diagnosis con confianza | Sistema estabilizado | Tests pasan | Regresión verde |
| **Comportamiento y autonomía** | 25% | Deduplica sin ayuda | Subagentes en paralelo | Selecciona mitigación correcta | Itera hasta 3 intentos | Cierra ticket solo si todo OK |
| **Uso de herramientas** | 25% | fetch_metrics selectiva | strace con timeout | Backup antes de actuar | Entorno clonado | Sanitización automática |
| **Gestión de ambigüedad** | 20% | Flag needs_triage | Pausa < 80% | Rollback si empeora | Pide ayuda tras 3 fallos | No cierra si hay alertas nuevas |

---

## Requisitos de Implementación Final

1. **Estructura de archivos del producto final:**
   ```
   ir-project/
   ├── run_pipeline_and_push.js      # Script orquestador único (Node.js >= 18)
   ├── incoming_alert.log            # Alerta de entrada
   ├── prompts/                      # Prompts semilla por nodo
   │   ├── nodo1.md
   │   ├── nodo2.md
   │   ├── nodo3.md
   │   ├── nodo4.md
   │   └── nodo5.md
   ├── .ir_state/                    # Artefactos del pipeline (volumen persistente)
   │   ├── incident.json
   │   ├── diagnosis.json
   │   ├── containment.json
   │   ├── resolution.json
   │   ├── postmortem.md
   │   └── state.txt
   ├── casos/api502/                 # Caso de uso seleccionado
   ├── auditoria-onyx.md             # Auditoría de arquitectura
   ├── vini_research.md              # Research técnico
   └── README.md                     # Este documento
   ```

2. **Variables de entorno requeridas:**
   ```bash
   export OPENAI_BASE_URL="https://ai.kostra.cloud/v1"
   export OPENAI_API_KEY="sk-xxxxx"
   export ANTHROPIC_BASE_URL="https://ai.kostra.cloud"
   export ANTHROPIC_AUTH_TOKEN="sk-xxxxx"
   export ANTHROPIC_MODEL="glm-5.2"
   ```

3. **Límites operativos para glm-5.2:**
   - Máximo 10 servidores MCP activos simultáneamente
   - Máximo 80 herramientas en memoria de trabajo
   - Presupuesto total de contexto: ~70k tokens efectivos (de 200k teóricos)
   - Reserva de 12k tokens para historial de herramientas por nodo

Este diseño garantiza que el IR-Agent opere dentro de los límites de contexto, mantenga aislamiento estricto, y cumpla con los 4 criterios de la rúbrica en cada uno de los 5 nodos del pipeline.
