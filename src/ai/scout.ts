import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ARCHETYPE_BY_ID } from "@/seed/archetypes";
import { ATTRIBUTE_LABEL, POSITION_LABEL, TRAIT_LABEL, type Attributes, type Position, type Traits } from "@/engine/types";
import { callJson } from "./client";

interface ScoutInput {
  id: number;
  name: string;
  age: number;
  position: Position;
  archetype: string;
  overall: number;
  attrs: Attributes;
  traits: Traits;
  foot: string;
  height: number;
}

const SYSTEM =
  "Você é um olheiro de futebol brasileiro escrevendo relatórios curtos para um jogo de gerenciamento fictício. " +
  "Escreva em português do Brasil, 2 a 3 frases, tom profissional e vivo. Descreva estilo, pontos fortes, fracos e temperamento. " +
  "Não cite pessoas, clubes ou ligas reais nem compare com jogadores reais. Não mencione números.";

function topAttrs(attrs: Attributes, pos: Position, best: boolean): string[] {
  const keys = (Object.keys(attrs) as (keyof Attributes)[]).filter((k) =>
    pos === "GOL" ? true : !["reflexo", "saida_gol", "jogo_pes"].includes(k),
  );
  return keys
    .sort((a, b) => (best ? attrs[b] - attrs[a] : attrs[a] - attrs[b]))
    .slice(0, 3)
    .map((k) => ATTRIBUTE_LABEL[k].toLowerCase());
}

function traitWords(t: Traits): string[] {
  const out: string[] = [];
  for (const k of Object.keys(t) as (keyof Traits)[]) {
    if (t[k] >= 75) out.push(`${TRAIT_LABEL[k].toLowerCase()} alta`);
    else if (t[k] <= 30) out.push(`${TRAIT_LABEL[k].toLowerCase()} baixa`);
  }
  return out;
}

/** Relatório por template (fallback sem IA). */
export function templateScout(p: ScoutInput): string {
  const arch = ARCHETYPE_BY_ID.get(p.archetype)?.label ?? POSITION_LABEL[p.position];
  const best = topAttrs(p.attrs, p.position, true);
  const worst = topAttrs(p.attrs, p.position, false);
  const t = p.traits;
  let temper = "Tem comportamento equilibrado em campo.";
  if (t.agressividade >= 75 && t.temperamento >= 70) temper = "Joga no limite: entra forte, reclama muito e vive pendurado com cartões.";
  else if (t.agressividade >= 75) temper = "Marca com muita intensidade e não foge de dividida.";
  else if (t.temperamento >= 75) temper = "Pavio curto — costuma perder a cabeça em jogos tensos.";
  else if (t.frieza >= 78) temper = "Muito frio nos momentos decisivos.";
  return `${arch} de ${p.age} anos que se destaca em ${best.join(", ")}. Precisa evoluir em ${worst.slice(0, 2).join(" e ")}. ${temper}`;
}

export async function getScoutReport(userId: string, p: ScoutInput): Promise<{ text: string; source: "ai" | "template" | "cache" }> {
  const db = getDb();
  const [row] = await db.select({ r: schema.players.scoutReport }).from(schema.players).where(eq(schema.players.id, p.id));
  if (row?.r) return { text: row.r, source: "cache" };

  const arch = ARCHETYPE_BY_ID.get(p.archetype)?.label ?? p.archetype;
  const prompt = [
    `Jogador: ${p.name}, ${p.age} anos, ${POSITION_LABEL[p.position]}, perfil "${arch}", geral ${p.overall}.`,
    `Pé: ${p.foot === "E" ? "esquerdo" : p.foot === "A" ? "ambidestro" : "direito"}, ${p.height} cm.`,
    `Melhores atributos: ${topAttrs(p.attrs, p.position, true).join(", ")}.`,
    `Piores: ${topAttrs(p.attrs, p.position, false).join(", ")}.`,
    `Traços marcantes: ${traitWords(p.traits).join(", ") || "nenhum extremo"}.`,
  ].join("\n");
  const out = await callJson<{ report: string }>({
    userId,
    kind: "scout",
    system: SYSTEM,
    prompt,
    maxTokens: 220,
    schema: {
      type: "object",
      properties: { report: { type: "string" } },
      required: ["report"],
      additionalProperties: false,
    },
  });
  if (out?.report) {
    const text = out.report.trim().slice(0, 600);
    await db.update(schema.players).set({ scoutReport: text }).where(eq(schema.players.id, p.id));
    return { text, source: "ai" };
  }
  return { text: templateScout(p), source: "template" };
}
