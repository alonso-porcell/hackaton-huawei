# Contratos operativos

OpenCode sólo dispone de ocho herramientas especializadas. Cada respuesta es
estructurada y las observaciones importantes incluyen un `evidenceId`.

| Herramienta | Tipo | Resultado esperado | Condición de fallo seguro |
|---|---|---|---|
| `inspect_service` | Lectura | HTTP de proxy y backend, más discrepancia | No modifica estado |
| `read_logs` | Lectura | Patrones, conteos y duplicados descartados | Máximo 200 líneas |
| `inspect_config` | Lectura | Configuración sanitizada y SHA-256 | No devuelve secretos detectables |
| `snapshot_config` | Escritura reversible | Identificador del respaldo | Rechaza identificadores no seguros |
| `restore_config` | Escritura | Configuración sana restaurada | Política bloquea baja confianza o diagnóstico inválido |
| `validate_config` | Lectura | Resultado de `nginx -t` | No recarga Nginx |
| `reload_proxy` | Escritura | Recarga después de revalidar | Se bloquea si la validación falla |
| `verify_recovery` | Lectura | HTTP 200 en proxy y backend | Un solo reintento acotado |

## Política de autonomía

`restore_config` sólo autoriza la acción cuando se cumplen simultáneamente:

```text
80 <= confidence <= 100
backend_status == 200
root_cause == nginx_upstream_mismatch
reversible == true
snapshot pertenece al incidente
```

Una respuesta `502` aislada no basta. El agente debe correlacionar la salud del
backend, el error de conexión del upstream y la configuración activa.

## Optimización de tokens

`read_logs` normaliza datos volátiles como fecha, worker, request, IP del cliente e
IP del upstream. Luego agrupa mensajes equivalentes y conserva el puerto, que es
evidencia causal. La salida informa:

- líneas originales;
- patrones únicos;
- duplicados descartados;
- muestra recuperable de patrones y conteos.

En la validación local, 30 líneas repetidas quedaron representadas por un patrón y
29 duplicados fueron descartados antes de llegar a GLM-5.2.
