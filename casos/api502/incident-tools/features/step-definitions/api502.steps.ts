import assert from "node:assert/strict";

import { After, Given, Then, When } from "@cucumber/cucumber";


const toolsUrl = process.env.TOOLS_URL ?? "http://127.0.0.1:3001";
let injected: Record<string, any> | null = null;
let recovery: Record<string, any> | null = null;

async function requestJson(path: string, method = "GET", body?: object) {
  const response = await fetch(`${toolsUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  assert.equal(response.ok, true, `${method} ${path} returned ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}

Given("que el proxy y el backend están saludables", async function () {
  let status = await requestJson("/demo/status");

  if (status.service.proxy.status !== 200) {
    await requestJson("/demo/recover", "POST", {
      incidentId: "INC-CUCUMBER-SETUP",
    });
    status = await requestJson("/demo/status");
  }

  assert.equal(status.service.proxy.status, 200);
  assert.equal(status.service.backend.status, 200);
});

When("se inyecta una configuración de upstream incorrecta", async function () {
  injected = await requestJson("/demo/inject", "POST");
});

Then(
  "Nginx responde 502 y el backend directo responde 200",
  function () {
    assert.equal(injected?.evidence.proxy.status, 502);
    assert.equal(injected?.evidence.backend.status, 200);
    assert.equal(injected?.evidence.mismatch, true);
  },
);

When("se ejecuta la recuperación segura del incidente", async function () {
  recovery = await requestJson("/demo/recover", "POST", {
    incidentId: "INC-CUCUMBER-API502",
  });
});

Then("se crea un respaldo antes de restaurar", function () {
  assert.match(recovery?.snapshotId ?? "", /^INC-CUCUMBER-API502-\d+$/);
  assert.equal(recovery?.restored.restored, true);
  assert.equal(recovery?.restored.policy.allowed, true);
});

Then("la configuración se valida antes de recargar Nginx", function () {
  assert.equal(recovery?.validation.status, "ok");
  assert.equal(recovery?.reload.status, "ok");
});

Then("el proxy y el backend vuelven a responder 200", function () {
  assert.equal(recovery?.verification.recovered, true);
  assert.equal(recovery?.verification.evidence.proxy.status, 200);
  assert.equal(recovery?.verification.evidence.backend.status, 200);
});

After(async function () {
  const status = await requestJson("/demo/status");
  if (status.service.proxy.status === 502) {
    await requestJson("/demo/recover", "POST", {
      incidentId: "INC-CUCUMBER-CLEANUP",
    });
  }
  injected = null;
  recovery = null;
});

