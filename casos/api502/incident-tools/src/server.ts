import express from "express";
import { hostHeaderValidation } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { SSEServerTransport } from "@modelcontextprotocol/server-legacy/sse";

import { handleAgentMessage } from "./agent.js";
import {
  injectDemoIncident,
  inspectConfig,
  inspectService,
  readLogs,
  runDemoRecovery,
} from "./control.js";
import { renderDashboardHtml } from "./dashboard.js";
import { createIncidentMcpServer, mcpHandler } from "./mcp.js";
import { adaptiveEmotionalHandler } from "./emotional-handler.js";
import {
  deleteMemory,
  listMemories,
  recordIncident,
  searchMemory,
  stats as engramStats,
} from "./engram.js";


const port = Number(process.env.PORT ?? 3001);
const app = express();
const legacyTransports = new Map<string, SSEServerTransport>();

app.use(
  hostHeaderValidation([
    "127.0.0.1",
    "localhost",
    "host.docker.internal",
    "incident-tools",
  ]),
);
app.use(express.json());

app.get("/", async (_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.send(await renderDashboardHtml());
});

app.get("/dashboard", async (_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.send(await renderDashboardHtml());
});

app.post("/api/chat", async (request, response, next) => {
  try {
    const prompt = String(request.body?.message ?? "");
    if (!prompt.trim()) {
      response.status(400).json({ error: "message is required" });
      return;
    }
    const result = await handleAgentMessage(prompt);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "api502-incident-tools" });
});

app.get("/demo/status", async (_request, response, next) => {
  try {
    response.json({
      service: await inspectService(),
      config: await inspectConfig(),
      logs: await readLogs(30),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/demo/inject", async (_request, response, next) => {
  try {
    response.json(await injectDemoIncident());
  } catch (error) {
    next(error);
  }
});

app.post("/demo/recover", async (request, response, next) => {
  try {
    const incidentId = String(request.body?.incidentId ?? "INC-API502-DEMO");
    response.json(await runDemoRecovery(incidentId));
  } catch (error) {
    next(error);
  }
});

app.get("/mcp", async (_request, response, next) => {
  try {
    const transport = new SSEServerTransport("/messages", response);
    legacyTransports.set(transport.sessionId, transport);
    response.on("close", () => {
      legacyTransports.delete(transport.sessionId);
    });
    await createIncidentMcpServer().connect(transport);
  } catch (error) {
    next(error);
  }
});

app.post("/messages", async (request, response) => {
  const sessionId = String(request.query.sessionId ?? "");
  const transport = legacyTransports.get(sessionId);

  if (!transport) {
    response.status(400).json({ error: "unknown MCP session" });
    return;
  }

  await transport.handlePostMessage(request, response, request.body);
});

app.post("/mcp", toNodeHandler(mcpHandler));
app.delete("/mcp", toNodeHandler(mcpHandler));

app.get("/engram/search", (request, response, next) => {
  try {
    const query = String(request.query.q ?? "");
    if (!query.trim()) {
      response.status(400).json({ error: "q parameter is required" });
      return;
    }
    const limit = Number(request.query.limit ?? 5);
    const service = request.query.service
      ? String(request.query.service)
      : undefined;
    const kind = request.query.kind ? String(request.query.kind) : undefined;
    response.json({
      query,
      results: searchMemory(query, { limit, service, kind }),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/engram/record", (request, response, next) => {
  try {
    const body = request.body ?? {};
    if (!body.content || !body.kind) {
      response.status(400).json({ error: "kind and content are required" });
      return;
    }
    response.json({ recorded: recordIncident(body) });
  } catch (error) {
    next(error);
  }
});

app.get("/engram/memories", (request, response, next) => {
  try {
    const limit = Number(request.query.limit ?? 50);
    response.json({ memories: listMemories(limit) });
  } catch (error) {
    next(error);
  }
});

app.get("/engram/stats", (_request, response, next) => {
  try {
    response.json(engramStats());
  } catch (error) {
    next(error);
  }
});

app.delete("/engram/memories/:id", (request, response, next) => {
  try {
    const id = String(request.params.id);
    response.json({ deleted: deleteMemory(id) });
  } catch (error) {
    next(error);
  }
});

app.use(
  async (
    error: unknown,
    request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    await adaptiveEmotionalHandler(error, request, response);
  },
);

app.listen(port, "0.0.0.0", () => {
  console.log(`api502 incident tools listening on ${port}`);
});
