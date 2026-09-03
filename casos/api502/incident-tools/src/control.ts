import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { compressLogLines, type CompressedLogs } from "./logs.js";
import {
  canStartRecovery,
  type RecoveryDiagnosis,
} from "./policy.js";


const controlDir = process.env.CONTROL_DIR ?? "/control";
const logDir = process.env.LOG_DIR ?? "/logs";
const scenarioDir = process.env.SCENARIO_DIR ?? "/scenarios";
const proxyUrl = process.env.PROXY_URL ?? "http://gateway/health";
const backendUrl = process.env.BACKEND_URL ?? "http://api:8000/health";

interface HttpObservation {
  url: string;
  status: number | null;
  ok: boolean;
  body: unknown;
  error: string | null;
}

export interface ServiceInspection {
  evidenceId: string;
  proxy: HttpObservation;
  backend: HttpObservation;
  mismatch: boolean;
}

export interface ConfigInspection {
  evidenceId: string;
  sha256: string;
  content: string;
}

export interface LogInspection extends CompressedLogs {
  evidenceId: string;
  requestedLines: number;
}

export interface OperationResult {
  status: "ok" | "failed";
  detail: string;
  timestamp: string;
}

function evidenceId(kind: string): string {
  return `${kind}-${randomUUID().slice(0, 8)}`;
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }
}

async function observeHttp(url: string): Promise<HttpObservation> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    const text = await response.text();
    let body: unknown = text;

    try {
      body = JSON.parse(text);
    } catch {
      // A non-JSON body is still useful evidence.
    }

    return {
      url,
      status: response.status,
      ok: response.ok,
      body,
      error: null,
    };
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function inspectService(): Promise<ServiceInspection> {
  const [proxy, backend] = await Promise.all([
    observeHttp(proxyUrl),
    observeHttp(backendUrl),
  ]);

  return {
    evidenceId: evidenceId("HEALTH"),
    proxy,
    backend,
    mismatch: proxy.status === 502 && backend.status === 200,
  };
}

function redactSecrets(content: string): string {
  return content.replace(
    /(authorization|api[_-]?key|password|secret|token)\s*[=:]\s*[^\s;]+/gi,
    "$1=[REDACTED]",
  );
}

export async function inspectConfig(): Promise<ConfigInspection> {
  const configPath = path.join(controlDir, "active-upstream.conf");
  const content = await fs.readFile(configPath, "utf8");

  return {
    evidenceId: evidenceId("CONFIG"),
    sha256: createHash("sha256").update(content).digest("hex"),
    content: redactSecrets(content).trim(),
  };
}

export async function readLogs(maxLines = 30): Promise<LogInspection> {
  const boundedLines = Math.max(1, Math.min(maxLines, 200));
  const errorLogPath = path.join(logDir, "error.log");
  let content = "";

  try {
    content = await fs.readFile(errorLogPath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const lines = content.split(/\r?\n/).filter(Boolean).slice(-boundedLines);

  return {
    evidenceId: evidenceId("LOG"),
    requestedLines: boundedLines,
    ...compressLogLines(lines),
  };
}

export async function snapshotConfig(incidentId: string): Promise<string> {
  assertSafeIdentifier(incidentId, "incidentId");
  const snapshotId = `${incidentId}-${Date.now()}`;
  const snapshotsDir = path.join(controlDir, "snapshots");
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.copyFile(
    path.join(controlDir, "active-upstream.conf"),
    path.join(snapshotsDir, `${snapshotId}.conf`),
  );
  return snapshotId;
}

export async function restoreKnownGood(
  incidentId: string,
  snapshotId: string,
  diagnosis: RecoveryDiagnosis,
): Promise<{ restored: true; policy: ReturnType<typeof canStartRecovery> }> {
  assertSafeIdentifier(incidentId, "incidentId");
  assertSafeIdentifier(snapshotId, "snapshotId");

  if (!snapshotId.startsWith(`${incidentId}-`)) {
    throw new Error("snapshot does not belong to this incident");
  }

  const snapshotPath = path.join(controlDir, "snapshots", `${snapshotId}.conf`);
  await fs.access(snapshotPath);

  const policy = canStartRecovery(diagnosis);
  if (!policy.allowed) {
    throw new Error(`recovery denied: ${policy.reasons.join("; ")}`);
  }

  const source = path.join(scenarioDir, "healthy-upstream.conf");
  const active = path.join(controlDir, "active-upstream.conf");
  const temporary = `${active}.tmp`;
  await fs.copyFile(source, temporary);
  await fs.rename(temporary, active);

  return { restored: true, policy };
}

function parseOperationResult(content: string): OperationResult {
  const values = new Map(
    content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      }),
  );

  return {
    status: values.get("status") === "ok" ? "ok" : "failed",
    detail: values.get("detail") ?? "missing detail",
    timestamp: values.get("timestamp") ?? "unknown",
  };
}

async function requestOperation(
  operation: "validate" | "reload",
): Promise<OperationResult> {
  const requestPath = path.join(controlDir, "requests", `${operation}.req`);
  const resultPath = path.join(controlDir, "results", `${operation}.status`);
  await fs.mkdir(path.dirname(requestPath), { recursive: true });
  await fs.rm(resultPath, { force: true });
  await fs.writeFile(requestPath, `${Date.now()}\n`, { flag: "wx" });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      return parseOperationResult(await fs.readFile(resultPath, "utf8"));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  throw new Error(`${operation} timed out`);
}

export async function validateConfig(): Promise<OperationResult> {
  return requestOperation("validate");
}

export async function reloadProxy(): Promise<OperationResult> {
  const validation = await validateConfig();
  if (validation.status !== "ok") {
    return {
      status: "failed",
      detail: "reload blocked because nginx validation failed",
      timestamp: validation.timestamp,
    };
  }

  return requestOperation("reload");
}

export async function verifyRecovery(): Promise<{
  recovered: boolean;
  evidence: ServiceInspection;
}> {
  let evidence = await inspectService();

  if (evidence.proxy.status !== 200 || evidence.backend.status !== 200) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    evidence = await inspectService();
  }

  return {
    recovered: evidence.proxy.status === 200 && evidence.backend.status === 200,
    evidence,
  };
}

export async function injectDemoIncident(): Promise<{
  operation: OperationResult;
  evidence: ServiceInspection;
}> {
  const source = path.join(scenarioDir, "broken-upstream.conf");
  const active = path.join(controlDir, "active-upstream.conf");
  const temporary = `${active}.tmp`;
  await fs.copyFile(source, temporary);
  await fs.rename(temporary, active);
  const operation = await reloadProxy();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const evidence = await inspectService();
    if (evidence.proxy.status === 502 && evidence.backend.status === 200) {
      return { operation, evidence };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("incident injection did not produce the expected 502 state");
}

export async function runDemoRecovery(incidentId: string): Promise<object> {
  const before = await inspectService();
  const snapshotId = await snapshotConfig(incidentId);
  const diagnosis: RecoveryDiagnosis = {
    confidence: 95,
    backendStatus: before.backend.status ?? 0,
    rootCause: before.mismatch ? "nginx_upstream_mismatch" : "unknown",
    reversible: true,
  };
  const restored = await restoreKnownGood(incidentId, snapshotId, diagnosis);
  const validation = await validateConfig();
  const reload = validation.status === "ok" ? await reloadProxy() : null;
  const verification = reload?.status === "ok" ? await verifyRecovery() : null;

  return {
    incidentId,
    before,
    diagnosis,
    snapshotId,
    restored,
    validation,
    reload,
    verification,
  };
}
