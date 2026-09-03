================================================================================
GUION DE PRESENTACION — IR-SENTINEL (AI Agent Hackathon Track 2)
================================================================================

Duracion objetivo: 10 minutos + Q&A
Modelo: GLM-5.2 en Kostra Cloud
Caso: api502 — Nginx mal configurado devuelve 502 con backend saludable

================================================================================
[0:00 - 1:00] ACTO 1 — APERTURA Y CONTEXTO
================================================================================

> "Buenos dias. Presentamos IR-Sentinel, un agente autonomo de respuesta a
> incidentes que opera sobre el bucle OODA — Observar, Orientar, Decidir,
> Actuar — sin intervencion humana."

> "El escenario es realista: un proxy Nginx apunta al puerto equivocado. El
> backend FastAPI sigue saludable, pero el cliente recibe 502 Bad Gateway.
> El agente debe correlacionar evidencia, diagnosticar, respaldar, restaurar,
> validar y verificar — todo de forma autonoma y reversible."

> "La pregunta que respondemos hoy: puede un agente LLM resolver un incidente
> de produccion sin alucinar, sin ejecutar comandos destructivos, y sin
> intervencion humana — y como lo probamos?"

EN PANTALLA: Arquitectura del sistema (diagrama mermaid de docs/architecture.md)
- FastAPI (Python 3.12) en puerto 8000
- Nginx 1.29 gateway en puerto 80
- Incident Tools (Node 22/TS) en puerto 3001 con 10 herramientas MCP
- Kostra GLM-5.2 como cerebro del agente
- Docker con hardening

================================================================================
[1:00 - 2:00] ACTO 2 — ESTADO INICIAL Y ACTIVACION DEL INCIDENTE
================================================================================

> "Partimos de un sistema saludable. Verificamos:"

EN PANTALLA:
  curl http://127.0.0.1:8088/health
  # {"status":"ok","service":"payments-api"}  → 200 OK

> "Ahora inyectamos el incidente: copiamos la configuracion defectuosa
> (server api:8999 en lugar de server api:8000) y recargamos Nginx."

EN PANTALLA:
  curl -X POST http://127.0.0.1:3001/demo/inject
  # {"status":"injected","proxy":"502","backend":"200"}

  curl http://127.0.0.1:8088/health
  # 502 Bad Gateway

  curl http://127.0.0.1:3001/demo/status | jq .service
  # proxy: 502, backend: 200, mismatch: true

> "Notese: el proxy dice 502 pero el backend dice 200. Un agente que solo
> mirara el 502 concluiria que el backend cayo. IR-Sentinel no comete ese
> error porque correlaciona tres fuentes de evidencia antes de concluir."

PUNTO CLAVE PARA JUECES: El mismatch 502 vs 200 es la señal clave. Un agente
naive se equivocaria. IR-Sentinel requiere correlacion multi-senal.

================================================================================
[2:00 - 4:00] ACTO 3 — DIAGNOSTICO AUTONOMO (EL CORAZON DE LA DEMO)
================================================================================

> "Ahora pedimos al agente que diagnostique — sin indicarle que herramientas
> usar. El agente decide solo."

EN PANTALLA:
  curl -X POST http://127.0.0.1:3001/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"message":"investiga el 502 y dime la causa raiz con evidencia"}'

> "El agente ejecuta TRES herramientas en paralelo:"

1. inspect_service
   → proxy: 502, backend: 200, mismatch: true
   → evidence_id: HEALTH-c7a89962

2. read_logs
   → 30 lineas de log de Nginx
   → COMPRIMIDAS A 1 PATRON (29 duplicados descartados)
   → Puerto 8999 preservado como evidencia causal
   → evidence_id: LOG-e25f9272

3. inspect_config
   → active-upstream.conf: server api:8999
   → hash SHA-256: 883672b4...
   → secretos redactados automaticamente
   → evidence_id: CONFIG-f4c3428c

> "Cada herramienta devuelve un evidence_id estable. Toda conclusion debe
> anclararse a un evidence_id — si no, se marca UNVERIFIED."

> "El agente sintetiza: la causa raiz es nginx_upstream_mismatch. El proxy
> apunta al puerto 8999 pero el backend escucha en 8000. Confianza: 95%."

EN PANTALLA: Output completo del agente con tabla de hallazgos, evidence_ids,
y conclusion.

PUNTO CLAVE PARA JUECES:
- El agente NO alucina. La causa raiz esta anclada a 3 fuentes correlacionadas.
- La compresion de logs (30 → 1) demuestra optimizacion de tokens.
- Los evidence_ids son trazables y estables.

================================================================================
[4:00 - 5:30] ACTO 4 — POLITICA DE AUTONOMIA Y RECUPERACION SEGURA
================================================================================

> "El agente tiene confianza 95%. Pero la confianza del LLM NO basta.
> Una politica de autonomia en CODIGO TypeScript — no en prompt — debe
> autorizar la recuperacion."

EN PANTALLA: Mostrar policy.ts

> "canStartRecovery verifica 4 condiciones obligatorias:"

1. confidence entre 80 y 100 (inclusivo)     → 95: OK
2. backendStatus === 200                      → 200: OK
3. rootCause === "nginx_upstream_mismatch"    → confirmado: OK
4. reversible === true                        → snapshot existe: OK

> "Las 4 condiciones se cumplen. La politica autoriza. Ahora ejecutamos
> la recuperacion:"

EN PANTALLA:
  curl -X POST http://127.0.0.1:3001/demo/recover

> "El flujo ejecuta 5 pasos secuenciales con gates de seguridad:"

PASO 1: SNAPSHOT
  → Respaldo de active-upstream.conf antes de tocar nada
  → snapshot_id: snap-{timestamp}

PASO 2: RESTORE
  → Copia healthy-upstream.conf via tmp+rename (operacion atomica)
  → Si el rename falla, el estado original se preserva

PASO 3: VALIDATE
  → nginx -t en canal restringido (file-based IPC, no shell directo)
  → Si falla, SE DETIENE. No se recarga.

PASO 4: RELOAD
  → nginx -s reload SOLO tras validacion exitosa
  → Recarga graceful sin drop de conexiones

PASO 5: VERIFY
  → HTTP 200 dual: proxy + backend
  → Si no 200, reintenta tras 500ms

> "Nginx NUNCA se recarga sin pasar nginx -t.
> La restauracion NUNCA ocurre sin snapshot previo.
> La verificacion NUNCA se declara sin HTTP 200 confirmado."

EN PANTALLA:
  curl http://127.0.0.1:8088/health
  # {"status":"ok","service":"payments-api"}  → 200 OK

================================================================================
[5:30 - 6:30] ACTO 5 — VERIFICACION, EVIDENCIA Y MEMORIA
================================================================================

> "Verificamos que todo quedo en estado saludable:"

EN PANTALLA:
  curl http://127.0.0.1:3001/demo/status | jq
  # proxy: 200, backend: 200, mismatch: false

> "El incidente se registro en Engram — memoria persistente — SOLO tras
> verificacion exitosa:"

EN PANTALLA:
  curl http://127.0.0.1:3001/engram/stats
  # {"total":1,"verified":1,"by_kind":{"incident":1}}

  curl http://127.0.0.1:3001/engram/memories | jq
  # Muestra el registro con kind, root_cause, confidence, verified: true

> "La memoria NO confirma la causa de un incidente futuro. Solo SUGIERE
> hipotesis. search_memory devuelve max 5 resultados con rank — no inyecta
> toda la memoria en el contexto."

> "Si un segundo incidente 502 ocurre, el agente puede buscar en Engram
> y encontrar este precedente — pero lo trata como hipotesis, no como
> verdad confirmada."

PUNTO CLAVE PARA JUECES: Engram es selectivo. No satura el contexto.
Distingue aprendizajes verificados de no verificados.

================================================================================
[6:30 - 8:00] ACTO 6 — PIPELINE AUTONOMO DE 5 NODOS OODA
================================================================================

> "Ademas del agente interactivo, tenemos un pipeline autonomo de 5 nodos
> que ejecuta el bucle OODA completo sin intervencion humana:"

EN PANTALLA: Mostrar run_pipeline_and_push.js y ejecutar:

  node run_pipeline_and_push.js

> "Cada nodo produce un artefacto en .ir_state/:"

NODO 1 — OBSERVADOR (temperature 0.1)
  → Lee la alerta, estructura severidad y servicios
  → Artefacto: incident.json
  → {severity, affected_services, log_summary}

NODO 2 — ANALISTA (temperature 0.4)
  → Hipotesis Red/Blue/Auditor, causa raiz, confianza
  → Artefacto: diagnosis.json
  → {root_cause, confidence, evidence}

  GATE: Si confianza < 0.8 → usa diagnostico sintetizado (modo autonomo)
  El pipeline NUNCA se pausa y aborta. Continua de forma autonoma.

NODO 3 — CONTENCION (temperature 0.2)
  → Mitigacion menos invasiva
  → Artefacto: containment.json
  → {actions, status, log}

NODO 4 — RESOLUCION (temperature 0.3)
  → Parche, tests, resumen
  → Artefacto: resolution.json
  → {patch_path, tests_passed, summary}

NODO 5 — VERIFICACION (temperature 0.1)
  → Informe post-mortem en Markdown
  → Artefacto: postmortem.md

> "Caracteristicas clave del pipeline:"

1. INYECCION DE CONTEXTO INLINE
   → El orquestador lee artefactos y los incrusta en cada prompt
   → Elimina dependencia de tools externas no disponibles

2. DETECCION DE TOOL-CALL ALUCINADO
   → looksLikeToolCall() detecta envelopes {name, arguments}
   → Los descarta y sintetiza un artefacto valido

3. TIMEOUT CON ABORTCONTROLLER (20s por llamada API)
   → Si la API se cae, fallback sintetizado
   → El pipeline NUNCA se cuelga indefinidamente

4. GIT ROBUSTO
   → pull --rebase antes de push
   → Skip si no hay cambios
   → Commit + push autonomo

EN PANTALLA: Mostrar artefactos generados en .ir_state/

================================================================================
[8:00 - 9:00] ACTO 7 — TESTS, CALIDAD Y SEGURIDAD
================================================================================

> "Toda la secuencia esta cubierta por tests ejecutables:"

EN PANTALLA:
  # Aceptacion Gherkin/Cucumber
  npx cucumber-js features/**/*.feature
  # 2 scenarios, 16 steps, ALL GREEN

  # Mutacion Stryker
  npx stryker run
  # 101 mutantes, 65 eliminados, 70.30% global
  # policy.ts: 81.82% mutation score

  # Unitarios TS
  npm test
  # 14 tests passed

  # Unitarios Python
  pytest api/tests/
  # 1 test passed

> "El scenario Gherkin define el contrato end-to-end:
> Dado proxy y backend saludables,
> Cuando se inyecta el error,
> Entonces 502 con backend 200,
> Y tras recuperacion segura:
>   - backup antes de restore
>   - validacion antes de reload
>   - 200 dual al final"

> "Seguridad del contenedor Docker:"

  --security-opt no-new-privileges:true   # Sin escalacion de privilegios
  --cap-drop ALL                          # Sin capabilities Linux
  --read-only                             # Filesystem inmutable
  --tmpfs /tmp /logs /control /engram     # Solo dirs temporales son writable
  Usuario no-root (appuser)
  Puerto 3001 solo en localhost

> "10 herramientas MCP con anotaciones readOnly/destructive explicitas.
> Sin terminal genererica. Sin docker.sock. Privilegio minimo."

> "Hooks PreToolUse bloquean rm -rf, DROP TABLE, truncate, mkfs.
> Hooks PostToolUse escanean secretos en postmortem.md."

================================================================================
[9:00 - 10:00] ACTO 8 — CIERRE Y RESULTADOS
================================================================================

> "Resumen de lo demostrado:"

RESULTADOS CUANTIFICABLES:
  - 502 → 200 verificado end-to-end
  - Confianza del diagnostico: 95%
  - MTTR (Mean Time To Resolution): < 2 minutos
  - 0 secretos expuestos (redactados automaticamente)
  - 0 comandos destructivos sin snapshot
  - 30 lineas de log → 1 patron (29 duplicados descartados)
  - 10 herramientas MCP con privilegio minimo
  - 4 condiciones de policy gate en codigo (no en prompt)
  - 3 suites de tests en verde (Cucumber + Stryker + pytest)
  - Pipeline de 5 nodos completa autonomo sin intervencion

> "Lo que diferencia a IR-Sentinel:"

1. ANTI-ALUCINACION POR DESIGN
   → evidence_ids obligatorios
   → looksLikeToolCall() descarta tool-calls alucinados
   → conclusiones sin evidence_id → UNVERIFIED

2. AUTONOMIA GRADUADA EN CODIGO
   → policy.ts es determinista, el LLM no puede sobrescribirlo
   → 4 condiciones simultaneas para autorizar recuperacion
   → separa herramientas de lectura (siempre permitidas) de escritura (sujetas a policy)

3. CORRELACION MULTI-SENAL
   → 502 aislada NO basta
   → requiere backend 200 + config + logs correlacionados
   → rechaza telemetria incompleta (backend 0)

4. RESILIENCIA TOTAL
   → timeout 20s por llamada API
   → fallback sintetizado en cada nodo
   → modo autonomo: si confianza < 0.8, continua con sintesis
   → git robusto: pull --rebase, skip si sin cambios

> "IR-Sentinel opera dentro de los limites de contexto del modelo, mantiene
> aislamiento estricto en Docker, y cumple los 4 criterios de la rubrica
> en cada uno de los 5 nodos del pipeline."

> "Gracias."

================================================================================
MAPEO A RUBRICA — CONTRASTE CON JUECES
================================================================================

1. TAREAS EXITOSAS / CORRECTAS (30%)
   -------------------------------------------------------------------
   | Evidencia                              | Como mostrarla          |
   |----------------------------------------|-------------------------|
   | 502 → 200 verificado                   | curl antes y despues    |
   | Causa raiz con 3 evidence_ids          | Output del chat         |
   | Cucumber 2 scenarios / 16 steps green  | npx cucumber-js         |
   | Stryker 70.30% (policy 81.82%)         | npx stryker run         |
   | pytest + 14 TS tests green             | npm test + pytest       |
   | 30 lineas → 1 patron (29 descartados)  | Output del chat         |
   | Pipeline 5 nodos completa autonomo      | node run_pipeline_and_push.js |
   | Artefactos JSON validos en .ir_state/  | ls .ir_state/ + cat     |

2. COMPORTAMIENTO Y AUTONOMIA (25%)
   -------------------------------------------------------------------
   | Evidencia                              | Como mostrarla          |
   |----------------------------------------|-------------------------|
   | Diagnostico sin indicar herramientas   | Prompt: "investiga"     |
   | tool_choice: "auto"                    | El modelo decide tools  |
   | Politica de autonomia en codigo         | policy.ts               |
   | Parada ante confianza <80%             | canStartRecovery rechaza|
   | Flujo snapshot→restore→validate→reload→verify | /demo/recover   |
   | Pipeline 5 nodos sin intervencion       | run_pipeline_and_push.js|
   | Modo autonomo: sintesis si <0.8         | diagnosis.json          |

3. USO DE HERRAMIENTAS Y ORQUESTACION (25%)
   -------------------------------------------------------------------
   | Evidencia                              | Como mostrarla          |
   |----------------------------------------|-------------------------|
   | 10 herramientas MCP atomicas           | opencode mcp list       |
   | Anotaciones readOnly/destructive       | Schema en mcp.ts        |
   | Sin terminal generica, sin docker.sock | AGENTS.md invariantes   |
   | evidence_id por operacion              | Cada tool retorna id    |
   | Compresion de logs (30→1)              | read_logs con dedup     |
   | Context pruning 12k tokens             | Config en README        |
   | Canal restringido validate/reload      | control.ts file IPC     |
   | Inyeccion de contexto inline           | run_pipeline_and_push.js|

4. GESTION DE LA AMBIGUEDAD (20%)
   -------------------------------------------------------------------
   | Evidencia                              | Como mostrarla          |
   |----------------------------------------|-------------------------|
   | Correlacion multi-senal                | inspect_service mismatch|
   | 502 aislada NO basta                   | restore_config 6 condiciones|
   | Policy rechaza telemetria incompleta   | Test #8 policy.test.ts  |
   | Hipotesis Red/Blue/Auditor             | System prompt del agente|
   | Engram sugiere, no confirma            | search_memory con rank  |
   | Fallback honesto admite limitacion     | diagnosis.json evidence |
   | Sanitizacion de secretos               | redactSecrets()         |
   | looksLikeToolCall descarta alucinacion | run_pipeline_and_push.js|

================================================================================
COMANDO DOCKER CORREGIDO
================================================================================

El contenedor necesita tmpfs para /logs, /control, /engram y /tmp.
No usar --cap-drop ALL con nginx (necesita CAP_NET_BIND_SERVICE para puerto 80).

COMANDO CORREGIDO:

  sudo docker rm -f ir-sentinel 2>/dev/null

  sudo docker run -d \
    --name ir-sentinel \
    --security-opt no-new-privileges:true \
    --read-only \
    --tmpfs /tmp \
    --tmpfs /logs \
    --tmpfs /control \
    --tmpfs /engram \
    --tmpfs /run \
    --cap-drop ALL \
    --cap-add NET_BIND_SERVICE \
    -p 127.0.0.1:3001:3001 \
    -p 127.0.0.1:8088:80 \
    ir-sentinel:secure

  # Verificar
  sudo docker ps
  sudo docker logs ir-sentinel
  curl http://127.0.0.1:3001/health

================================================================================
PLAN DE RESPALDO (SI KOSTRA/INTERNET FALLAN)
================================================================================

1. Cucumber en vivo — npx cucumber-js muestra 502→200 sin necesidad del LLM
2. Captura pre-grabada — output del diagnostico guardado en docs/
3. Pipeline Node.js — run_pipeline_and_push.js con fallbacks sintetizados
4. Artefactos en .ir_state/ — evidencia de ejecuciones anteriores
5. Dashboard web — curl http://127.0.0.1:3001/dashboard muestra UI completa

================================================================================
RESPUESTAS A PREGUNTAS ESPERADAS
================================================================================

P: Como evitan que el agente ejecute comandos destructivos?
R: Policy gate en codigo TypeScript (policy.ts), no en prompt. 4 condiciones
   obligatorias: confianza 80-100, backend 200, causa confirmada, reversible.
   Hooks PreToolUse bloquean rm -rf, DROP TABLE, etc.

P: Que pasa si el modelo alucina?
R: looksLikeToolCall() detecta envelopes {name, arguments} y los descarta.
   Cada tool devuelve evidence_id; conclusiones sin evidence_id se marcan
   UNVERIFIED.

P: Como manejan telemetria incompleta?
R: canStartRecovery rechaza backendStatus: 0 explicitamente. 14 tests TS
   cubren degradacion por telemetria incompleta. El agente separa hechos de
   hipotesis.

P: Por que no exponen terminal generica?
R: AGENTS.md invariante #3: solo herramientas MCP autorizadas. Sin
   execute_shell. Sin docker.sock. Privilegio minimo visible en anotaciones
   readOnly/destructive.

P: Cual es el MTTR?
R: < 2 minutos en la demo. El pipeline de 5 nodos completa en ~90s con
   timeout de 20s por llamada API.

P: Que pasa si la API de Kostra se cae durante la demo?
R: AbortController con timeout de 20s. Fallback sintetizado en cada nodo.
   El pipeline completa autonomo con diagnostico sintetizado. Cucumber
   muestra 502→200 sin necesidad del LLM.

P: Como optimizan el uso de tokens?
R: 4 capas: (1) compresion de logs (30→1 patron), (2) context pruning 12k,
   (3) presupuesto tools MCP (max_items, max_chars), (4) Engram selectivo
   (max 5 resultados con rank).

P: Por que la politica de autonomia esta en codigo y no en prompt?
R: Un prompt puede ser sobrescrito por el LLM (prompt injection). Codigo
   TypeScript es determinista e inmutable desde el modelo. El LLM no puede
   eludir canStartRecovery.

================================================================================
FIN DEL GUION
================================================================================
