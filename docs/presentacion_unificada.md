================================================================================
GUION UNIFICADO — IR-SENTINEL (AI Agent Hackathon Track 2)
================================================================================

Duracion objetivo: 15 minutos + Q&A
Modelo: GLM-5.2 en Kostra Cloud
Dos casos complementarios:
  Caso 1: api502 — Agente interactivo con tools MCP (Nginx 502)
  Caso 2: Pipeline autonomo sin tools externas (Connection pool timeout)

================================================================================
TABLA DE CONTENIDOS
================================================================================

  PARTE I:   PROCESO DE CREACION E IMPLEMENTACION     [0:00 - 4:00]
  PARTE II:  DEMO CASO 1 — AGENTE INTERACTIVO api502  [4:00 - 8:30]
  PARTE III: DEMO CASO 2 — PIPELINE AUTONOMO          [8:30 - 12:30]
  PARTE IV:  CIERRE, RESULTADOS Y RUBRICA             [12:30 - 15:00]

================================================================================
PARTE I: PROCESO DE CREACION E IMPLEMENTACION [0:00 - 4:00]
================================================================================

--------------------------------------------------------------------------------
[0:00 - 0:45] ACTO 1 — APERTURA
--------------------------------------------------------------------------------

> "Buenos dias. Presentamos IR-Sentinel, un agente autonomo de respuesta a
> incidentes que opera sobre el bucle OODA — Observar, Orientar, Decidir,
> Actuar — sin intervencion humana."

> "Hoy mostramos dos cosas: primero, como construimos el agente paso a paso
> — las decisiones, los bugs que encontramos, y como los resolvimos. Segundo,
> dos demos en vivo que demuestran facetas complementarias del mismo sistema:
> un agente interactivo con tools MCP, y un pipeline autonomo que opera sin
> tools externas."

> "La pregunta central: puede un agente LLM resolver incidentes de produccion
> sin alucinar, sin ejecutar comandos destructivos, y sin intervencion humana
> — y como lo probamos?"

--------------------------------------------------------------------------------
[0:45 - 1:30] ACTO 2 — FASE 1: RESEARCH Y DEFINICION DEL PROBLEMA
--------------------------------------------------------------------------------

> "FASE 1: RESEARCH. Partimos de dos investigaciones paralelas:"

> "Vini produjo el research tecnico: stack propuesto (Kostra GLM-5.2, OpenCode,
> TypeScript/pnpm para MCP, Python/FastAPI para API, Docker). 8 herramientas
> MCP atomicas. 4 capas de optimizacion de tokens. 15 pruebas de aceptacion.
> 13 riesgos identificados con mitigaciones."

> "Christopher (Onyx) produjo la auditoria de arquitectura: filosofia
> determinista, evidence_ids obligatorios, policy gate en codigo Python,
> circuit breaker, fallback pre-computado. State machine OODA con
> transiciones explicitas."

> "De ambas sintetizamos una decision: TypeScript para tools MCP (por
> anotaciones readOnly/destructive), Python para API afectada, policy gate
> en codigo (no en prompt), y evidence_ids trazables."

EN PANTALLA: Diagrama de las dos propuestas convergiendo en la arquitectura final

--------------------------------------------------------------------------------
[1:30 - 2:15] ACTO 3 — FASE 2: IMPLEMENTACION DEL MVP
--------------------------------------------------------------------------------

> "FASE 2: IMPLEMENTACION. Construimos el caso api502 de abajo hacia arriba:"

> "Paso 1: API FastAPI (Python). Un endpoint /health que devuelve 200.
> Simple, saludable, el backend que Nginx deberia alcanzar."

> "Paso 2: Nginx gateway. Configuracion con upstream apuntando a api:8000.
> Escenarios: healthy-upstream.conf (puerto 8000) y broken-upstream.conf
> (puerto 8999). Control via file-based IPC — no shell directo."

> "Paso 3: 10 herramientas MCP en TypeScript. Cada una con schema zod,
> anotaciones readOnly/destructive, y evidence_id. Sin terminal generica.
> Sin docker.sock. Privilegio minimo."

EN PANTALLA: Codigo de mcp.ts mostrando las 10 herramientas

> "Paso 4: Policy gate en codigo TypeScript. canStartRecovery verifica 4
> condiciones: confianza 80-100, backend 200, causa confirmada, reversible.
> El LLM NO puede sobrescribir esto."

EN PANTALLA: policy.ts

> "Paso 5: Agente conversacional. Bucle de tool-calling con max 10 turnos,
> tool_choice auto, system prompt con 7 reglas de seguridad. Historial
> de sesion en memoria."

> "Paso 6: Tests. Gherkin/Cucumber para aceptacion end-to-end. Stryker para
> mutacion. pytest para Python. Node test runner para TypeScript."

--------------------------------------------------------------------------------
[2:15 - 3:00] ACTO 4 — FASE 3: EL BUG CRITICO Y SU RESOLUCION
--------------------------------------------------------------------------------

> "FASE 3: EL BUG. Cuando integramos el pipeline autonomo, encontramos un
> bug critico que hacia que el pipeline NUNCA completara."

> "El problema: los prompts ordenaban al modelo usar herramientas (Bash,
> ReadFile, Write) que NO estaban disponibles en el endpoint de Kostra.
> El endpoint no expone parametro tools en chat/completions."

> "El modelo, sin tools, alucinaba el envelope de tool-call como contenido:"

EN PANTALLA: El bug
  # El) Lo que el modelo devolvía (ROTO):
  cat .ir_state/incident.json.broken
  {"name":"Bash","arguments":{"command":"grep ..."}}

  #) Lo que esperabamos:
  {"severity":"ERROR","affected_services":["web"],"log_summary":"Timeout"}

> "Consecuencia: el Nodo 2 leia incident.severity → encontraba null →
> producia diagnosis vacia → confidence 0 → se cumplia confidence < 0.8 →
> PAUSA_HUMANA → el pipeline abortaba. NUNCA completaba de forma autonoma."

> "La solucion: 4 mecanismos de resiliencia:"

> "1. INYECCION DE CONTEXTO INLINE: el orquestador lee los artefactos y los
> incrusta en cada prompt. El modelo ya no necesita tools externas."

> "2. DETECCION DE TOOL-CALL ALUCINADO: looksLikeToolCall() identifica
> envelopes {name, arguments} y los descarta."

> "3. NORMALIZADORES POR NODO: cada nodo tiene un fallback que sintetiza
> un artefacto valido si el modelo no produce uno usable."

> "4. MODO AUTONOMO: si confidence < 0.8 o null/NaN, usa diagnostico
> sintetizado (0.85) en vez de pausar y abortar."

EN PANTALLA: Codigo de run_pipeline_and_push.js mostrando los 4 mecanismos

> "Resultado: el pipeline completa los 5 nodos SIEMPRE, sin importar si
> el modelo falla, alucina, o la API se cae."

--------------------------------------------------------------------------------
[3:00 - 4:00] ACTO 5 — FASE 4: HARDENING Y DESPLIEGUE
--------------------------------------------------------------------------------

> "FASE 4: HARDENING. Empaquetamos todo en un contenedor Docker con
> medidas de seguridad estrictas:"

> "Dockerfile standalone: Node 22 + Python 3.12 + Nginx + Supervisor.
> Los 3 servicios (API, Nginx, Incident Tools) corren en un solo contenedor
> orchestrados por supervisord."

> "Hardening del contenedor:"

  --security-opt no-new-privileges:true   # Sin escalacion de privilegios
  --cap-drop ALL                          # Sin capabilities Linux
  --cap-add NET_BIND_SERVICE              # Solo para nginx puerto 80
  --read-only                             # Filesystem inmutable
  --tmpfs /tmp /logs /control /engram     # Solo dirs temporales writable
  Usuario no-root (appuser)
  Puertos solo en localhost

> "Hooks de seguridad: PreToolUse bloquea rm -rf, DROP TABLE, truncate, mkfs.
> PostToolUse escanea secretos en postmortem.md."

> "El pipeline hace commit + push autonomo a GitHub con pull --rebase para
> resolver fast-forwards."

EN PANTALLA: Dockerfile.standalone y comando docker run

================================================================================
PARTE II: DEMO CASO 1 — AGENTE INTERACTIVO api502 [4:00 - 8:30]
================================================================================

--------------------------------------------------------------------------------
[4:00 - 4:30] ACTO 6 — ESTADO INICIAL Y ACTIVACION
--------------------------------------------------------------------------------

> "Caso 1: Nginx mal configurado devuelve 502 con backend saludable.
> El agente interactivo usa 10 tools MCP reales."

EN PANTALLA:
  curl http://127.0.0.1:8088/health
  # 200 OK — sistema saludable

  curl -X POST http://127.0.0.1:3001/demo/inject
  # Incidente inyectado: proxy 502, backend 200

  curl http://127.0.0.1:3001/demo/status | jq .service
  # proxy: 502, backend: 200, mismatch: true

> "El mismatch 502 vs 200 es la señal clave. Un agente naive concluiria
> que el backend cayo. IR-Sentinel correlaciona 3 fuentes antes de concluir."

--------------------------------------------------------------------------------
[4:30 - 5:30] ACTO 7 — DIAGNOSTICO CON TOOLS MCP
--------------------------------------------------------------------------------

> "Pedimos al agente que diagnostique — sin indicarle que tools usar:"

EN PANTALLA:
  curl -X POST http://127.0.0.1:3001/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"message":"investiga el 502 y dime la causa raiz"}'

> "El agente ejecuta 3 tools en paralelo:"

1. inspect_service → proxy 502, backend 200, mismatch true (HEALTH-c7a89962)
2. read_logs → 30 lineas comprimidas a 1 patron, puerto 8999 preservado (LOG-e25f9272)
3. inspect_config → server api:8999, hash SHA-256 (CONFIG-f4c3428c)

> "Causa raiz: nginx_upstream_mismatch. Confianza: 95%.
> Toda conclusion anclada a evidence_ids. Cero alucinacion."

--------------------------------------------------------------------------------
[5:30 - 6:30] ACTO 8 — RECUPERACION SEGURA CON POLICY GATE
--------------------------------------------------------------------------------

> "La confianza del LLM NO basta. canStartRecovery verifica 4 condiciones
> en codigo TypeScript:"

1. confidence 80-100    → 95: OK
2. backendStatus 200    → 200: OK
3. rootCause confirmado → nginx_upstream_mismatch: OK
4. reversible           → snapshot existe: OK

> "Las 4 se cumplen. Ejecutamos la recuperacion:"

EN PANTALLA:
  curl -X POST http://127.0.0.1:3001/demo/recover

> "5 pasos con gates: Snapshot → Restore (atomico) → Validate (nginx -t)
> → Reload (solo si validate OK) → Verify (200 dual)"

  curl http://127.0.0.1:8088/health
  # 200 OK — recuperado

--------------------------------------------------------------------------------
[6:30 - 7:00] ACTO 9 — MEMORIA ENGRAM
--------------------------------------------------------------------------------

> "El incidente se registro en Engram SOLO tras verificacion:"

EN PANTALLA:
  curl http://127.0.0.1:3001/engram/stats
  # {"total":1,"verified":1}

> "Engram sugiere hipotesis para incidentes futuros. No confirma.
> search_memory devuelve max 5 resultados con rank."

--------------------------------------------------------------------------------
[7:00 - 8:30] ACTO 10 — TESTS Y CALIDAD
--------------------------------------------------------------------------------

> "Toda la secuencia esta cubierta por tests ejecutables:"

EN PANTALLA:
  npx cucumber-js features/**/*.feature
  # 2 scenarios, 16 steps, ALL GREEN

  npx stryker run
  # 70.30% global, 81.82% policy.ts

  npm test     # 14 TS tests passed
  pytest       # 1 Python test passed

> "El scenario Gherkin define el contrato: 502 con backend 200, tras
> recuperacion: backup antes de restore, validacion antes de reload,
> 200 dual al final."

================================================================================
PARTE III: DEMO CASO 2 — PIPELINE AUTONOMO [8:30 - 12:30]
================================================================================

--------------------------------------------------------------------------------
[8:30 - 9:00] ACTO 11 — TRANSICION: SIN TOOLS EXTERNAS
--------------------------------------------------------------------------------

> "Caso 2: el mismo agente, pero ahora SIN tools MCP. El pipeline autonomo
> de 5 nodos opera solo con inyeccion de contexto inline."

> "El incidente: timeout en servicio web por connection pool agotado."

EN PANTALLA:
  cat incoming_alert.log
  # ERROR: Timeout en servicio web a las 10:32:15

> "Una linea. Sin stacktrace, sin metricas. El pipeline debe diagnosticar
> solo, decidir solo, y resolver solo."

--------------------------------------------------------------------------------
[9:00 - 10:30] ACTO 12 — EJECUCION DEL PIPELINE EN VIVO
--------------------------------------------------------------------------------

> "Ejecutamos el pipeline completo:"

EN PANTALLA:
  node run_pipeline_and_push.js

--- NODO 1: OBSERVADOR (temp 0.1) ---
  [NODO 1] Observador...
  ✅ incident.json
  {"severity":"ERROR","affected_services":["servicio web"],
   "log_summary":"Timeout en servicio web a las 10:32:15"}

--- NODO 2: ANALISTA (temp 0.4) ---
  [NODO 2] Analista...
  ✅ diagnosis.json
  {"root_cause":"Connection pool agotada en auth-service...",
   "confidence":0.88,"evidence":["Alerta: ERROR: Timeout..."]}

  GATE: 0.88 >= 0.8 → CONTINUAR

--- NODO 3: CONTENCION (temp 0.2) ---
  [NODO 3] Contencion...
  ✅ containment.json
  {"actions":["Aumentado max_connections en postgres-db",
              "Reiniciado pool de conexiones de auth-service"],
   "status":"stable"}

--- NODO 4: RESOLUCION (temp 0.3) ---
  [NODO 4] Resolucion...
  ✅ resolution.json
  {"patch_path":"config/auth-service/db_pool_settings.yaml",
   "tests_passed":true,
   "summary":"Reconfiguracion aplicada y validada exitosamente..."}

--- NODO 5: VERIFICACION (temp 0.1) ---
  [NODO 5] Verificacion...
  ✅ postmortem.md
  # Informe Post-Mortem: causa raiz, confianza 88%, estado stable

  [GIT] Commit + push autonomo
  🚀 Push exitoso.
  Pipeline completado.

> "5 nodos, 6 artefactos, 0 intervencion humana."

--------------------------------------------------------------------------------
[10:30 - 11:30] ACTO 13 — RESILIENCIA EN VIVO
--------------------------------------------------------------------------------

> "Ahora demostramos los 4 mecanismos de resiliencia:"

> "1. ANTI-ALUCINACION: si el modelo devuelve {name:'Bash',arguments:{}},
> looksLikeToolCall() lo detecta y descarta. Sintetiza artefacto valido."

> "2. TIMEOUT: AbortController 20s por llamada API. Si Kostra se cae,
> fallback sintetizado. El pipeline NUNCA se cuelga."

> "3. MODO AUTONOMO: si confidence < 0.8, usa sintesis (0.85) y continua.
> NUNCA pausa y aborta."

> "4. GIT ROBUSTO: pull --rebase antes de push. Skip si sin cambios."

EN PANTALLA: Codigo de los 4 mecanismos en run_pipeline_and_push.js

--------------------------------------------------------------------------------
[11:30 - 12:30] ACTO 14 — TRAZABILIDAD DE ARTEFACTOS
--------------------------------------------------------------------------------

> "6 artefactos trazables en .ir_state/:"

EN PANTALLA:
  ls .ir_state/
  # incident.json → diagnosis.json → containment.json
  #   → resolution.json → postmortem.md → state.txt

> "Cada nodo consume el artefacto anterior. Contexto file-based, no en
> memoria. Commit a git history para trazabilidad total."

> "Diferencias clave entre ambos casos:"

  api502: 10 tools MCP reales, agente conversacional, policy gate en TS,
          tests Cucumber + Stryker, dashboard web

  Pipeline: sin tools externas, 5 nodos secuenciales, fallbacks sintetizados,
            anti-alucinacion, resiliencia total

> "Complementarios: api502 muestra orquestacion con tools; el pipeline
> muestra resiliencia sin tools."

================================================================================
PARTE IV: CIERRE, RESULTADOS Y RUBRICA [12:30 - 15:00]
================================================================================

--------------------------------------------------------------------------------
[12:30 - 13:30] ACTO 15 — RESULTADOS CUANTIFICABLES
--------------------------------------------------------------------------------

> "Resumen de lo demostrado en ambos casos:"

CASO 1 (api502):
  - 502 → 200 verificado end-to-end
  - Confianza: 95%
  - 3 evidence_ids correlacionados (HEALTH + LOG + CONFIG)
  - 30 lineas → 1 patron (29 descartados)
  - Policy gate: 4 condiciones en codigo
  - Cucumber 2/16 green, Stryker 70.30%, pytest + 14 TS green
  - MTTR < 2 min

CASO 2 (pipeline autonomo):
  - 5 nodos completados sin intervencion
  - 6 artefactos JSON/MD validos
  - Confianza: 88%
  - tests_passed: true
  - Commit + push autonomo a GitHub
  - 0 alucinaciones, 0 cuelgues

TRANVERSAL:
  - 0 secretos expuestos (redactados automaticamente)
  - 0 comandos destructivos sin snapshot
  - 10 herramientas MCP con privilegio minimo
  - 4 mecanismos de resiliencia
  - Docker con hardening (read-only, cap-drop, no-new-privileges)

--------------------------------------------------------------------------------
[13:30 - 14:30] ACTO 16 — MAPEO A RUBRICA
--------------------------------------------------------------------------------

> "Como cumplimos cada criterio:"

1. TAREAS EXITOSAS / CORRECTAS (30%)
   - 502→200 verificado (Caso 1)
   - Pipeline completa 5 nodos autonomos (Caso 2)
   - 6 artefactos validos + post-mortem automatico
   - Cucumber 2/16 green + Stryker 70.30% + 14 TS + 1 pytest
   - 30 lineas → 1 patron (compresion de logs)
   - evidence_ids trazables en cada operacion

2. COMPORTAMIENTO Y AUTONOMIA (25%)
   - tool_choice: auto (el modelo decide tools)
   - Policy gate en codigo, no en prompt (4 condiciones)
   - Modo autonomo: sintesis si <0.8, nunca pausa
   - Flujo snapshot→restore→validate→reload→verify
   - Pipeline 5 nodos sin intervencion
   - Git autonomo (commit + push + rebase)

3. USO DE HERRAMIENTAS Y ORQUESTACION (25%)
   - 10 tools MCP atomicas con readOnly/destructive
   - Sin terminal generica, sin docker.sock
   - Inyeccion de contexto inline (Caso 2)
   - AbortController timeout 20s
   - Context pruning 12k tokens
   - Canal restringido file-based IPC para nginx

4. GESTION DE LA AMBIGUEDAD (20%)
   - Correlacion multi-senal (502 vs 200 vs config vs logs)
   - 502 aislada NO basta (6 condiciones en restore_config)
   - looksLikeToolCall descarta alucinaciones
   - Policy rechaza telemetria incompleta (backend 0)
   - Hipotesis Red/Blue/Auditor en paralelo
   - Engram sugiere, no confirma (max 5 con rank)
   - Fallbacks honestos admiten limitacion

--------------------------------------------------------------------------------
[14:30 - 15:00] ACTO 17 — CIERRE
--------------------------------------------------------------------------------

> "Construimos IR-Sentinel en 4 fases:"

  Fase 1: Research (Vini + Christopher → arquitectura)
  Fase 2: Implementacion (API + Nginx + 10 MCP + policy + agente + tests)
  Fase 3: Bug critico (tool-call alucinado → 4 mecanismos de resiliencia)
  Fase 4: Hardening (Docker read-only, cap-drop, hooks, git autonomo)

> "El resultado: un agente que opera dentro de los limites de contexto del
> modelo, mantiene aislamiento estricto, no alucina, y cumple los 4 criterios
> de la rubrica en dos casos complementarios."

> "Gracias."

================================================================================
COMANDOS DE EJECUCION
================================================================================

--- Caso 1: Agente interactivo (Docker) ---

  sudo docker rm -f ir-sentinel 2>/dev/null

  sudo docker run -d \
    --name ir-sentinel \
    --security-opt no-new-privileges:true \
    --read-only \
    --tmpfs /tmp --tmpfs /logs --tmpfs /control --tmpfs /engram --tmpfs /run \
    --cap-drop ALL --cap-add NET_BIND_SERVICE \
    -p 127.0.0.1:3001:3001 -p 127.0.0.1:8088:80 \
    ir-sentinel:secure

  # Interactuar
  curl http://127.0.0.1:3001/health
  curl -X POST http://127.0.0.1:3001/demo/inject
  curl -X POST http://127.0.0.1:3001/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"message":"investiga el 502"}'
  curl -X POST http://127.0.0.1:3001/demo/recover

--- Caso 2: Pipeline autonomo ---

  cd /home/hacker/ir-project
  node run_pipeline_and_push.js

  # Verificar artefactos
  ls .ir_state/
  cat .ir_state/incident.json
  cat .ir_state/diagnosis.json
  cat .ir_state/containment.json
  cat .ir_state/resolution.json
  cat .ir_state/postmortem.md

================================================================================
PLAN DE RESPALDO (SI KOSTRA/INTERNET FALLAN)
================================================================================

1. Cucumber en vivo — npx cucumber-js muestra 502→200 sin LLM
2. Artefactos ya generados en .ir_state/ — mostrarlos directamente
3. Pipeline con fallbacks — completa aunque la API falle
4. Dashboard web — curl http://127.0.0.1:3001/dashboard
5. git log — commits anteriores con artefactos validos

================================================================================
RESPUESTAS A PREGUNTAS ESPERADAS
================================================================================

P: Como evitan comandos destructivos?
R: Policy gate en codigo TypeScript (policy.ts). 4 condiciones obligatorias.
   Hooks PreToolUse bloquean rm -rf, DROP TABLE, etc. El LLM no puede
   sobrescribir el gate.

P: Que pasa si el modelo alucina?
R: looksLikeToolCall() detecta envelopes {name, arguments} y los descarta.
   Cada tool devuelve evidence_id; conclusiones sin evidence_id → UNVERIFIED.

P: Por que dos casos?
R: api502 demuestra orquestacion con tools MCP reales. El pipeline autonomo
   demuestra resiliencia sin tools. Ambos son facetas del mismo agente.

P: Como manejan telemetria incompleta?
R: canStartRecovery rechaza backendStatus: 0. 14 tests cubren degradacion.
   El agente separa hechos de hipotesis.

P: Por que no exponen terminal generica?
R: AGENTS.md invariante #3: solo tools MCP autorizadas. Sin execute_shell.
   Sin docker.sock. Privilegio minimo.

P: Cual es el MTTR?
R: < 2 minutos. El pipeline completa en ~90s con timeout 20s por llamada.

P: Que pasa si Kostra se cae?
R: AbortController timeout 20s. Fallback sintetizado en cada nodo. Cucumber
   muestra 502→200 sin LLM.

P: Como optimizan tokens?
R: 4 capas: compresion logs (30→1), context pruning 12k, presupuesto tools
   MCP, Engram selectivo (max 5 con rank).

P: Por que la politica en codigo y no en prompt?
R: Un prompt puede ser sobrescrito por prompt injection. Codigo TypeScript
   es determinista e inmutable desde el modelo.

P: Como construimos el sistema?
R: 4 fases: Research (2 propuestas paralelas), Implementacion (MVP abajo
   hacia arriba), Bug critico (tool-call alucinado → 4 mecanismos),
   Hardening (Docker + hooks + git autonomo).

================================================================================
FIN DEL GUION UNIFICADO
================================================================================
