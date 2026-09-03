import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderPipelineDashboardHtml(): Promise<string> {
  const candidatePaths = [
    path.join(__dirname, "pipeline-dashboard.html"),
    path.join(__dirname, "../src/pipeline-dashboard.html"),
    path.join(__dirname, "../../src/pipeline-dashboard.html"),
    path.join(process.cwd(), "src/pipeline-dashboard.html"),
    path.join(process.cwd(), "dist/src/pipeline-dashboard.html"),
    "/app/src/pipeline-dashboard.html",
    "/app/dist/src/pipeline-dashboard.html",
  ];

  for (const candidate of candidatePaths) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // continue
    }
  }

  throw new Error("pipeline-dashboard.html not found in candidate paths");
}
