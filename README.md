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
