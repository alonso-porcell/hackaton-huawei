export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>api502 Incident Dashboard — IR-Sentinel</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --text-bright: #f0f6fc;
      --accent: #58a6ff;
      --green: #3fb950;
      --green-bg: rgba(63, 185, 80, 0.15);
      --red: #f85149;
      --red-bg: rgba(248, 81, 73, 0.15);
      --yellow: #d29922;
      --yellow-bg: rgba(210, 153, 34, 0.15);
      --blue-bg: rgba(88, 166, 255, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-title h1 {
      color: var(--text-bright);
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-title p {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 4px;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      background: #21262d;
      color: var(--text-bright);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.88rem;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:hover { background: #30363d; border-color: #8b949e; }
    .btn-primary { background: #238636; border-color: rgba(240,246,252,0.1); color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-danger { background: #b62324; border-color: rgba(240,246,252,0.1); color: #fff; }
    .btn-danger:hover { background: #da3633; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
    .badge-red { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }
    .badge-yellow { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow); }
    .badge-blue { background: var(--blue-bg); color: var(--accent); border: 1px solid var(--accent); }
    .pulse {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--green);
      animation: pulse-animation 2s infinite;
    }
    @keyframes pulse-animation {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(48,54,61,0.5);
    }
    .card-header h2 {
      font-size: 1.05rem;
      color: var(--text-bright);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(48,54,61,0.3);
      font-size: 0.9rem;
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: var(--text-muted); }
    .metric-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 500; }
    .code-block {
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      margin-top: 10px;
      color: #e6edf3;
      white-space: pre-wrap;
    }
    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: #21262d;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-bar {
      height: 100%;
      background: var(--accent);
      width: 0%;
      transition: width 0.4s ease;
    }
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
    }
    .timeline-step {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.88rem;
    }
    .timeline-dot {
      width: 24px; height: 24px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: bold;
      background: #21262d; border: 1px solid var(--border); color: var(--text-muted);
    }
    .timeline-dot.done { background: var(--green-bg); border-color: var(--green); color: var(--green); }
    .timeline-dot.error { background: var(--red-bg); border-color: var(--red); color: var(--red); }
    .alert-banner {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 0.92rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .alert-danger { background: var(--red-bg); border: 1px solid var(--red); color: #ffa198; }
    .alert-success { background: var(--green-bg); border: 1px solid var(--green); color: #7ee787; }
    .log-pattern {
      background: #0d1117;
      border-left: 3px solid var(--accent);
      padding: 8px 12px;
      border-radius: 0 4px 4px 0;
      margin-bottom: 8px;
      font-size: 0.82rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .tag { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: #21262d; color: #8b949e; border: 1px solid var(--border); }
  </style>
</head>
<body>

  <header class="header">
    <div class="header-title">
      <h1>🛡️ api502 Incident Dashboard <span class="badge badge-blue"><span class="pulse"></span> LIVE</span></h1>
      <p>Supervisión y control del agente IR-Sentinel con OpenCode, Kostra (GLM-5.2) y Nginx</p>
    </div>
    <div class="header-controls">
      <button class="btn btn-danger" id="btn-inject" onclick="injectIncident()">⚡ Inyectar Escenario 502</button>
      <button class="btn btn-primary" id="btn-recover" onclick="runRecovery()">🛡️ Ejecutar Recuperación</button>
      <button class="btn" onclick="fetchStatus()">🔄 Actualizar</button>
    </div>
  </header>

  <div id="alert-container"></div>

  <div class="grid">

    <!-- Card: Estado de Salud del Servicio -->
    <div class="card">
      <div class="card-header">
        <h2>🌐 Estado de Servicios</h2>
        <span class="tag" id="evidence-health">HEALTH-N/A</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Gateway (Nginx / :8088)</span>
        <span class="metric-value" id="status-proxy"><span class="badge badge-yellow">Consultando...</span></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Backend (FastAPI / :8000)</span>
        <span class="metric-value" id="status-backend"><span class="badge badge-yellow">Consultando...</span></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Discrepancia detectada</span>
        <span class="metric-value" id="status-mismatch">-</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Endpoint de entrada</span>
        <span class="metric-value" style="font-size:0.8rem; color:var(--accent)">http://127.0.0.1:8088/health</span>
      </div>
    </div>

    <!-- Card: Configuración de Nginx -->
    <div class="card">
      <div class="card-header">
        <h2>⚙️ Configuración Upstream</h2>
        <span class="tag" id="evidence-config">CONFIG-N/A</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">SHA-256</span>
        <span class="metric-value" id="config-sha" style="font-size:0.75rem;">-</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Estado de Validación</span>
        <span class="metric-value" id="config-status"><span class="badge badge-green">nginx -t OK</span></span>
      </div>
      <div class="code-block" id="config-content">Cargando configuración activa...</div>
    </div>

    <!-- Card: Optimizador de Tokens y Logs -->
    <div class="card">
      <div class="card-header">
        <h2>📊 Reducción de Tokens / Logs</h2>
        <span class="tag" id="evidence-log">LOG-N/A</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Líneas originales analizadas</span>
        <span class="metric-value" id="log-original">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Patrones únicos consolidados</span>
        <span class="metric-value" id="log-unique">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Duplicados descartados</span>
        <span class="metric-value" id="log-discarded">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Ahorro de Contexto</span>
        <span class="metric-value" id="log-savings">0%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="log-savings-bar"></div>
      </div>
      <div style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted);">Muestra de patrones normalizados:</div>
      <div id="log-patterns-list" style="margin-top: 6px;"></div>
    </div>

    <!-- Card: Política de Autonomía -->
    <div class="card">
      <div class="card-header">
        <h2>🔒 Política de Autonomía</h2>
        <span class="badge badge-blue" id="policy-status">POLÍTICA ACTIVA</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Umbral de Confianza</span>
        <span class="metric-value">80% – 100%</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Backend Saludable</span>
        <span class="metric-value" id="policy-backend">HTTP 200 Requerido</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Causa Autorizada</span>
        <span class="metric-value">nginx_upstream_mismatch</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Acción Reversible</span>
        <span class="metric-value" style="color:var(--green)">✓ Snapshot Obligatorio</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Permisos de Terminal</span>
        <span class="metric-value" style="color:var(--yellow)">Sin docker.sock / MCP acotado</span>
      </div>
    </div>

  </div>

  <!-- Card: Línea de Tiempo de Recuperación -->
  <div class="card" id="recovery-timeline-card" style="margin-bottom: 24px;">
    <div class="card-header">
      <h2>⏱️ Flujo Atómico de Recuperación</h2>
      <span class="tag">OBSERVE → DIAGNOSE → SNAPSHOT → RESTORE → VALIDATE → RELOAD → VERIFY</span>
    </div>
    <div class="timeline" id="recovery-timeline">
      <div class="timeline-step">
        <div class="timeline-dot" id="step-1">1</div>
        <div><strong>Snapshot:</strong> Creación de respaldo seguro de configuración activa antes de cualquier escritura.</div>
      </div>
      <div class="timeline-step">
        <div class="timeline-dot" id="step-2">2</div>
        <div><strong>Restauración:</strong> Aplicación de configuración conocida como válida (<code>healthy-upstream.conf</code>).</div>
      </div>
      <div class="timeline-step">
        <div class="timeline-dot" id="step-3">3</div>
        <div><strong>Validación:</strong> Ejecución de <code>nginx -t</code> en canal restringido de control.</div>
      </div>
      <div class="timeline-step">
        <div class="timeline-dot" id="step-4">4</div>
        <div><strong>Recarga:</strong> Señal controlada de recarga a Nginx si la validación fue exitosa.</div>
      </div>
      <div class="timeline-step">
        <div class="timeline-dot" id="step-5">5</div>
        <div><strong>Verificación Final:</strong> Comprobación de HTTP 200 a través de Nginx y directamente en FastAPI.</div>
      </div>
    </div>
  </div>

  <script>
    async function fetchStatus() {
      try {
        const response = await fetch("/demo/status");
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        renderStatus(data);
      } catch (err) {
        console.error("Error fetching status:", err);
      }
    }

    function renderStatus(data) {
      const { service, config, logs } = data;

      // Evidence IDs
      document.getElementById("evidence-health").textContent = service.evidenceId || "HEALTH-N/A";
      document.getElementById("evidence-config").textContent = config.evidenceId || "CONFIG-N/A";
      document.getElementById("evidence-log").textContent = logs.evidenceId || "LOG-N/A";

      // Service Health
      const proxyStatusEl = document.getElementById("status-proxy");
      if (service.proxy.status === 200) {
        proxyStatusEl.innerHTML = '<span class="badge badge-green">200 OK</span>';
      } else if (service.proxy.status === 502) {
        proxyStatusEl.innerHTML = '<span class="badge badge-red">502 Bad Gateway</span>';
      } else {
        proxyStatusEl.innerHTML = '<span class="badge badge-yellow">' + (service.proxy.status || "ERROR") + '</span>';
      }

      const backendStatusEl = document.getElementById("status-backend");
      if (service.backend.status === 200) {
        backendStatusEl.innerHTML = '<span class="badge badge-green">200 OK</span>';
      } else {
        backendStatusEl.innerHTML = '<span class="badge badge-red">' + (service.backend.status || "ERROR") + '</span>';
      }

      const mismatchEl = document.getElementById("status-mismatch");
      const alertContainer = document.getElementById("alert-container");

      if (service.mismatch) {
        mismatchEl.innerHTML = '<span class="badge badge-red">⚠️ SÍ (502 / 200)</span>';
        alertContainer.innerHTML = '<div class="alert-banner alert-danger"><span><strong>🚨 Incidente Activo:</strong> Nginx entrega 502 Bad Gateway mientras el backend FastAPI responde 200 OK directamente. Diagnóstico: Upstream desalineado.</span> <button class="btn btn-primary" onclick="runRecovery()">Recuperar Ahora</button></div>';
      } else if (service.proxy.status === 200 && service.backend.status === 200) {
        mismatchEl.innerHTML = '<span class="badge badge-green">No (Saludable)</span>';
        alertContainer.innerHTML = '<div class="alert-banner alert-success"><span><strong>✓ Sistema Saludable:</strong> Nginx y FastAPI respondiendo HTTP 200. Todo operativo.</span></div>';
      } else {
        mismatchEl.innerHTML = '<span class="badge badge-yellow">Indeterminado</span>';
        alertContainer.innerHTML = '';
      }

      // Config
      document.getElementById("config-sha").textContent = (config.sha256 || "").slice(0, 16) + "...";
      document.getElementById("config-content").textContent = config.content || "";

      // Logs & Tokens
      const original = logs.originalCount || 0;
      const unique = logs.uniqueCount || 0;
      const discarded = logs.discardedAsDuplicates || 0;
      const savings = original > 0 ? Math.round((discarded / original) * 100) : 0;

      document.getElementById("log-original").textContent = original;
      document.getElementById("log-unique").textContent = unique;
      document.getElementById("log-discarded").textContent = discarded;
      document.getElementById("log-savings").textContent = savings + "% reducción";
      document.getElementById("log-savings-bar").style.width = savings + "%";

      const patternsList = document.getElementById("log-patterns-list");
      patternsList.innerHTML = "";
      if (logs.patterns && logs.patterns.length > 0) {
        logs.patterns.forEach(p => {
          const div = document.createElement("div");
          div.className = "log-pattern";
          div.innerHTML = '<strong>[' + p.count + 'x]</strong> ' + escapeHtml(p.message);
          patternsList.appendChild(div);
        });
      } else {
        patternsList.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">Sin patrones recientes.</div>';
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function injectIncident() {
      const btn = document.getElementById("btn-inject");
      btn.disabled = true;
      try {
        await fetch("/demo/inject", { method: "POST" });
        await fetchStatus();
      } catch (err) {
        alert("Error inyectando incidente: " + err.message);
      } finally {
        btn.disabled = false;
      }
    }

    async function runRecovery() {
      const btn = document.getElementById("btn-recover");
      btn.disabled = true;
      try {
        const res = await fetch("/demo/recover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ incidentId: "INC-DASHBOARD-" + Date.now().toString().slice(-4) })
        });
        const result = await res.json();
        
        // Highlight timeline steps
        if (result.snapshotId) document.getElementById("step-1").className = "timeline-dot done";
        if (result.restored?.restored) document.getElementById("step-2").className = "timeline-dot done";
        if (result.validation?.status === "ok") document.getElementById("step-3").className = "timeline-dot done";
        if (result.reload?.status === "ok") document.getElementById("step-4").className = "timeline-dot done";
        if (result.verification?.recovered) document.getElementById("step-5").className = "timeline-dot done";

        await fetchStatus();
      } catch (err) {
        alert("Error ejecutando recuperación: " + err.message);
      } finally {
        btn.disabled = false;
      }
    }

    fetchStatus();
    setInterval(fetchStatus, 3000);
  </script>
</body>
</html>`;
}
