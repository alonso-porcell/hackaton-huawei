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
import { generateEmotionalResponse } from "./emotional-handler.js";
import { recordIncident, searchMemory } from "./engram.js";


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

  server.registerTool(
    "emotional_response",
    {
      description:
        "Genera una respuesta emocional adaptada al arquetipo del usuario (SOUL.md S3+S4). Usa el disparador de personalidad y la matriz de exposición temporal para adaptar tono y contenido.",
      inputSchema: z.object({
        error: z.string().min(1).max(500).describe("Mensaje de error técnico"),
        user_message: z.string().min(1).max(1000).describe("Mensaje del usuario para detectar arquetipo"),
        retry_count: z.number().int().min(1).max(100).default(1).describe("Número de reintento (1=incipiente, 3-5=friccion, >5=cronica)"),
        platform_tone: z.enum(["creative", "corporate"]).default("creative").describe("Tono de plataforma"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input) =>
      toolResult(
        await generateEmotionalResponse({
          error: input.error,
          userMessage: input.user_message,
          retryCount: input.retry_count,
          platformTone: input.platform_tone,
        }),
      ),
  );

  server.registerTool(
    "search_memory",
    {
      description:
        "Busca incidentes similares en la memoria persistente de Engram (SQLite/FTS5). Devuelve como máximo 5 recuerdos relevantes con metadatos de procedencia.",
      inputSchema: z.object({
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(20).default(5),
        service: z.string().optional(),
        kind: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ query, limit, service, kind }) =>
      toolResult({
        query,
        results: searchMemory(query, { limit, service, kind }),
      }),
  );

  server.registerTool(
    "record_incident",
    {
      description:
        "Registra un aprendizaje verificado y sanitizado en Engram. Sólo conclusiones confirmadas; los secretos se redactan automáticamente.",
      inputSchema: z.object({
        kind: z
          .enum([
            "incident",
            "root_cause",
            "mitigation",
            "lesson",
            "inconsistency",
            "audit",
          ])
          .describe("Tipo de aprendizaje registrado"),
        service: z.string().optional(),
        symptom: z.string().optional(),
        root_cause: z.string().optional(),
        resolution: z.string().optional(),
        confidence: z.number().int().min(0).max(100).default(0),
        verified: z.boolean().default(false),
        content: z.string().min(1).max(5000),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => toolResult({ recorded: recordIncident(input) }),
  );

  return server;
}

export const mcpHandler = createMcpHandler(createIncidentMcpServer);
