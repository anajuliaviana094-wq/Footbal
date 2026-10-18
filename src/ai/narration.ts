import "server-only";
import type { EnginePlayer, MatchEvent, MatchInput } from "@/engine/types";
import { TRAIT_LABEL, type Traits } from "@/engine/types";
import { callJson } from "./client";
import { isKeyEvent } from "./templates";

const SYSTEM =
  "Você é um narrador de futebol de rádio/TV brasileiro, empolgado e criativo, narrando um jogo FICTÍCIO. " +
  "Para cada lance recebido, escreva UMA frase curta (até 25 palavras) em português do Brasil. " +
  "Use os traços dos jogadores para dar contexto (ex.: volante que já vinha reclamando). " +
  "Nunca cite pessoas, clubes, ligas ou estádios reais. Use apenas os nomes fornecidos.";

const MAX_EVENTS = 24;

function traitsNote(t: Traits): string {
  const notes: string[] = [];
  for (const k of ["agressividade", "temperamento", "frieza", "lideranca"] as (keyof Traits)[]) {
    if (t[k] >= 75) notes.push(`${TRAIT_LABEL[k].toLowerCase()} alta`);
  }
  return notes.join(", ");
}

const TYPE_PT: Partial<Record<MatchEvent["type"], string>> = {
  goal: "GOL",
  yellow: "cartão amarelo",
  second_yellow: "segundo amarelo e expulsão",
  red: "vermelho direto",
  penalty: "pênalti marcado",
  penalty_miss: "pênalti perdido",
  injury: "lesão",
  save: "grande defesa em chance clara",
  miss: "grande chance desperdiçada",
};

/**
 * Uma única chamada para todos os eventos-chave sem narração.
 * Retorna mapa eventKey → frase. Em caso de falha retorna {} (o cliente fica com os templates).
 */
export async function narrateKeyEvents(
  userId: string,
  input: MatchInput,
  events: MatchEvent[],
  already: Set<string>,
): Promise<Record<string, string>> {
  const pending = events.filter((e) => isKeyEvent(e) && !already.has(e.key)).slice(0, MAX_EVENTS);
  if (!pending.length) return {};

  const players = new Map<number, EnginePlayer>();
  for (const t of [input.home, input.away]) for (const p of [...t.starters, ...t.bench]) players.set(p.id, p);
  const teamName = (side: MatchEvent["side"]) => (side === "home" ? input.home.name : side === "away" ? input.away.name : "");

  const lines = pending.map((e, i) => {
    const p = e.playerId ? players.get(e.playerId) : undefined;
    const note = p ? traitsNote(p.traits) : "";
    const extra = e.detail?.reason ? ` (${e.detail.reason})` : e.detail?.kind ? ` (${e.detail.kind})` : "";
    return `${i + 1}. ${e.minute}' ${TYPE_PT[e.type] ?? e.type}${extra} — ${e.playerName ?? ""} (${teamName(e.side)})${e.otherName ? `, envolvendo ${e.otherName}` : ""}; placar ${e.score[0]}x${e.score[1]}${note ? `; traços: ${note}` : ""}`;
  });
  const prompt = `Jogo: ${input.home.name} (casa) x ${input.away.name}.\nLances:\n${lines.join("\n")}\n\nDevolva uma narração para cada lance, na mesma ordem.`;

  const out = await callJson<{ lines: { n: number; text: string }[] }>({
    userId,
    kind: "narration",
    system: SYSTEM,
    prompt,
    maxTokens: 60 + pending.length * 55,
    schema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: { n: { type: "integer" }, text: { type: "string" } },
            required: ["n", "text"],
            additionalProperties: false,
          },
        },
      },
      required: ["lines"],
      additionalProperties: false,
    },
  });
  const result: Record<string, string> = {};
  for (const l of out?.lines ?? []) {
    const ev = pending[l.n - 1];
    if (ev && l.text) result[ev.key] = l.text.trim().slice(0, 280);
  }
  return result;
}
