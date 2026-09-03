import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canStartRecovery } from "../src/policy.js";


describe("canStartRecovery", () => {
  const safeDiagnosis = {
    confidence: 87,
    backendStatus: 200,
    rootCause: "nginx_upstream_mismatch" as const,
    reversible: true,
  };

  it("authorizes a reversible and well-supported recovery", () => {
    assert.deepEqual(canStartRecovery(safeDiagnosis), {
      allowed: true,
      reasons: [],
    });
  });

  it("rejects confidence below 80 percent", () => {
    const decision = canStartRecovery({ ...safeDiagnosis, confidence: 79 });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /confidence/i);
  });

  it("accepts the inclusive confidence boundaries", () => {
    assert.equal(canStartRecovery({ ...safeDiagnosis, confidence: 80 }).allowed, true);
    assert.equal(canStartRecovery({ ...safeDiagnosis, confidence: 100 }).allowed, true);
  });

  it("rejects confidence above 100 percent", () => {
    const decision = canStartRecovery({ ...safeDiagnosis, confidence: 101 });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /confidence/i);
  });

  it("rejects recovery when the backend is not healthy", () => {
    const decision = canStartRecovery({ ...safeDiagnosis, backendStatus: 503 });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /backend/i);
  });

  it("rejects a diagnosis outside the api502 scenario", () => {
    const decision = canStartRecovery({
      ...safeDiagnosis,
      rootCause: "unknown",
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /root cause/i);
  });

  it("rejects an irreversible action", () => {
    const decision = canStartRecovery({ ...safeDiagnosis, reversible: false });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /reversible/i);
  });

  it("rejects recovery when backend status is 0 or unreachable (incomplete telemetry)", () => {
    const decision = canStartRecovery({ ...safeDiagnosis, backendStatus: 0 });

    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /backend must be healthy/i);
  });

  it("rejects recovery and aggregates all reasons when multiple conditions fail simultaneously", () => {
    const decision = canStartRecovery({
      confidence: 45,
      backendStatus: 500,
      rootCause: "unknown",
      reversible: false,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reasons.length, 4);
    assert.match(decision.reasons.join(" "), /confidence/i);
    assert.match(decision.reasons.join(" "), /backend/i);
    assert.match(decision.reasons.join(" "), /root cause/i);
    assert.match(decision.reasons.join(" "), /reversible/i);
  });
});
