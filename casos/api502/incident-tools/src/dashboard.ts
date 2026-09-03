import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderDashboardHtml(): Promise<string> {
  const htmlPath = path.join(__dirname, "dashboard.html");
  try {
    return await fs.readFile(htmlPath, "utf8");
  } catch {
    const fallbackPath = path.join(__dirname, "../src/dashboard.html");
    return await fs.readFile(fallbackPath, "utf8");
  }
}
