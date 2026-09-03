# Caso `api502`

## Estado

**MVP operativo y validado localmente.**

El núcleo de mayor puntaje ya contiene API, Nginx, herramientas MCP, agente de
OpenCode, optimización de logs y pruebas automatizadas. Engram, RTK, voz y un
dashboard dedicado quedan separados como mejoras posteriores al flujo crítico.

## Resumen

Un cambio de configuración deja a Nginx apuntando a un puerto incorrecto. El
backend continúa saludable, pero las solicitudes que pasan por el proxy reciben
una respuesta `502 Bad Gateway`.

El agente de respuesta a incidentes debe observar el fallo, reunir evidencia,
identificar la causa raíz, aplicar una recuperación segura y reversible, y
verificar que el servicio vuelva a responder correctamente.

## Flujo propuesto

1. La API responde correctamente a través de Nginx.
2. Se activa una configuración defectuosa del upstream.
3. Nginx comienza a responder `502 Bad Gateway`.
4. El agente revisa el estado del proxy, el backend, los logs y la configuración.
5. El agente determina que el backend sigue activo y que el upstream es incorrecto.
6. Antes de modificar el sistema, respalda la configuración actual.
7. Restaura una configuración conocida como válida y la valida.
8. Recarga Nginx y comprueba la recuperación de la API.
9. Registra la evidencia, las acciones y el aprendizaje del incidente.

## Capacidades que debe demostrar

- Diagnóstico basado en evidencia y no sólo en una respuesta `502`.
- Uso controlado de herramientas con permisos limitados.
- Acción reversible con respaldo y validación previa.
- Recuperación autónoma y verificación posterior.
- Compresión y deduplicación de logs para reducir el consumo de tokens.
- Consulta y registro de memoria de incidentes.
- Interacción por texto, con voz como mejora de experiencia.
- Manejo de al menos una herramienta que falle o entregue información incompleta.

## Stack implementado

- Kostra Cloud con GLM-5.2.
- OpenCode como agente y orquestador.
- Nginx como proxy del servicio afectado.
- API REST en Python/FastAPI.
- Herramientas MCP en TypeScript administradas con pnpm.
- Linux y Docker como entorno reproducible.
- Herramientas especializadas para observación, recuperación y verificación.
- Optimizador determinista de logs y resultados de herramientas.
- pytest, Gherkin/Cucumber.js y Stryker para calidad verificable.

Engram, RTK, Moonshine y Kokoro continúan en el roadmap, pero no bloquean el MVP.

## Documentación

- [Arquitectura y controles](./docs/architecture.md)
- [Inicio rápido desde el escritorio Linux](./docs/quickstart.md)
- [Contratos de herramientas MCP](./docs/tool-contracts.md)
- [Pruebas y resultados](./docs/testing.md)
- [Evidencia para la rúbrica](./docs/rubric-evidence.md)
- [Guion de demostración](./docs/demo-script.md)
- [Auditoría del stack local](./docs/stack-audit.md)
- [Traspaso autocontenido para Antigravity](./HANDOFF_ANTIGRAVITY.md)

## Comportamiento de OpenCode

OpenCode debe iniciarse desde este directorio para cargar [`AGENTS.md`](./AGENTS.md),
que contiene las reglas persistentes del caso. El agente principal está definido
en [`.opencode/agents/ir-sentinel.md`](./.opencode/agents/ir-sentinel.md).

Los procedimientos especializados se cargan bajo demanda:

- [`diagnose-api502`](./.opencode/skills/diagnose-api502/SKILL.md)
- [`recover-nginx`](./.opencode/skills/recover-nginx/SKILL.md)
- [`write-postmortem`](./.opencode/skills/write-postmortem/SKILL.md)

Las restricciones críticas descritas en estos archivos también deberán aplicarse
en el código de las herramientas MCP y comprobarse mediante pruebas; no dependerán
únicamente de las instrucciones enviadas al modelo.

## Criterios iniciales de éxito

- La API pasa de `502` a `200` después de la intervención.
- La causa raíz queda respaldada por logs, estado del backend y configuración.
- Nginx sólo se recarga después de validar la configuración.
- La recuperación es reversible y no expone secretos.
- El agente registra un informe breve y sanitizado del incidente.
- La demostración completa puede ejecutarse en menos de cuatro minutos.

## Arranque técnico

Desde este directorio:

```bash
docker compose up --build --wait
```

Luego se opera desde OpenCode en el escritorio Linux; consulta la
[guía de inicio rápido](./docs/quickstart.md).
