# Estrategia y evidencia de pruebas

## Pirámide aplicada

| Nivel | Herramienta | Cobertura actual |
|---|---|---|
| Unitario Python | pytest | Salud de la API FastAPI |
| Unitario TypeScript | Node test runner | Política de autonomía y compactación de logs |
| Aceptación | Gherkin + Cucumber.js | Recorrido real de 200 a 502 y recuperación a 200 |
| Mutación | Stryker | `policy.ts` y `logs.ts` |

## Comandos reproducibles

Desde `casos/api502`:

```bash
docker compose up --build --wait
docker compose exec api pytest -q
docker compose exec incident-tools pnpm test
docker compose exec incident-tools pnpm test:acceptance
docker compose exec incident-tools pnpm test:mutation
```

## Resultados validados el 3 de septiembre de 2026

- pytest: `1 passed`.
- pruebas TypeScript: `14 passed` (incluye límites de confianza, degradación por
  telemetría incompleta, fallos de backend, manejo de logs vacíos y desestructurados).
- Cucumber: `2 scenarios (2 passed), 16 steps (16 passed)`.
- Stryker: 101 mutantes, 65 eliminados, 6 timeouts, 30 sobrevivientes y mutation
  score total de `70.30%`. La política alcanzó `81.82%`.
- Dashboard web interactivo: operativo en `http://127.0.0.1:3001/` con telemetría en
  tiempo real, controles de inyección/recuperación y visualización del optimizador de tokens.
- OpenCode/GLM-5.2 diagnosticó el incidente real con 95% de confianza usando
  evidencia de servicio, logs y configuración, sin realizar cambios al pedir sólo
  diagnóstico.
- En una segunda ejecución, el agente creó el snapshot, restauró, validó, recargó
  y verificó HTTP 200 en ambos caminos.

Las advertencias de deprecación de FastAPI/Starlette respecto de `httpx` no alteran
el resultado; deben revisarse después de la demostración para evitar introducir
una migración de dependencias de último minuto.
