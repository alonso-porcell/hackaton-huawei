---
name: diagnose-api502
description: Diagnostica un error 502 de Nginx comparando proxy, backend, logs, configuración y memoria sin modificar el sistema
compatibility: opencode
---

# Diagnóstico de api502

## Objetivo

Determinar si el error `502 Bad Gateway` es causado por un upstream incorrecto
sin realizar cambios en el entorno.

## Entradas

- Identificador del incidente.
- Servicio afectado.
- Ventana temporal inicial, preferentemente los últimos cinco minutos.

## Herramientas permitidas

- `inspect_service`
- `read_logs`
- `inspect_config`
- `search_memory`

Si alguna no existe o no está disponible, informa la limitación. No uses una
terminal genérica como reemplazo.

## Procedimiento

1. Compara la respuesta pública a través de Nginx con la salud directa del backend.
2. Solicita logs acotados alrededor del fallo y conserva sus identificadores.
3. Inspecciona el upstream activo con secretos redactados.
4. Consulta como máximo tres recuerdos relacionados en Engram.
5. Formula al menos una hipótesis alternativa antes de elegir la causa principal.
6. Calcula la confianza según la concordancia de las evidencias actuales.

Una memoria similar orienta la búsqueda, pero no cuenta como confirmación del
incidente actual.

## Salida requerida

```json
{
  "incident_id": "string",
  "facts": [],
  "hypotheses": [],
  "root_cause": "string|null",
  "confidence": 0,
  "evidence_ids": [],
  "recommended_action": "string|null",
  "safe_to_recover": false,
  "limitations": []
}
```

`safe_to_recover` sólo puede ser verdadero con confianza mínima de 80, backend
directo saludable y evidencia de que el upstream configurado es incorrecto.

