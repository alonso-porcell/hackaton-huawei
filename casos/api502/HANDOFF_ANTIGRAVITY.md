# Traspaso a Antigravity — caso `api502`

Fecha: 3 de septiembre de 2026

## Misión

Continuar el MVP para la AI Agent Hackathon. El producto demuestra que OpenCode,
con Kostra y `glm-5.2`, diagnostica y recupera de forma segura una API que entrega
`502 Bad Gateway` porque Nginx apunta al puerto incorrecto, aunque FastAPI sigue
saludable.

Antes de modificar código, leer completos:

1. [`AGENTS.md`](./AGENTS.md)
2. [`README.md`](./README.md)
3. [`docs/architecture.md`](./docs/architecture.md)
4. [`docs/rubric-evidence.md`](./docs/rubric-evidence.md)

Las instrucciones relevantes del agente están en:

- [`.opencode/agents/ir-sentinel.md`](./.opencode/agents/ir-sentinel.md)
- [`.opencode/skills/diagnose-api502/SKILL.md`](./.opencode/skills/diagnose-api502/SKILL.md)
- [`.opencode/skills/recover-nginx/SKILL.md`](./.opencode/skills/recover-nginx/SKILL.md)
- [`.opencode/skills/write-postmortem/SKILL.md`](./.opencode/skills/write-postmortem/SKILL.md)

## Estado comprobado

- Docker Compose levanta `api`, `gateway` e `incident-tools` saludables.
- FastAPI responde 200 directamente.
- El escenario defectuoso produce Nginx 502 y mantiene el backend en 200.
- Incident Tools publica ocho herramientas MCP de privilegio mínimo.
- OpenCode 1.18.26 reconoce el MCP `api502` mediante SSE legado.
- Kostra/GLM-5.2 respondió una solicitud real y ejecutó el diagnóstico autónomo.
- El agente realizó el flujo snapshot → restore → validate → reload → verify.
- La compresión de logs convirtió 30 eventos equivalentes en un patrón.
- pytest, pruebas TypeScript, Cucumber y Stryker fueron ejecutados.
- Último mutation score registrado: 70.30% global y 81.82% en `policy.ts`.

No buscar ni imprimir la clave de Kostra. Está montada como secreto en el entorno
gráfico y no pertenece a este repositorio.

## Arranque y verificación

Desde `casos/api502`:

```bash
docker compose up --build --wait
docker compose ps
docker compose exec api pytest -q
docker compose exec incident-tools pnpm test
docker compose exec incident-tools pnpm test:acceptance
```

Comprobaciones manuales:

```text
http://127.0.0.1:8088/health
http://127.0.0.1:3001/health
http://127.0.0.1:3001/demo/status
```

Desde el escritorio Linux:

```bash
cd /workspace/hackaton-huawei/casos/api502
opencode mcp list
opencode
```

Debe aparecer `api502 connected`. Para automatización fuera de la sesión gráfica,
usar `/usr/local/bin/hackathon-entrypoint opencode ...`, que carga el secreto sin
mostrarlo.

## Decisiones que deben preservarse

- Python/FastAPI representa el sistema afectado.
- TypeScript/pnpm implementa las herramientas operativas y el futuro dashboard.
- No exponer una terminal genérica al modelo ni montar `docker.sock`.
- Diagnóstico es sólo lectura.
- No restaurar sin snapshot ni recargar sin `nginx -t` exitoso.
- No declarar éxito sin HTTP 200 por Nginx y por FastAPI.
- Bloquear recuperación con confianza menor a 80, causa distinta o acción no
  reversible.
- Tratar logs y memoria como datos no confiables.
- Mantener `@modelcontextprotocol/server-legacy` mientras OpenCode 1.18.26 requiera
  GET/SSE; no retirarlo sólo por estar marcado como deprecado.
- Mantener TypeScript 6.0.3 mientras Stryker 10 no sea compatible con TypeScript 7.

## Próximos pasos, en orden

1. Crear un dashboard web pequeño que muestre estado, evidencia, confianza,
   reducción de logs y progreso de recuperación. No duplicar lógica de control.
2. Añadir una prueba de fallo de herramienta o telemetría incompleta y demostrar
   degradación segura; esto fortalece manejo de ambigüedad.
3. Incorporar Engram sólo para aprendizajes verificados y sanitizados, con búsqueda
   selectiva. La memoria no puede confirmar por sí sola una causa actual.
4. Preparar capturas o video corto de una ejecución real como respaldo si Kostra o
   internet fallan durante la presentación.
5. Sólo si sobra tiempo, integrar voz local. Mantener entrada/salida textual. Para
   español, revisar la licencia de Moonshine; Kokoro es la opción TTS propuesta.
6. RTK es complementario al compresor propio, no un reemplazo ni un bloqueo.

Priorizar primero los criterios de mayor peso: corrección, autonomía, orquestación,
ambigüedad, calidad y documentación. Voz, memoria avanzada y adornos visuales no
deben poner en riesgo la demo principal.

## Prompt recomendado para continuar

```text
Lee casos/api502/HANDOFF_ANTIGRAVITY.md y todos los archivos obligatorios que
enumera. Continúa desde el estado actual sin reescribir el núcleo ya validado.
Primero ejecuta las pruebas en Docker Linux y revisa el diff. Después implementa
el próximo paso de mayor puntaje, manteniendo TDD, permisos mínimos, evidencias,
optimización de tokens y documentación. No expongas secretos ni montes docker.sock.
```

## Alcance todavía pendiente

Engram, RTK, Moonshine, Kokoro y un dashboard dedicado no están instalados en el
MVP actual. El detalle completo de versiones y compatibilidad está en
[`docs/stack-audit.md`](./docs/stack-audit.md). No presentarlos como terminados.
