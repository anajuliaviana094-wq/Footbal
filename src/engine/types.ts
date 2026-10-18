// Tipos do domínio de jogo compartilhados pelo motor, seed e carreira.

export const POSITIONS = ["GOL", "ZAG", "LAT", "VOL", "MC", "MEI", "PON", "ATA"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  VOL: "Volante",
  MC: "Meio-campo",
  MEI: "Meia",
  PON: "Ponta",
  ATA: "Atacante",
};

export interface Attributes {
  finalizacao: number;
  passe: number;
  drible: number;
  cruzamento: number;
  cabeceio: number;
  desarme: number;
  marcacao: number;
  posicionamento: number;
  velocidade: number;
  resistencia: number;
  forca: number;
  visao: number;
  // goleiro
  reflexo: number;
  saida_gol: number;
  jogo_pes: number;
}

export const ATTRIBUTE_LABEL: Record<keyof Attributes, string> = {
  finalizacao: "Finalização",
  passe: "Passe",
  drible: "Drible",
  cruzamento: "Cruzamento",
  cabeceio: "Cabeceio",
  desarme: "Desarme",
  marcacao: "Marcação",
  posicionamento: "Posicionamento",
  velocidade: "Velocidade",
  resistencia: "Resistência",
  forca: "Força",
  visao: "Visão de jogo",
  reflexo: "Reflexo",
  saida_gol: "Saída do gol",
  jogo_pes: "Jogo com os pés",
};

export interface Traits {
  agressividade: number;
  temperamento: number;
  frieza: number;
  lideranca: number;
  disciplina_tatica: number;
  propensao_lesao: number;
  consistencia: number;
}

export const TRAIT_LABEL: Record<keyof Traits, string> = {
  agressividade: "Agressividade",
  temperamento: "Temperamento",
  frieza: "Frieza",
  lideranca: "Liderança",
  disciplina_tatica: "Disciplina tática",
  propensao_lesao: "Propensão a lesão",
  consistencia: "Consistência",
};

export const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2"] as const;
export type Formation = (typeof FORMATIONS)[number];

export type Style = "defensivo" | "equilibrado" | "ofensivo";
export type Pressing = "baixa" | "media" | "alta";
export type Marking = "zona" | "individual";

export interface Tactics {
  formation: Formation;
  style: Style;
  pressing: Pressing;
  marking: Marking;
}

export const DEFAULT_TACTICS: Tactics = {
  formation: "4-4-2",
  style: "equilibrado",
  pressing: "media",
  marking: "zona",
};

/** Jogador como o motor o enxerga (já com evolução da carreira aplicada). */
export interface EnginePlayer {
  id: number;
  name: string;
  shirt: number;
  position: Position;
  attrs: Attributes;
  traits: Traits;
  /** 0–100 */
  condition: number;
  /** 0–100 */
  morale: number;
}

export interface TeamInput {
  clubId: number;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  tactics: Tactics;
  /** 11 titulares na ordem dos slots da formação */
  starters: EnginePlayer[];
  bench: EnginePlayer[];
  /** Se o motor pode fazer substituições por cansaço/placar sozinho. */
  autoSubs: boolean;
}

export type Side = "home" | "away";

/** Alteração feita durante o jogo (substituições/tática) a partir de um tick. */
export interface MatchChange {
  tick: number;
  side: Side;
  subs?: { outId: number; inId: number }[];
  tactics?: Partial<Tactics>;
}

export interface MatchInput {
  home: TeamInput;
  away: TeamInput;
  seed: number;
  /** true: gera frames com posições para o campo 2D. */
  detailed: boolean;
  changes?: MatchChange[];
}

export type EventType =
  | "kickoff"
  | "goal"
  | "shot"
  | "save"
  | "miss"
  | "chance"
  | "foul"
  | "yellow"
  | "second_yellow"
  | "red"
  | "penalty"
  | "penalty_miss"
  | "injury"
  | "sub"
  | "corner"
  | "tactic"
  | "halftime"
  | "fulltime";

export interface MatchEvent {
  /** chave estável (não muda com re-simulações do trecho anterior) */
  key: string;
  tick: number;
  minute: number;
  type: EventType;
  side: Side | null;
  playerId?: number;
  playerName?: string;
  otherId?: number;
  otherName?: string;
  /** placar após o evento */
  score: [number, number];
  detail?: Record<string, string | number | boolean>;
}

export interface TeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  yellows: number;
  reds: number;
  corners: number;
}

export interface PlayerMatchStats {
  playerId: number;
  side: Side;
  rating: number;
  minutes: number;
  goals: number;
  assists: number;
  yellows: number;
  red: boolean;
  /** red veio de dois amarelos */
  secondYellow: boolean;
  injured: boolean;
  injuryDays: number;
  /** condição física ao final */
  condition: number;
  started: boolean;
}

/** Posições de um tick. p: 22 posições (11 casa + 11 fora, por slot) ou null se fora de campo. */
export interface Frame {
  t: number;
  b: [number, number];
  p: ([number, number] | null)[];
  /** lado com a posse */
  s: 0 | 1;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: { home: TeamStats; away: TeamStats };
  players: PlayerMatchStats[];
  finalTick: number;
  halftimeTick: number;
  frames?: Frame[];
}

export const TICKS_PER_MINUTE = 3;
