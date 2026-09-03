import { promises as fs } from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────
// SOUL.md Sección 3 — Matriz de Exposición Temporal
// ─────────────────────────────────────────────────────────────

export interface ExposureLevel {
  level: 1 | 2 | 3;
  label: "incipiente" | "friccion" | "cronica";
  range: string;
  diagnosis: string;
  intervention: string;
}

const EXPOSURE_LEVELS: readonly ExposureLevel[] = [
  {
    level: 1,
    label: "incipiente",
    range: "Intento 1-2 | < 10 min",
    diagnosis: "Error accidental, sintaxis o configuración fresca.",
    intervention: "Respuesta ultra-corta (máximo 3 líneas).",
  },
  {
    level: 2,
    label: "friccion",
    range: "Intento 3-5 | 15-45 min",
    diagnosis: "Visión de túnel del operador. Insiste en la misma solución.",
    intervention: "Romper el anclaje cognitivo. Obligar a mirar dependencias colaterales.",
  },
  {
    level: 3,
    label: "cronica",
    range: "> 5 intentos | > 1 hora",
    diagnosis: "Fatiga cognitiva severa, acumulación de parches fallidos.",
    intervention: "Freno de mano y reseteo de baseline.",
  },
] as const;

export function getExposureLevel(retryCount: number): ExposureLevel {
  if (retryCount <= 2) return EXPOSURE_LEVELS[0]!;
  if (retryCount <= 5) return EXPOSURE_LEVELS[1]!;
  return EXPOSURE_LEVELS[2]!;
}

// ─────────────────────────────────────────────────────────────
// SOUL.md Sección 4 — Disparador de Personalidad
// ─────────────────────────────────────────────────────────────

export type ArchetypeKey =
  | "colapsado"
  | "hostil"
  | "novato"
  | "senior"
  | "impaciente"
  | "culposo";

export interface Archetype {
  signals: readonly string[];
  capsSignals?: boolean;
  repetitionSignals?: boolean;
  needs: string;
  tone: string;
  promptDirective: string;
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  colapsado: {
    signals: ["llevo horas", "rompí todo", "rompi todo", "no sirve nada", "nada funciona", "me rindo", "ayuda", "socorro"],
    capsSignals: true,
    repetitionSignals: true,
    needs: "Quitar culpa + 1 sola acción",
    tone: "Sereno, directo, paternal sin ser condescendiente",
    promptDirective: `El usuario está colapsado emocionalmente.
PRIMERA FRASE: quitar la culpa explícitamente ("No rompiste nada" / "No es tu culpa").
CUERPO: una sola acción concreta con un comando o paso.
TONO: sereno, firme, como un colega senior que ha visto esto mil veces.
NO usar lenguaje de terapia. NO decir "entiendo cómo te sientes".
CIERRE: "Aquí me quedo contigo" o equivalente breve.`,
  },
  hostil: {
    signals: ["basura", "otra vez", "porquería", "porqueria", "mierda", "inútil", "inutil", "nunca funciona", "siempre falla", "patético", "patetico"],
    needs: "Validar la frustración + solución, sin disculparse corporate",
    tone: "Seco, honesto, sin corporate-speak",
    promptDirective: `El usuario está hostil y frustrado con el sistema.
PRIMERA FRASE: validar su frustración sin ser servil ("Tenés razón en estar frustrado").
NO disculparse con lenguaje corporate ("Sentimos las molestias" está PROHIBIDO).
CUERPO: causa real en una línea + una acción.
TONO: seco, honesto, directo. Reconocer que el sistema falló, no pedir perdón.
CIERRE: compromiso de arreglarlo de raíz, no parche temporal.`,
  },
  novato: {
    signals: ["no entiendo", "qué significa", "que significa", "soy nuevo", "primera vez", "no sé", "no se", "cómo funciona", "como funciona", "ayuda por favor"],
    needs: "Explicar simple + contexto mínimo",
    tone: "Didáctico, paciente, paso a paso",
    promptDirective: `El usuario es novato y está perdido.
PRIMERA FRASE: absolver de culpa y normalizar el error.
CUERPO: explicar qué pasó en lenguaje simple, sin jerga. Una analogía breve si ayuda.
ACCIÓN: un solo paso claro que pueda seguir sin conocimiento previo.
TONO: didáctico, paciente, como un mentor amable pero conciso.
NO asumir conocimiento técnico. NO usar siglas sin explicar.`,
  },
  senior: {
    signals: ["traceback", "stack trace", "stacktrace", "pool", "gateway", "timeout", "null pointer", "nullpointer", "segfault", "race condition", "deadlock", "heap", "gc", "oom", "pnpm", "npm", "docker", "kubectl"],
    needs: "Profundidad, sin hand-holding",
    tone: "Par, conciso, técnico",
    promptDirective: `El usuario es técnico y sabe lo que hace.
NO quitar culpa con lenguaje suave — ir directo al diagnóstico.
CUERPO: causa técnica precisa, comando de diagnóstico, siguiente paso técnico.
TONO: par a par, conciso, sin hand-holding. Como hablar con otro senior.
Se puede usar jerga técnica libremente. Máxima densidad informativa.`,
  },
  impaciente: {
    signals: ["cuánto tarda", "cuanto tarda", "urgente", "estamos perdiendo", "perdiendo dinero", "ya", "rápido", "rapido", "deadline", "stakeholder", "producción", "produccion"],
    needs: "ETA + impacto de negocio, cero tecnicismos",
    tone: "Ejecutivo, orientado a tiempo",
    promptDirective: `El usuario es un PM/CEO/stakeholder bajo presión de tiempo.
PRIMERA FRASE: ETA directa ("2 minutos" / "15 minutos").
CUERPO: impacto de negocio en una línea (qué sigue funcionando, qué no).
NO tecnicismos. NO explicaciones de causa técnica.
TONO: ejecutivo, orientado a acción y resultado.
CIERRE: qué va a pasar automáticamente cuando se resuelva.`,
  },
  culposo: {
    signals: ["¿fui yo?", "fui yo", "lo hice mal", "me equivoqué", "me equivoque", "mi culpa", "la arruiné", "la arruine", "¿rompí", "rompi", "soy un desastre", "no sirvo para esto"],
    needs: "Absolver explícitamente + confirmar que el sistema no está dañado",
    tone: "Cálido, breve, firme en la absolución",
    promptDirective: `El usuario se siente culpable y ansioso.
PRIMERA FRASE: absolución explícita e inequívoca ("No fue tu culpa" / "No rompiste nada").
CUERPO: confirmar que el sistema no está dañado permanentemente y los datos están intactos.
TONO: cálido pero breve. Firme en la absolución, no condescendiente.
NO alargar la respuesta. La ansiedad se calma con certeza, no con párrafos.`,
  },
};

export function detectArchetype(userMessage: string): ArchetypeKey | null {
  const lower = userMessage.toLowerCase();
  const words = lower.split(/\s+/);
  const hasRepetition = words.length > 3 && new Set(words).size < words.length * 0.6;
  const hasCaps = userMessage.length > 10 && (userMessage.match(/[A-Z]/g) ?? []).length > userMessage.length * 0.3;

  let bestMatch: ArchetypeKey | null = null;
  let bestScore = 0;

  for (const [key, archetype] of Object.entries(ARCHETYPES) as [ArchetypeKey, Archetype][]) {
    let score = 0;

    for (const signal of archetype.signals) {
      if (lower.includes(signal)) score += 2;
    }

    if (archetype.capsSignals && hasCaps) score += 1;
    if (archetype.repetitionSignals && hasRepetition) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

function getArchetypeDirective(archetypeKey: ArchetypeKey | null): string {
  if (!archetypeKey) {
    return `El usuario no muestra señales claras de un arquetipo específico.
Usar el tono base: colega senior de guardia. Pragmático, directo, sereno.
Quitar culpa en la primera frase. Una acción clara. Máximo 3 líneas.`;
  }
  return ARCHETYPES[archetypeKey].promptDirective;
}

// ─────────────────────────────────────────────────────────────
// Prompt compuesto — Arquetipo × Exposición
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  archetypeKey: ArchetypeKey | null,
  exposure: ExposureLevel,
  platformTone: string,
  retryCount: number,
): string {
  const archetypeDirective = getArchetypeDirective(archetypeKey);
  const archetypeLabel = archetypeKey ? ARCHETYPES[archetypeKey].tone : "Neutro (colega senior de guardia)";

  const exposureDirective =
    exposure.level === 1
      ? "Respuesta ultra-corta, máximo 3 líneas. El usuario acaba de toparse con el error."
      : exposure.level === 2
        ? "Romper el anclaje cognitivo. El usuario lleva rato insistiendo en lo mismo. Obligar a mirar dependencias colaterales, no seguir por el mismo camino."
        : "Freno de mano completo. El usuario está agotado. Ordenar explícitamente soltar el teclado, revertir parches experimentales y volver a un baseline conocido. Tono firme pero humano.";

  return `Eres OpsSentinel, el motor de contención emocional y técnica ante fallas críticas (Error 500).
Tu identidad está definida en SOUL.md: colega senior de guardia, pragmático, directo, sereno.

## CONTEXTO DEL USUARIO
- Arquetipo detectado: ${archetypeKey ?? "neutro"} — Tono: ${archetypeLabel}
- Nivel de exposición: ${exposure.level} (${exposure.label}) — ${exposure.range}
- Diagnóstico de exposición: ${exposure.diagnosis}
- Intervención requerida: ${exposure.intervention}
- Tono de plataforma: ${platformTone} (creative = cercano/humano; corporate = formal/restringido)
- Reintento: ${retryCount}

## DIRECTRIZ DE PERSONALIDAD (Sección 4 SOUL.md)
${archetypeDirective}

## DIRECTRIZ DE EXPOSICIÓN TEMPORAL (Sección 3 SOUL.md)
${exposureDirective}

## REGLAS INVARIABLES
1. La causa técnica no se inventa ni se suaviza — se adapta el envoltorio según personalidad.
2. Asumir la responsabilidad del sistema; el usuario no cometió ningún error.
3. Asegurar explícitamente que sus datos y transacciones están seguros.
4. Entregar una sola acción clara.
5. No usar lenguaje corporate ("Sentimos las molestias") salvo que platformTone = corporate.
6. No ser condescendiente ni terapéutico.`;
}

// ─────────────────────────────────────────────────────────────
// Kostra API key resolution (mismo patrón que agent.ts)
// ─────────────────────────────────────────────────────────────

async function getKostraApiKey(): Promise<string | null> {
  const secretFile = process.env.KOSTRA_API_KEY_FILE ?? "/run/secrets/kostra_api_key";
  try {
    const key = await fs.readFile(secretFile, "utf8");
    return key.trim();
  } catch {
    const localFallbacks = [
      path.join(process.cwd(), "../../secrets/kostra_api_key.txt"),
      path.join(process.cwd(), "secrets/kostra_api_key.txt"),
      path.join(process.cwd(), "../secrets/kostra_api_key.txt"),
    ];
    for (const f of localFallbacks) {
      try {
        const key = await fs.readFile(f, "utf8");
        return key.trim();
      } catch {}
    }
  }
  return process.env.KOSTRA_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}

// ─────────────────────────────────────────────────────────────
// Handler principal — Express error middleware
// ─────────────────────────────────────────────────────────────

export interface EmotionalErrorResponse {
  status: "error";
  code: 500;
  archetype: ArchetypeKey | "neutral";
  exposureLevel: ExposureLevel["label"];
  exposureLevelNum: ExposureLevel["level"];
  message: string;
  retryAfterSeconds: number;
}

export async function adaptiveEmotionalHandler(
  err: unknown,
  req: { method?: string; originalUrl?: string; headers?: Record<string, string | string[] | undefined>; body?: { message?: string; userInput?: string } | Record<string, unknown>; query?: { message?: string } | Record<string, unknown> },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  const retryCount = parseInt((req.headers?.["x-retry-count"] as string) ?? "1", 10);
  const platformTone = (req.headers?.["x-platform-tone"] as string) ?? "creative";
  const userAction = `${req.method ?? "UNKNOWN"} en ${req.originalUrl ?? "/"}`;
  const rawError = err instanceof Error ? err.message : "Unknown internal error";

  const body = req.body as { message?: string; userInput?: string } | undefined;
  const query = req.query as { message?: string } | undefined;
  const userMessage = body?.message ?? body?.userInput ?? query?.message ?? rawError;
  const exposure = getExposureLevel(retryCount);
  const archetypeKey = detectArchetype(userMessage);
  const systemPrompt = buildSystemPrompt(archetypeKey, exposure, platformTone, retryCount);

  const apiKey = await getKostraApiKey();
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://ai.kostra.cloud/v1";
  const model = process.env.MODEL ?? "glm-5.2";

  try {
    if (!apiKey) {
      throw new Error("No API key available");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: exposure.level === 3 ? 250 : 180,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Acción intentada: "${userAction}". Falla técnica interna: "${rawError}". Mensaje del usuario: "${userMessage}". Reintento: ${retryCount}. Genera la respuesta adaptada.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Kostra API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const emotionalCopy = (data.choices?.[0]?.message?.content ?? "").trim() || "Error interno. Tus datos están seguros. Reintenta en unos minutos.";

    res.status(500).json({
      status: "error" as const,
      code: 500 as const,
      archetype: archetypeKey ?? "neutral",
      exposureLevel: exposure.label,
      exposureLevelNum: exposure.level,
      message: emotionalCopy,
      retryAfterSeconds: retryCount >= 2 ? 180 : 30,
    });
  } catch {
    const fallback = platformTone === "corporate"
      ? "El servicio no se encuentra disponible momentáneamente. Sus operaciones permanecen seguras. Por favor reintente en 3 minutos."
      : "¡Ups! Tuvimos un cruce de cables interno. No tocaste nada malo y tus datos están a salvo. Regresa en un par de minutos mientras lo resolvemos.";

    res.status(500).json({
      status: "error" as const,
      code: 500 as const,
      archetype: archetypeKey ?? "neutral",
      exposureLevel: exposure.label,
      exposureLevelNum: exposure.level,
      message: fallback,
      retryAfterSeconds: retryCount >= 2 ? 180 : 30,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Función standalone para uso como herramienta MCP
// ─────────────────────────────────────────────────────────────

export interface EmotionalResponseInput {
  error: string;
  userMessage: string;
  retryCount?: number;
  platformTone?: "creative" | "corporate";
}

export interface EmotionalResponseOutput {
  archetype: ArchetypeKey | "neutral";
  exposureLevel: ExposureLevel["label"];
  exposureLevelNum: ExposureLevel["level"];
  message: string;
  retryAfterSeconds: number;
}

export async function generateEmotionalResponse(input: EmotionalResponseInput): Promise<EmotionalResponseOutput> {
  const retryCount = input.retryCount ?? 1;
  const platformTone = input.platformTone ?? "creative";
  const exposure = getExposureLevel(retryCount);
  const archetypeKey = detectArchetype(input.userMessage);
  const systemPrompt = buildSystemPrompt(archetypeKey, exposure, platformTone, retryCount);

  const apiKey = await getKostraApiKey();
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://ai.kostra.cloud/v1";
  const model = process.env.MODEL ?? "glm-5.2";

  try {
    if (!apiKey) {
      throw new Error("No API key available");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: exposure.level === 3 ? 250 : 180,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Falla técnica interna: "${input.error}". Mensaje del usuario: "${input.userMessage}". Reintento: ${retryCount}. Genera la respuesta adaptada.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Kostra API error (${response.status})`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const message = (data.choices?.[0]?.message?.content ?? "").trim() || "Error interno. Tus datos están seguros.";

    return {
      archetype: archetypeKey ?? "neutral",
      exposureLevel: exposure.label,
      exposureLevelNum: exposure.level,
      message,
      retryAfterSeconds: retryCount >= 2 ? 180 : 30,
    };
  } catch {
    return {
      archetype: archetypeKey ?? "neutral",
      exposureLevel: exposure.label,
      exposureLevelNum: exposure.level,
      message: platformTone === "corporate"
        ? "El servicio no se encuentra disponible momentáneamente. Sus operaciones permanecen seguras."
        : "¡Ups! Tuvimos un cruce de cables interno. No tocaste nada malo y tus datos están a salvo.",
      retryAfterSeconds: retryCount >= 2 ? 180 : 30,
    };
  }
}
