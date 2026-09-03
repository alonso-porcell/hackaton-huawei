# Auditoría del stack local

Verificada el 3 de septiembre de 2026 en el equipo de la demostración.

## Disponible y probado

| Componente | Estado | Versión o detalle |
|---|---|---|
| Docker | Disponible | cliente y servidor 29.7.2 |
| Linux gráfico | Disponible | Debian 12 mediante Docker/noVNC |
| OpenCode | Disponible | 1.18.26 |
| Kostra / GLM-5.2 | Conectado | respuesta real `KOSTRA_OK` |
| Node.js | Disponible | 22.23.2 |
| pnpm | Disponible | 11.25.0 |
| Python | Disponible | 3.11.2 en el escritorio; 3.12 en la API |
| API FastAPI | Ejecutándose | contenedor saludable |
| Nginx | Ejecutándose | 1.29.8, contenedor saludable |
| Incident Tools MCP | Ejecutándose | servidor conectado desde OpenCode |
| Cucumber.js | Instalado en el proyecto | 13.2.1, escenario completo aprobado |
| Stryker | Instalado en el proyecto | 10.0.0, mutation score 70.30% |
| Optimizador de logs | Implementado | compactación determinista TypeScript |

## No instalado todavía

| Componente | Prioridad | Decisión |
|---|---|---|
| Engram | Siguiente fase | Memoria útil, pero no bloquea el flujo principal |
| RTK | Siguiente fase | Complementa el optimizador propio; no es requisito del núcleo |
| Moonshine v2 | Opcional | Voz a texto; validar rendimiento y licencia del modelo español |
| Kokoro | Opcional | Texto a voz local; conservar siempre la interfaz textual |
| Dashboard dedicado | Siguiente fase | OpenCode gráfico cubre la interacción del MVP |

Nginx, FastAPI, Cucumber y Stryker se instalan dentro de las imágenes del proyecto,
no globalmente en el escritorio. Esto es intencional: reproduce versiones exactas
y evita contaminar el contenedor de trabajo.

## Compatibilidad relevante

OpenCode 1.18.26 utiliza el transporte SSE legado para MCP remoto. Incident Tools
publica ese transporte y conserva además el endpoint moderno para facilitar una
migración futura. TypeScript se fijó en 6.0.3 porque TypeScript 7 no fue compatible
con Stryker 10 durante la validación.
