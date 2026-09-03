---
layout: default
title: IR-Sentinel · AI Agent Hackathon
description: Guía de caso de uso para un agente SRE autónomo
---

# IR-Sentinel

## De una alerta 502 a una recuperación verificable

Guía de caso de uso construida para la **AI Agent Hackathon** con OpenCode,
Kostra Cloud (`glm-5.2`), Docker, Nginx, FastAPI, MCP, Engram y TypeScript.

El proyecto demuestra cómo un agente puede reunir evidencia, diagnosticar una
discrepancia entre proxy y backend, ejecutar una recuperación reversible y
verificar el resultado antes de cerrar el incidente.

[Leer el artículo completo](./articulo-api502.html){: .btn .btn-primary }

## Recorridos del repositorio

- [Caso `api502`](https://github.com/alonso-porcell/hackaton-huawei/tree/main/casos/api502)
- [README del proyecto](https://github.com/alonso-porcell/hackaton-huawei)
- [Research técnico](https://github.com/alonso-porcell/hackaton-huawei/blob/main/vini_research.md)
- [Arquitectura del caso](./architecture.html)
- [Guion de demostración](./demo-script.html)
- [Evidencia para la rúbrica](./rubric-evidence.html)

## Resultado validado

```text
Nginx 502 → diagnóstico con evidencia → snapshot → nginx -t
→ reload → proxy 200 + backend 200
```

El artículo explica las decisiones de stack, los desafíos resueltos, la estrategia
de pruebas, la optimización de tokens y los colaboradores registrados en Git.
