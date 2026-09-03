import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderDashboardHtml(): Promise<string> {
  const candidatePaths = [
    path.join(__dirname, "dashboard.html"),
    path.join(__dirname, "../src/dashboard.html"),
    path.join(__dirname, "../../src/dashboard.html"),
    path.join(process.cwd(), "src/dashboard.html"),
    path.join(process.cwd(), "dist/src/dashboard.html"),
    "/app/src/dashboard.html",
    "/app/dist/src/dashboard.html",
  ];

  for (const candidate of candidatePaths) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // continue searching
    }
  }

  throw new Error(`dashboard.html not found in candidate paths`);
}
