export interface LogPattern {
  message: string;
  count: number;
}

export interface CompressedLogs {
  originalCount: number;
  uniqueCount: number;
  discardedAsDuplicates: number;
  patterns: LogPattern[];
}

function normalizeLogLine(rawLine: string): string {
  return rawLine
    .trim()
    .replace(
      /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+\[[^\]]+\]\s+\d+#\d+:\s+\*\d+\s+/,
      "",
    )
    .replace(/client: [^,]+/g, "client: <client>")
    .replace(
      /http:\/\/(?:\d{1,3}\.){3}\d{1,3}:(\d+)/g,
      "http://<upstream>:$1",
    )
    .replace(/host: "[^"]+"/g, 'host: "<host>"');
}

export function compressLogLines(
  lines: string[],
  maxPatterns = 30,
): CompressedLogs {
  const counts = new Map<string, number>();

  for (const rawLine of lines) {
    const message = normalizeLogLine(rawLine);
    if (!message) {
      continue;
    }

    counts.set(message, (counts.get(message) ?? 0) + 1);
  }

  const patterns = Array.from(counts, ([message, count]) => ({ message, count }))
    .slice(0, Math.max(0, maxPatterns));

  return {
    originalCount: lines.filter((line) => line.trim()).length,
    uniqueCount: counts.size,
    discardedAsDuplicates:
      lines.filter((line) => line.trim()).length - counts.size,
    patterns,
  };
}
