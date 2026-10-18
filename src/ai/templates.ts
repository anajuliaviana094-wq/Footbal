import { hashSeed } from "@/engine/rng";
import type { MatchEvent } from "@/engine/types";

// Narração local por templates (sem IA). Usada nos lances comuns e como fallback.

const T: Partial<Record<MatchEvent["type"], string[]>> = {
  kickoff: ["Rola a bola! Começa o jogo!", "Apita o árbitro, bola rolando!", "Tudo pronto, começa a partida!"],
  halftime: ["Fim do primeiro tempo!", "Intervalo! Os times vão para o vestiário.", "Termina a primeira etapa!"],
  fulltime: ["Fim de jogo!", "Apita o árbitro, acabou!", "Final de partida!"],
  goal: [
    "GOOOOOL! {p} balança a rede para o {t}!",
    "É GOL! {p} não perdoa e marca para o {t}!",
    "GOOOL DO {T}! {p} manda pro fundo do barbante!",
    "Lá dentro! {p} estufa a rede!",
  ],
  save: [
    "Que defesa de {o}! Parou o chute de {p}.",
    "{p} bateu firme, mas {o} estava lá.",
    "Chute de {p} e o goleiro {o} segura.",
    "{o} voa e espalma a finalização de {p}!",
    "{p} tenta o canto, {o} encaixa sem dar rebote.",
    "Boa chegada do {t}, mas {o} fecha o gol.",
  ],
  miss: [
    "{p} arrisca... pra fora!",
    "Passou perto! {p} chutou com perigo.",
    "{p} finaliza por cima do gol.",
    "{p} pegou mal na bola, tiro de meta.",
    "Que perigo! {p} manda rente à trave.",
    "{p} isola! A bola foi parar na arquibancada.",
  ],
  shot: ["Chute de {p} travado pela zaga!", "{p} tenta, mas a defesa bloqueia.", "{p} solta a bomba e a zaga se joga na frente!"],
  foul: ["Falta de {p} em {o}.", "{p} chega atrasado e derruba {o}.", "Falta marcada: {p} em cima de {o}."],
  yellow: ["Cartão amarelo para {p}.", "O árbitro mostra o amarelo para {p}.", "Amarelo para {p} pela entrada dura."],
  second_yellow: ["Segundo amarelo para {p}... e o vermelho! Está expulso!", "{p} leva o segundo amarelo e vai mais cedo para o chuveiro!"],
  red: ["VERMELHO DIRETO! {p} está expulso!", "Que entrada! {p} recebe o vermelho direto!"],
  penalty: ["PÊNALTI! Falta de {o} em {p} dentro da área!", "O árbitro aponta a marca da cal! Pênalti para o {t}!"],
  penalty_miss: ["{p} perde o pênalti!", "Desperdiçou! {p} manda a cobrança pra fora!"],
  injury: ["{p} sente e pede atendimento.", "Preocupação: {p} está lesionado.", "{p} cai no gramado sentindo dores."],
  sub: ["Substituição no {t}: sai {o}, entra {p}.", "Mexida no {t}: entra {p} no lugar de {o}."],
  corner: ["Escanteio para o {t}.", "Bola na linha de fundo, escanteio."],
  tactic: ["O {t} muda a postura em campo.", "Ajuste tático no {t}."],
};

/**
 * Frase de template para um evento. `occurrence` é quantas vezes esse tipo já apareceu
 * no jogo — usado para alternar as variações e não repetir a mesma frase.
 */
export function templateNarration(ev: MatchEvent, teamName: (side: "home" | "away") => string, occurrence = 0): string {
  const options = T[ev.type];
  if (!options) return "";
  let text = options[(hashSeed(ev.type) + occurrence) % options.length];
  if (ev.type === "save" && ev.detail?.penalty) text = "{o} DEFENDE O PÊNALTI de {p}!";
  if (ev.type === "goal" && ev.detail?.kind === "penalty") text = "GOL DE PÊNALTI! {p} bate com categoria!";
  if (ev.type === "goal" && ev.detail?.kind === "header") text = "GOOOL DE CABEÇA! {p} sobe mais que todo mundo!";
  if ((ev.type === "save" || ev.type === "miss") && ev.detail?.big) text = text.replace(/^/, "Que chance! ");
  if (ev.type === "yellow" && ev.detail?.reason === "reclamação") text = "Amarelo para {p} por reclamação.";
  const team = ev.side ? teamName(ev.side) : "";
  return text
    .replaceAll("{p}", ev.playerName ?? "")
    .replaceAll("{o}", ev.otherName ?? "o adversário")
    .replaceAll("{T}", team.toUpperCase())
    .replaceAll("{t}", team);
}

/** Tipos que viram linha no feed. */
export const FEED_TYPES = new Set<MatchEvent["type"]>([
  "kickoff", "halftime", "fulltime", "goal", "save", "miss", "shot", "yellow", "second_yellow", "red",
  "penalty", "penalty_miss", "injury", "sub", "tactic",
]);

/** Eventos-chave que recebem narração por IA. */
export const KEY_TYPES = new Set<MatchEvent["type"]>([
  "goal", "yellow", "second_yellow", "red", "penalty", "penalty_miss", "injury",
]);

export function isKeyEvent(ev: MatchEvent): boolean {
  if (KEY_TYPES.has(ev.type)) return true;
  return (ev.type === "save" || ev.type === "miss") && Boolean(ev.detail?.big);
}
