import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Modelo mais barato/rápido. Pode ser sobrescrito por ANTHROPIC_MODEL. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const LIMITS = {
  narration: Number(process.env.AI_DAILY_NARRATION_LIMIT ?? 40),
  scout: Number(process.env.AI_DAILY_SCOUT_LIMIT ?? 60),
};

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // timeout curto: o jogo nunca espera a IA por muito tempo
  return (client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 }));
}

export type AiKind = "narration" | "scout";

async function underDailyLimit(userId: string, kind: AiKind): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(schema.aiUsageLog)
    .where(and(eq(schema.aiUsageLog.userId, userId), eq(schema.aiUsageLog.kind, kind), gte(schema.aiUsageLog.createdAt, since)));
  return n < LIMITS[kind];
}

/**
 * Faz uma chamada curta com saída JSON validada por schema.
 * Retorna null se a IA estiver indisponível, acima do limite ou falhar — o chamador usa o fallback.
 */
export async function callJson<T>(opts: {
  userId: string;
  kind: AiKind;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}): Promise<T | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  if (!(await underDailyLimit(opts.userId, opts.kind))) return null;

  const db = getDb();
  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema: opts.schema } },
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    await db.insert(schema.aiUsageLog).values({
      userId: opts.userId,
      kind: opts.kind,
      model: AI_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      success: response.stop_reason === "end_turn",
    });
    if (response.stop_reason !== "end_turn") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as T;
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.warn(`[ai] ${opts.kind} falhou: ${err.status} ${err.message}`);
    else console.warn(`[ai] ${opts.kind} falhou`, err);
    await db
      .insert(schema.aiUsageLog)
      .values({ userId: opts.userId, kind: opts.kind, model: AI_MODEL, success: false })
      .catch(() => {});
    return null;
  }
}
