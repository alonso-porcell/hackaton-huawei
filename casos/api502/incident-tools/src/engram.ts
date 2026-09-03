import { randomUUID } from "node:crypto";

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

const memories: MemoryRecord[] = [];

function sanitize(text: string): string {
  return text
    .replace(
      /(authorization|api[_-]?key|password|secret|token|sk-|pk-)\s*[=:]\s*[^\s;,\n]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, "[REDACTED]");
}

export function recordIncident(input: RecordIncidentInput): MemoryRecord {
  const id = `mem-${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const confidence = Math.max(0, Math.min(100, input.confidence ?? 0));
  const record: MemoryRecord = {
    id,
    kind: input.kind,
    service: input.service ? sanitize(input.service) : null,
    symptom: input.symptom ? sanitize(input.symptom) : null,
    root_cause: input.root_cause ? sanitize(input.root_cause) : null,
    resolution: input.resolution ? sanitize(input.resolution) : null,
    confidence,
    verified: input.verified ?? false,
    created_at: now,
    content: sanitize(input.content),
  };
  memories.push(record);
  return record;
}

export function searchMemory(
  query: string,
  options?: { limit?: number; service?: string; kind?: string },
): SearchResult[] {
  const limit = Math.max(1, Math.min(options?.limit ?? 5, 20));
  const q = sanitize(query).toLowerCase();
  if (!q.trim()) return [];

  return memories
    .filter((m) => {
      const matches =
        m.content.toLowerCase().includes(q) ||
        (m.root_cause?.toLowerCase().includes(q) ?? false) ||
        (m.symptom?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
      if (options?.service && m.service !== options.service) return false;
      if (options?.kind && m.kind !== options.kind) return false;
      return true;
    })
    .slice(0, limit)
    .map((m, i) => ({
      id: m.id,
      kind: m.kind,
      service: m.service,
      symptom: m.symptom,
      root_cause: m.root_cause,
      confidence: m.confidence,
      verified: m.verified,
      created_at: m.created_at,
      snippet: m.content.slice(0, 120),
      rank: i,
    }));
}

export function listMemories(limit = 50): MemoryRecord[] {
  const bounded = Math.max(1, Math.min(limit, 200));
  return memories.slice(-bounded).reverse();
}

export function getMemoryById(id: string): MemoryRecord | null {
  return memories.find((m) => m.id === id) ?? null;
}

export function deleteMemory(id: string): boolean {
  const idx = memories.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  memories.splice(idx, 1);
  return true;
}

export function stats(): {
  total: number;
  verified: number;
  by_kind: Record<string, number>;
  by_service: Record<string, number>;
} {
  const by_kind: Record<string, number> = {};
  const by_service: Record<string, number> = {};
  for (const m of memories) {
    by_kind[m.kind] = (by_kind[m.kind] ?? 0) + 1;
    if (m.service) by_service[m.service] = (by_service[m.service] ?? 0) + 1;
  }
  return {
    total: memories.length,
    verified: memories.filter((m) => m.verified).length,
    by_kind,
    by_service,
  };
}
