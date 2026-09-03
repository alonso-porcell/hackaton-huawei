# https://owasp.org/www-project-top-10-for-large-language-model-applications/
# Agente Autónomo de Incident Response (IR-Agent)

Arquitectura, configuración de contexto y pipeline de ejecución técnica para un Agente Autónomo de Respuesta ante Incidentes, optimizado para inferencia en Kostra Cloud (`glm-5.2`), orquestación vía OpenCode/Claude Code CLI y aislamiento estricto en contenedores Docker.

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
