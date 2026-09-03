import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { promises as fs, existsSync, mkdirSync } from "node:fs";
import path from "node:path";


const engramDir = process.env.ENGRAM_DIR ?? path.join(process.cwd(), ".engram");
const dbPath = path.join(engramDir, "engram.db");

let db: DatabaseSync | null = null;

function redactSecrets(text: string): string {
  return text
    .replace(
      /(authorization|api[_-]?key|password|secret|token|sk-|pk-)\s*[=:]\s*[^\s;,\n]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, "[REDACTED]");
}

function stripInstructions(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "[CODE_BLOCK_REMOVED]");
}

function sanitize(text: string): string {
  return stripInstructions(redactSecrets(text));
}

function getDb(): DatabaseSync {
  if (db) return db;

  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      service TEXT,
      symptom TEXT,
      root_cause TEXT,
      resolution TEXT,
      confidence INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      content TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      service,
      symptom,
      root_cause,
      content='memories',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, service, symptom, root_cause)
      VALUES (new.rowid, new.content, new.service, new.symptom, new.root_cause);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, service, symptom, root_cause)
      VALUES ('delete', old.rowid, old.content, old.service, old.symptom, old.root_cause);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, service, symptom, root_cause)
      VALUES ('delete', old.rowid, old.content, old.service, old.symptom, old.root_cause);
      INSERT INTO memories_fts(rowid, content, service, symptom, root_cause)
      VALUES (new.rowid, new.content, new.service, new.symptom, new.root_cause);
    END;
  `);

  return db;
}

export interface MemoryRecord {
  id: string;
  kind: string;
  service: string | null;
  symptom: string | null;
  root_cause: string | null;
  resolution: string | null;
  confidence: number;
  verified: boolean;
  created_at: string;
  content: string;
}

export interface RecordIncidentInput {
  kind: string;
  service?: string;
  symptom?: string;
  root_cause?: string;
  resolution?: string;
  confidence?: number;
  verified?: boolean;
  content: string;
}

export interface SearchResult {
  id: string;
  kind: string;
  service: string | null;
  symptom: string | null;
  root_cause: string | null;
  confidence: number;
  verified: boolean;
  created_at: string;
  snippet: string;
  rank: number;
}

function rowToMemory(row: unknown): MemoryRecord {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    kind: String(r.kind),
    service: r.service ? String(r.service) : null,
    symptom: r.symptom ? String(r.symptom) : null,
    root_cause: r.root_cause ? String(r.root_cause) : null,
    resolution: r.resolution ? String(r.resolution) : null,
    confidence: Number(r.confidence),
    verified: Number(r.verified) === 1,
    created_at: String(r.created_at),
    content: String(r.content),
  };
}

export function recordIncident(input: RecordIncidentInput): MemoryRecord {
  const db = getDb();
  const id = `mem-${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const confidence = Math.max(0, Math.min(100, input.confidence ?? 0));
  const verified = input.verified ? 1 : 0;
  const safeContent = sanitize(input.content);
  const safeService = input.service ? sanitize(input.service) : null;
  const safeSymptom = input.symptom ? sanitize(input.symptom) : null;
  const safeRootCause = input.root_cause ? sanitize(input.root_cause) : null;
  const safeResolution = input.resolution ? sanitize(input.resolution) : null;

  const stmt = db.prepare(`
    INSERT INTO memories (id, kind, service, symptom, root_cause, resolution, confidence, verified, created_at, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.kind,
    safeService,
    safeSymptom,
    safeRootCause,
    safeResolution,
    confidence,
    verified,
    now,
    safeContent,
  );

  return {
    id,
    kind: input.kind,
    service: safeService,
    symptom: safeSymptom,
    root_cause: safeRootCause,
    resolution: safeResolution,
    confidence,
    verified: verified === 1,
    created_at: now,
    content: safeContent,
  };
}

export function searchMemory(
  query: string,
  options?: { limit?: number; service?: string; kind?: string },
): SearchResult[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(options?.limit ?? 5, 20));
  const safeQuery = sanitize(query);

  if (!safeQuery.trim()) return [];

  let sql = `
    SELECT
      m.id, m.kind, m.service, m.symptom, m.root_cause,
      m.confidence, m.verified, m.created_at,
      snippet(memories_fts, 0, '[', ']', '...', 32) AS snippet,
      rank
    FROM memories_fts f
    JOIN memories m ON m.rowid = f.rowid
    WHERE memories_fts MATCH ?
  `;
  const params: unknown[] = [safeQuery];

  if (options?.service) {
    sql += ` AND m.service = ?`;
    params.push(options.service);
  }
  if (options?.kind) {
    sql += ` AND m.kind = ?`;
    params.push(options.kind);
  }

  sql += ` ORDER BY rank ASC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    service: r.service ? String(r.service) : null,
    symptom: r.symptom ? String(r.symptom) : null,
    root_cause: r.root_cause ? String(r.root_cause) : null,
    confidence: Number(r.confidence),
    verified: Number(r.verified) === 1,
    created_at: String(r.created_at),
    snippet: String(r.snippet),
    rank: Number(r.rank),
  }));
}

export function listMemories(limit = 50): MemoryRecord[] {
  const db = getDb();
  const bounded = Math.max(1, Math.min(limit, 200));
  const stmt = db.prepare(`
    SELECT * FROM memories ORDER BY created_at DESC LIMIT ?
  `);
  return (stmt.all(bounded) as Record<string, unknown>[]).map(rowToMemory);
}

export function getMemoryById(id: string): MemoryRecord | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM memories WHERE id = ?`);
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? rowToMemory(row) : null;
}

export function deleteMemory(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM memories WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function stats(): {
  total: number;
  verified: number;
  by_kind: Record<string, number>;
  by_service: Record<string, number>;
} {
  const db = getDb();
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM memories`).get() as {
    c: number;
  };
  const verifiedRow = db.prepare(
    `SELECT COUNT(*) AS c FROM memories WHERE verified = 1`,
  ).get() as { c: number };
  const kindRows = db.prepare(
    `SELECT kind, COUNT(*) AS c FROM memories GROUP BY kind`,
  ).all() as { kind: string; c: number }[];
  const serviceRows = db.prepare(
    `SELECT service, COUNT(*) AS c FROM memories WHERE service IS NOT NULL GROUP BY service`,
  ).all() as { service: string; c: number }[];

  return {
    total: totalRow.c,
    verified: verifiedRow.c,
    by_kind: Object.fromEntries(kindRows.map((r) => [r.kind, r.c])),
    by_service: Object.fromEntries(serviceRows.map((r) => [r.service, r.c])),
  };
}
