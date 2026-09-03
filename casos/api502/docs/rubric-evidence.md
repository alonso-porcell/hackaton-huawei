# Evidencia para la rúbrica

Esta matriz prioriza los criterios de mayor puntaje y señala evidencia demostrable,
no sólo intenciones.

| Criterio | Evidencia preparada | Cómo mostrarla |
|---|---|---|
| Tareas correctas | 502 reproducible, backend 200, recuperación a 200, pruebas automatizadas | Ejecutar el escenario Cucumber y mostrar la verificación final |
| Autonomía | Regla persistente, agente especializado y política de confianza implementada en código | Pedir a `ir-sentinel` la recuperación completa sin indicar herramientas |
| Herramientas y orquestación | Ocho herramientas MCP atómicas, sin terminal genérica | Mostrar `opencode mcp list` y la secuencia de llamadas |
| Ambigüedad | El 502 se contrasta con backend, logs y configuración; baja confianza bloquea acciones | Preguntar por hechos, hipótesis y confianza antes de recuperar |
| Calidad técnica | Docker reproducible, privilegios mínimos, TDD, Cucumber y mutación | Mostrar contenedores sanos y resumen de suites |
| Documentación | Arquitectura, inicio rápido, contratos, pruebas y guion de demo | Navegar la carpeta `docs/` |
| UX | Respuestas breves en español con evidencia, riesgo y reversibilidad | Usar el escritorio gráfico de OpenCode |
| Creatividad | Reducción visible de logs y política de recuperación verificable | Mostrar 30 líneas convertidas en un patrón |

## Evidencias clave del incidente

- `HEALTH-*`: Nginx responde 502 mientras FastAPI responde 200.
- `LOG-*`: Nginx informa conexión rechazada hacia el upstream en puerto 8999.
- `CONFIG-*`: la configuración activa contiene `server api:8999` y un hash SHA-256.
- `snapshotId`: acredita respaldo previo a la restauración.
- validación y recarga: acreditan orden y resultado de las operaciones.
- verificación final: acredita HTTP 200 por Nginx y directamente en FastAPI.

Los identificadores se generan en cada ejecución; el guion no depende de valores
pregrabados.
