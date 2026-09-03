import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  inspectConfig,
  inspectService,
  readLogs,
  reloadProxy,
  restoreKnownGood,
  snapshotConfig,
  validateConfig,
  verifyRecovery,
} from "./control.js";


function toolResult(value: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createIncidentMcpServer(): McpServer {
  const server = new McpServer(
    { name: "api502-incident-tools", version: "0.1.0" },
    {
      instructions:
        "Observe and diagnose before changing state. Snapshot before restore, validate before reload, and verify after reload.",
    },
  );

  server.registerTool(
    "inspect_service",
    {
      description:
        "Compara la respuesta de Nginx con la salud directa del backend. No modifica el sistema.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => toolResult(await inspectService()),
  );

  server.registerTool(
    "read_logs",
    {
      description:
        "Devuelve una ventana acotada y deduplicada del log de errores de Nginx.",
      inputSchema: z.object({
        max_lines: z.number().int().min(1).max(200).default(30),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ max_lines }) => toolResult(await readLogs(max_lines)),
  );

  server.registerTool(
    "inspect_config",
    {
      description:
        "Inspecciona el upstream activo, redacta secretos y entrega su hash. No modifica el sistema.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => toolResult(await inspectConfig()),
  );

  server.registerTool(
    "snapshot_config",
    {
      description:
        "Crea un respaldo de la configuración activa antes de cualquier restauración.",
      inputSchema: z.object({ incident_id: z.string().min(1).max(64) }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ incident_id }) =>
      toolResult({ snapshotId: await snapshotConfig(incident_id) }),
  );

  server.registerTool(
    "restore_config",
    {
      description:
        "Restaura la configuración conocida como válida sólo si el respaldo y la política de autonomía son verificables.",
      inputSchema: z.object({
        incident_id: z.string().min(1).max(64),
        snapshot_id: z.string().min(1).max(96),
        confidence: z.number().int().min(0).max(100),
        backend_status: z.number().int(),
        root_cause: z.enum(["nginx_upstream_mismatch", "unknown"]),
        reversible: z.boolean(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) =>
      toolResult(
        await restoreKnownGood(input.incident_id, input.snapshot_id, {
          confidence: input.confidence,
          backendStatus: input.backend_status,
          rootCause: input.root_cause,
          reversible: input.reversible,
        }),
      ),
  );

  server.registerTool(
    "validate_config",
    {
      description:
        "Ejecuta nginx -t mediante el canal restringido y devuelve el resultado.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => toolResult(await validateConfig()),
  );

  server.registerTool(
    "reload_proxy",
    {
      description:
        "Revalida y recarga Nginx. Bloquea la recarga cuando nginx -t falla.",
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async () => toolResult(await reloadProxy()),
  );

  server.registerTool(
    "verify_recovery",
    {
      description:
        "Verifica que Nginx y el backend respondan 200 antes de declarar recuperación.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => toolResult(await verifyRecovery()),
  );

  return server;
}

export const mcpHandler = createMcpHandler(createIncidentMcpServer);
