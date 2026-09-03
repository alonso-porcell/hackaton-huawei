---
name: recover-nginx
description: Recupera el caso api502 mediante respaldo, restauración, validación, recarga y verificación obligatoria
compatibility: opencode
---

# Recuperación segura de Nginx

## Objetivo

Restaurar una configuración conocida como válida sin perder el estado anterior y
demostrar objetivamente que el servicio se recuperó.

## Precondiciones

- Diagnóstico estructurado con confianza igual o superior a 80%.
- Backend directo saludable.
- Upstream incorrecto respaldado por evidencia actual.
- Acción limitada al entorno simulado y reversible.

Si falta una precondición, no ejecutes herramientas de escritura.

## Herramientas permitidas

- `snapshot_config`
- `restore_config`
- `validate_config`
- `reload_proxy`
- `verify_recovery`

No uses una terminal genérica ni edites manualmente la configuración.

## Procedimiento atómico

1. Crea el respaldo y exige un identificador verificable.
2. Restaura exclusivamente la versión conocida como válida.
3. Valida la configuración restaurada.
4. Si la validación falla, detente, conserva el servicio sin recargar e informa el
   resultado.
5. Si la validación pasa, recarga Nginx.
6. Verifica la ruta pública a través de Nginx.
7. Declara recuperación sólo con HTTP `200` y evidencia de la comprobación.

Cada herramienta puede reintentarse una sola vez cuando el error sea transitorio.
Un error de validación no es transitorio y no debe ignorarse.

## Salida requerida

```json
{
  "incident_id": "string",
  "snapshot_id": "string|null",
  "restore_succeeded": false,
  "validation_succeeded": false,
  "reload_succeeded": false,
  "verification_status": "not-run|passed|failed",
  "http_status": null,
  "evidence_ids": [],
  "final_state": "recovered|unchanged|blocked"
}
```

