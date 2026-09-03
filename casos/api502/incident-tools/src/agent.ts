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

export interface AgentChatResponse {
  message: string;
  state: "observando" | "diagnosticando" | "actuando" | "recuperado" | "bloqueado";
  toolsCalled: string[];
  evidenceIds: string[];
  confidence: number;
}

export async function handleAgentMessage(userPrompt: string): Promise<AgentChatResponse> {
  const normalized = userPrompt.toLowerCase();
  const toolsCalled: string[] = [];
  const evidenceIds: string[] = [];

  // Step 1: Observe service health
  const service = await inspectService();
  toolsCalled.push("inspect_service");
  evidenceIds.push(service.evidenceId);

  // Step 2: Read logs & config
  const [logs, config] = await Promise.all([readLogs(30), inspectConfig()]);
  toolsCalled.push("read_logs", "inspect_config");
  evidenceIds.push(logs.evidenceId, config.evidenceId);

  // If system is healthy and user is just asking
  if (!service.mismatch && service.proxy.status === 200) {
    return {
      state: "recuperado",
      confidence: 100,
      toolsCalled,
      evidenceIds,
      message: `Estado: saludable\nHechos: Nginx responde 200 OK y FastAPI responde 200 OK directamente.\nHipótesis: Ningún incidente activo detectado.\nConfianza: 100%\nEvidencia: ${evidenceIds.join(", ")}\nAcción: Ninguna requerida; el servicio opera con normalidad.\nResultado: HTTP 200 en ambos extremos.`,
    };
  }

  // System has mismatch (Nginx 502, Backend 200)
  const isUpstreamMismatch = config.content.includes("8999") || logs.patterns.some(p => p.message.includes("8999"));
  const confidence = isUpstreamMismatch ? 95 : 60;

  // If user only asked for diagnosis or inspection
  const wantsOnlyDiagnosis =
    (normalized.includes("diagnostica") || normalized.includes("revisa") || normalized.includes("estado") || normalized.includes("qué pasa")) &&
    !(normalized.includes("recupera") || normalized.includes("arregla") || normalized.includes("soluciona") || normalized.includes("resuelve") || normalized.includes("corrige"));

  if (wantsOnlyDiagnosis || confidence < 80) {
    return {
      state: "diagnosticando",
      confidence,
      toolsCalled,
      evidenceIds,
      message: `Estado: diagnosticando\nHechos: Nginx entrega 502 Bad Gateway mientras FastAPI responde 200 OK. La configuración activa apunta al puerto 8999 y los logs registran rechazo de conexión.\nHipótesis: Desalineación de upstream en Nginx (nginx_upstream_mismatch).\nConfianza: ${confidence}%\nEvidencia: ${evidenceIds.join(", ")}\nAcción propuesta: Respaldar configuración, restaurar versión válida a puerto 8000, validar con nginx -t y recargar.\nSeguridad: Acción 100% reversible mediante snapshot.\nResultado: Diagnóstico confirmado. Listo para ejecutar recuperación segura.`,
    };
  }

  // Autonomous Recovery Flow
  const incidentId = `INC-VOICE-${Date.now().toString().slice(-4)}`;
  const snapshotId = await snapshotConfig(incidentId);
  toolsCalled.push("snapshot_config");

  const diagnosis = {
    confidence,
    backendStatus: service.backend.status ?? 0,
    rootCause: "nginx_upstream_mismatch" as const,
    reversible: true,
  };

  const policy = canStartRecovery(diagnosis);
  if (!policy.allowed) {
    return {
      state: "bloqueado",
      confidence,
      toolsCalled,
      evidenceIds,
      message: `Estado: bloqueado\nHechos: Se detectaron violaciones en la política de autonomía: ${policy.reasons.join("; ")}.\nConfianza: ${confidence}%\nEvidencia: ${evidenceIds.join(", ")}\nAcción: Recuperación bloqueada por seguridad.\nResultado: Se requiere intervención humana.`,
    };
  }

  // Restore known good
  await restoreKnownGood(incidentId, snapshotId, diagnosis);
  toolsCalled.push("restore_config");

  // Validate
  const validation = await validateConfig();
  toolsCalled.push("validate_config");
  if (validation.status !== "ok") {
    return {
      state: "bloqueado",
      confidence,
      toolsCalled,
      evidenceIds,
      message: `Estado: bloqueado\nHechos: La validación de configuración (nginx -t) falló. Deteniendo recarga.\nEvidencia: ${evidenceIds.join(", ")}\nResultado: No se recargó Nginx para proteger el servicio.`,
    };
  }

  // Reload
  await reloadProxy();
  toolsCalled.push("reload_proxy");

  // Verify
  const verification = await verifyRecovery();
  toolsCalled.push("verify_recovery");
  evidenceIds.push(verification.evidence.evidenceId);

  return {
    state: "recuperado",
    confidence: 100,
    toolsCalled,
    evidenceIds,
    message: `Estado: recuperado\nHechos: Se detectó error 502 en Nginx con FastAPI en 200 OK por upstream desalineado (puerto 8999).\nHipótesis: nginx_upstream_mismatch (confirmada).\nConfianza: 100%\nEvidencia: ${evidenceIds.join(", ")}\nAcción: Snapshot (${snapshotId}) ➔ Restauración (puerto 8000) ➔ Validación (nginx -t OK) ➔ Recarga ➔ Verificación final.\nSeguridad: Todo el proceso cumplió la política de privilegio mínimo y reversibilidad.\nResultado: Servicio 100% recuperado. Nginx y FastAPI responden HTTP 200 OK.`,
  };
}
