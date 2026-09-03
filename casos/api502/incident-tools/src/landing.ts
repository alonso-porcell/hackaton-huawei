import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderLandingHtml(): Promise<string> {
  const candidatePaths = [
    path.join(__dirname, "landing.html"),
    path.join(__dirname, "../src/landing.html"),
    path.join(__dirname, "../../src/landing.html"),
    path.join(process.cwd(), "src/landing.html"),
    path.join(process.cwd(), "dist/src/landing.html"),
    "/app/src/landing.html",
    "/app/dist/src/landing.html",
  ];

  for (const candidate of candidatePaths) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // continue
    }
  }

  throw new Error("landing.html not found in candidate paths");
}
