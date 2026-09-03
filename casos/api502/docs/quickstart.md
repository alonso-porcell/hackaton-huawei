# Inicio rápido sin PowerShell

## Desde el escritorio Linux

1. Abre el escritorio gráfico local en el navegador.
2. Abre **Terminal Emulator** dentro de Linux.
3. Entra al caso:

   ```bash
   cd /workspace/hackaton-huawei/casos/api502
   ```

4. Inicia OpenCode:

   ```bash
   opencode
   ```

OpenCode carga `AGENTS.md`, el agente `ir-sentinel`, sus tres procedimientos y el
servidor MCP `api502`. Kostra con `glm-5.2` ya está configurado en el escritorio.

Para un diagnóstico sin cambios, pide:

```text
Usa el agente ir-sentinel y diagnostica el incidente api502. No recuperes todavía.
Entrega hechos, evidence_id, hipótesis y confianza.
```

Para la recuperación completa, pide:

```text
Usa el agente ir-sentinel para diagnosticar y recuperar api502. Respeta snapshot,
validación, recarga y verificación, y termina con un postmortem breve.
```

## Dirección de la demostración

- API a través de Nginx: <http://127.0.0.1:8088/health>
- Estado técnico local: <http://127.0.0.1:3001/demo/status>
- Salud del servidor MCP: <http://127.0.0.1:3001/health>

El arranque y la reconstrucción de los contenedores se hacen una sola vez desde
Docker Desktop o por la persona responsable de infraestructura. El agente no
necesita ni recibe acceso general a Docker.

## Si OpenCode no muestra las herramientas

Dentro del directorio `api502`, ejecuta:

```bash
opencode mcp list
```

Debe aparecer `api502 connected`. Si se automatiza OpenCode desde fuera de la
sesión gráfica, usa el lanzador del entorno para cargar el secreto sin mostrarlo:

```bash
/usr/local/bin/hackathon-entrypoint opencode mcp list
```

Nunca copies la clave de Kostra a archivos del repositorio ni a mensajes.
