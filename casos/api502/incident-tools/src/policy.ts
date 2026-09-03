export type RootCause = "nginx_upstream_mismatch" | "unknown";

export interface RecoveryDiagnosis {
  confidence: number;
  backendStatus: number;
  rootCause: RootCause;
  reversible: boolean;
}

export interface RecoveryDecision {
  allowed: boolean;
  reasons: string[];
}

export function canStartRecovery(
  diagnosis: RecoveryDiagnosis,
): RecoveryDecision {
  const reasons: string[] = [];

  if (diagnosis.confidence < 80 || diagnosis.confidence > 100) {
    reasons.push("confidence must be between 80 and 100");
  }

  if (diagnosis.backendStatus !== 200) {
    reasons.push("backend must be healthy before configuration recovery");
  }

  if (diagnosis.rootCause !== "nginx_upstream_mismatch") {
    reasons.push("root cause is outside the authorized api502 scenario");
  }

  if (!diagnosis.reversible) {
    reasons.push("recovery action must be reversible");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

