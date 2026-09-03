---
layout: default
title: De una alerta 502 a una recuperación verificable
description: Guía de caso de uso para un agente SRE autónomo
---

# De una alerta 502 a una recuperación verificable

## Guía de caso de uso para un agente SRE autónomo

## Contexto

Este caso fue desarrollado para la **AI Agent Hackathon**, en el contexto de
Huawei Cloud, Kostra y OpenCode. El objetivo fue construir una demostración
reproducible donde un agente observa un incidente, reúne evidencia, decide con
límites explícitos, ejecuta una mitigación reversible y verifica el resultado.

El repositorio es [`alonso-porcell/hackaton-huawei`](https://github.com/alonso-porcell/hackaton-huawei).

## Cómo evolucionó la propuesta

La propuesta comenzó con una pregunta práctica: cómo habilitar un stack completo
para una hackatón de agentes sin depender de una instalación frágil en Windows.
Durante el diseño se tomaron estas decisiones:

1. Ejecutar Linux dentro de Docker y acceder mediante un escritorio gráfico noVNC,
   para operar como en un computador y no depender de PowerShell.
2. Mantener `pnpm` para los componentes TypeScript.
3. Usar Kostra Cloud con `glm-5.2`, ya conectado al entorno de OpenCode.
4. Reemplazar Hermes por OpenCode como agente central, por su flexibilidad y
   soporte de agentes, MCP y configuración persistente.
5. Reemplazar Obsidian por Engram como memoria de incidentes verificables.
6. Elegir un caso acotado que pudiera demostrarse de principio a fin: `api502`.
7. Incorporar TDD, pytest, Gherkin, Cucumber.js, Stryker y tareas atómicas sin
   duplicar responsabilidades entre Python y TypeScript.
8. Preparar un traspaso autocontenido para Antigravity cuando el equipo necesitó
   continuar la iteración desde otro entorno.

La conversación de diseño también dejó una decisión importante: la voz sería una
mejora de experiencia, no una dependencia del flujo crítico. Por eso la entrada
textual siempre funciona aunque el micrófono o el navegador no soporten voz.

## El caso de uso

Nginx queda apuntando a `api:8999`, aunque FastAPI sigue escuchando correctamente.
El usuario ve `502 Bad Gateway`, pero la API responde 200 si se consulta de forma
directa:

```text
Usuario → Nginx → 502 Bad Gateway
              ↘ FastAPI directo → 200 OK
```

La respuesta correcta no es reiniciar todo ni modificar el backend. El agente debe
correlacionar:

- estado HTTP del proxy y del backend;
- logs de Nginx con conexión rechazada al puerto incorrecto;
- configuración activa del upstream, sanitizada y con hash.

## Arquitectura implementada

| Capa | Implementación | Responsabilidad |
|---|---|---|
| Inferencia | Kostra Cloud, `glm-5.2` | Comprender evidencia y decidir el siguiente paso |
| Orquestación | OpenCode | Aplicar reglas, seleccionar herramientas y explicar resultados |
| Sistema afectado | Python 3.12, FastAPI | API saludable durante el incidente |
| Gateway | Nginx 1.29 | Simular upstream sano o defectuoso |
| Herramientas | TypeScript, Node 22, pnpm, MCP | Observar, respaldar, validar, recargar y verificar |
| Memoria | Engram, SQLite/FTS5 | Guardar aprendizajes verificados y buscarlos selectivamente |
| Experiencia | Express, HTML/CSS/JS, Web Speech API | Portal, dashboards, chat, dictado y lectura de respuestas |
| Entorno | Docker Compose sobre Linux | Reproducibilidad, red aislada y privilegios mínimos |

El agente no recibe `docker.sock` ni una terminal genérica. El control de Nginx
acepta sólo operaciones cerradas de validación y recarga.

## Flujo operativo

```text
OBSERVE → DIAGNOSE → PLAN → ACT → VERIFY → REPORT
```

`inspect_service` compara proxy y backend. `read_logs` acota, normaliza y deduplica
la evidencia. `inspect_config` entrega el upstream activo sin secretos.

Antes de restaurar, `snapshot_config` crea un respaldo asociado al incidente. La
política implementada en código exige:

```text
80 <= confidence <= 100
backend_status == 200
root_cause == nginx_upstream_mismatch
reversible == true
snapshot pertenece al incidente
```

Después, `restore_config` recupera la configuración sana, `validate_config` ejecuta
`nginx -t`, `reload_proxy` recarga sólo tras una validación exitosa y
`verify_recovery` confirma 200 por Nginx y directamente en FastAPI.

## Dos demostraciones en el portal

El repositorio evolucionó desde el caso API502 hacia una experiencia completa:

- **Caso API502:** diagnóstico y recuperación segura de un gateway.
- **Pipeline OODA de cinco nodos:** observador, analista, contención, resolución y
  verificación, con `incident.json`, `diagnosis.json`, `containment.json`,
  `resolution.json` y `postmortem.md`.

La landing page conecta ambos casos, la memoria Engram y el estado de
OpenCode/Kostra. Cada dashboard muestra evidencia y progreso de ejecución.

## Optimización de tokens

La reducción de contexto es una capacidad visible del producto. El compresor:

- elimina fechas, workers, request IDs e IPs volátiles;
- conserva el puerto del upstream, que es causal;
- agrupa mensajes equivalentes;
- informa líneas originales, patrones únicos y duplicados descartados.

En la validación, 30 líneas repetitivas se representaron como un patrón y 29
duplicados no llegaron al contexto de GLM‑5.2. RTK queda como complemento posible,
no como reemplazo del compresor determinista.

## Problemas encontrados y aprendizajes

| Problema | Solución |
|---|---|
| El stack debía operarse como un computador Linux | Docker con escritorio gráfico noVNC |
| `pnpm` de Windows intentaba reconstruir módulos Linux | Ejecutar instalación y pruebas dentro de los contenedores |
| El chat podía responder sin invocar al modelo | Conectar el bucle de function calling a Kostra |
| Los HTML no eran copiados por TypeScript | Resolver rutas y copiar assets durante el build Docker |
| MCP moderno devolvía 405 en OpenCode 1.18 | Mantener SSE legado y endpoint moderno |
| Un reload podía verificarse demasiado pronto | Añadir una espera acotada y un único reintento |
| Los logs saturaban el contexto | Compactación determinista antes de la inferencia |
| El modelo podía devolver tool calls sin herramientas | Detectar el envelope y aplicar fallback por nodo |
| Era necesario continuar en otro agente de desarrollo | Crear `HANDOFF_ANTIGRAVITY.md` con estado, límites y comandos |

## Metodología de calidad

La implementación siguió tareas pequeñas y TDD en las reglas críticas. pytest cubre
la API Python; las pruebas TypeScript cubren política, sanitización y compresión;
Gherkin/Cucumber.js cubre el recorrido 502 → 200; Stryker evalúa la fortaleza de
las pruebas TypeScript. La recuperación no puede declararse exitosa sin evidencia
posterior.

Resultados registrados:

- pytest: `1 passed`;
- pruebas TypeScript: `14 passed`;
- Cucumber: `1 scenario (1 passed), 8 steps (8 passed)`;
- Stryker: mutation score histórico de `70.30%` global;
- diagnóstico real con Kostra/GLM‑5.2: 95% de confianza;
- recuperación real: snapshot, restore, validación, reload y verificación 200.

## Reproducir el caso

Desde `casos/api502`:

```bash
docker compose up --build --wait
docker compose exec api pytest -q
docker compose exec incident-tools pnpm test
docker compose exec incident-tools pnpm test:acceptance
```

Abrir:

- <http://127.0.0.1:3001/> — portal;
- <http://127.0.0.1:3001/cases/api502> — recuperación;
- <http://127.0.0.1:3001/cases/ir-pipeline> — OODA;
- <http://127.0.0.1:3001/engram/memories> — memoria;
- <http://127.0.0.1:8088/health> — API detrás de Nginx.

La demo puede operar desde el escritorio Linux noVNC. La clave de Kostra se monta
como secreto y nunca se copia al repositorio.

## Colaboradores del repositorio

Estos nombres aparecen como autores en el historial Git:

- **Alonso Porcell** (`alonso-porcell` / `Alonso Porcell`) — coordinación y
  consolidación del repositorio.
- **viniciorm** — investigación, arquitectura y evolución del caso API502.
- **Christopher Schiefelbein** — contribuciones al desarrollo.
- **hugorojasaguayo-1984** — contribuciones al desarrollo.

La atribución se basa en identidades públicas de commits; no se infieren roles que
no estén registrados.

## Conclusión

El valor del caso está en cerrar el ciclo completo: evidencia, hipótesis, límites,
acción reversible, verificación y aprendizaje. OpenCode orquesta, Kostra/GLM‑5.2
infiere, MCP limita las acciones, Docker aísla, Engram conserva memoria y los
dashboards hacen visible el proceso.

La estructura puede extenderse a timeouts, firewalls o degradación de dependencias
sin convertir al agente en una terminal con privilegios ilimitados.
