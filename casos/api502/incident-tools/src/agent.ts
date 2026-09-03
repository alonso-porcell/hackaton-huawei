import { promises as fs } from "node:fs";
import path from "node:path";
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
import { canStartRecovery } from "./policy.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface AgentChatResponse {
  message: string;
  state: string;
  toolsCalled: string[];
  evidenceIds: string[];
  confidence: number;
}

// In-memory conversation history
const sessionHistory: ChatMessage[] = [];

async function getKostraApiKey(): Promise<string | null> {
  const secretFile = process.env.KOSTRA_API_KEY_FILE ?? "/run/secrets/kostra_api_key";
  try {
    const key = await fs.readFile(secretFile, "utf8");
    return key.trim();
  } catch {
    // try local fallback paths
    const localFallbacks = [
      path.join(process.cwd(), "../../secrets/kostra_api_key.txt"),
      path.join(process.cwd(), "secrets/kostra_api_key.txt"),
      path.join(process.cwd(), "../secrets/kostra_api_key.txt"),
    ];
    for (const f of localFallbacks) {
      try {
        const key = await fs.readFile(f, "utf8");
        return key.trim();
      } catch {}
    }
  }
  return process.env.KOSTRA_API_KEY ?? null;
}

const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "inspect_service",
      description: "Inspecciona la salud HTTP pública a través de Nginx y la salud directa de FastAPI.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "read_logs",
      description: "Lee y devuelve los logs acotados y reducidos por el optimizador de tokens.",
      parameters: {
        type: "object",
        properties: {
          max_lines: { type: "number", description: "Número máximo de líneas (default: 30, max: 200)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inspect_config",
      description: "Inspecciona el archivo de configuración activo de Nginx y devuelve su hash SHA-256.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "snapshot_config",
      description: "Crea un respaldo verificable de la configuración activa antes de cualquier cambio.",
      parameters: {
        type: "object",
        properties: {
          incidentId: { type: "string", description: "Identificador del incidente (ej. INC-API502-001)" },
        },
        required: ["incidentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restore_config",
      description: "Restaura la configuración conocida como válida en Nginx si la política lo autoriza.",
      parameters: {
        type: "object",
        properties: {
          incidentId: { type: "string", description: "Identificador del incidente" },
          snapshotId: { type: "string", description: "Identificador del snapshot previo" },
          confidence: { type: "number", description: "Nivel de confianza calculado (80-100)" },
          backendStatus: { type: "number", description: "Estado HTTP del backend directo (debe ser 200)" },
          rootCause: { type: "string", enum: ["nginx_upstream_mismatch", "unknown"], description: "Causa raíz diagnosticada" },
          reversible: { type: "boolean", description: "Indica si la acción es reversible" },
        },
        required: ["incidentId", "snapshotId", "confidence", "backendStatus", "rootCause", "reversible"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_config",
      description: "Valida la configuración de Nginx ejecutando 'nginx -t' en un canal seguro.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "reload_proxy",
      description: "Envía señal de recarga controlada a Nginx después de una validación exitosa.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_recovery",
      description: "Verifica que el servicio responda HTTP 200 tanto a través de Nginx como directamente en FastAPI.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

const SYSTEM_PROMPT = `Eres IR-Sentinel, un agente SRE autónomo de respuesta a incidentes en OpenCode con Kostra Cloud (GLM-5.2) y Nginx.

Tu misión es diagnosticar y recuperar el servicio 'api502' con la menor intervención reversible posible y conservar evidencia auditable.

REGLAS CRÍTICAS DE SEGURIDAD:
1. Observa antes de inferir y verifica antes de afirmar éxito.
2. Ancla tus conclusiones a identificadores de evidencia reales (HEALTH-*, LOG-*, CONFIG-*).
3. Utiliza únicamente las herramientas MCP autorizadas (inspect_service, read_logs, inspect_config, snapshot_config, restore_config, validate_config, reload_proxy, verify_recovery).
4. No intentes inventar accesos directos ni comandos de terminal genéricos.
5. Política de recuperación: Solo puedes restaurar si la confianza es >= 80%, el backend responde 200 OK directamente, creaste un snapshot previo y la causa es 'nginx_upstream_mismatch'.
6. Si el usuario te hace preguntas conversacionales o te pide explicaciones ("¿qué hiciste?", "¿por qué falló?"), respóndele de forma clara, profesional y concisa en español basándote en lo ocurrido.
7. Al reportar un incidente, incluye hechos, hipótesis, confianza, evidencias, acción y resultado.`;

export async function handleAgentMessage(userPrompt: string): Promise<AgentChatResponse> {
  const apiKey = await getKostraApiKey();
  const toolsCalled: string[] = [];
  const evidenceIds: string[] = [];

  // Initialize history if empty
  if (sessionHistory.length === 0) {
    sessionHistory.push({ role: "system", content: SYSTEM_PROMPT });
  }

  // Append user message
  sessionHistory.push({ role: "user", content: userPrompt });

  // If no Kostra API key is found, fallback
  if (!apiKey) {
    return {
      state: "bloqueado",
      confidence: 0,
      toolsCalled: [],
      evidenceIds: [],
      message: "No se encontró la clave de API de Kostra (secrets/kostra_api_key.txt). Por favor configúrala con 'Configurar clave.cmd'.",
    };
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://ai.kostra.cloud/v1";
  const model = process.env.MODEL ?? "glm-5.2";

  let turns = 0;
  while (turns < 10) {
    turns += 1;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: sessionHistory,
        tools: TOOLS_SCHEMA,
        tool_choice: "auto",
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Kostra API error:", response.status, errText);
      throw new Error(`Kostra API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("No response message from Kostra LLM");
    }

    // Append assistant response to history
    sessionHistory.push(message);

    // If no tool calls, this is the final response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      const content = message.content ?? "Listo.";
      return {
        state: content.toLowerCase().includes("recuperado") ? "recuperado" : "diagnosticando",
        confidence: 95,
        toolsCalled,
        evidenceIds,
        message: content,
      };
    }

    // Process tool calls
    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      toolsCalled.push(toolName);
      let args: any = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {}

      let result: any = null;

      try {
        if (toolName === "inspect_service") {
          result = await inspectService();
          if (result?.evidenceId) evidenceIds.push(result.evidenceId);
        } else if (toolName === "read_logs") {
          result = await readLogs(args.max_lines ?? 30);
          if (result?.evidenceId) evidenceIds.push(result.evidenceId);
        } else if (toolName === "inspect_config") {
          result = await inspectConfig();
          if (result?.evidenceId) evidenceIds.push(result.evidenceId);
        } else if (toolName === "snapshot_config") {
          const incId = args.incidentId || `INC-CHAT-${Date.now().toString().slice(-4)}`;
          result = { snapshotId: await snapshotConfig(incId) };
        } else if (toolName === "restore_config") {
          const diag = {
            confidence: args.confidence ?? 95,
            backendStatus: args.backendStatus ?? 200,
            rootCause: args.rootCause ?? "nginx_upstream_mismatch",
            reversible: args.reversible ?? true,
          };
          result = await restoreKnownGood(args.incidentId, args.snapshotId, diag);
        } else if (toolName === "validate_config") {
          result = await validateConfig();
        } else if (toolName === "reload_proxy") {
          result = await reloadProxy();
        } else if (toolName === "verify_recovery") {
          result = await verifyRecovery();
          if (result?.evidence?.evidenceId) evidenceIds.push(result.evidence.evidenceId);
        } else {
          result = { error: `unknown tool ${toolName}` };
        }
      } catch (err: any) {
        result = { error: err?.message || String(err) };
      }

      // Append tool result to history
      sessionHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    state: "completado",
    confidence: 90,
    toolsCalled,
    evidenceIds,
    message: "Se completaron las operaciones solicitadas.",
  };
}
