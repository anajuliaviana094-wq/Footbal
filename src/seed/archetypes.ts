import type { Attributes, Position, Traits } from "@/engine/types";

export interface Archetype {
  id: string;
  label: string;
  positions: Position[];
  bias: Partial<Record<keyof Attributes, number>>;
  traits: Partial<Record<keyof Traits, [number, number]>>;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "goleiro_seguro",
    label: "Goleiro seguro",
    positions: ["GOL"],
    bias: { posicionamento: 5, saida_gol: 4, reflexo: -2 },
    traits: { frieza: [60, 88], consistencia: [70, 92], temperamento: [15, 45] },
  },
  {
    id: "goleiro_reflexos",
    label: "Goleiro de reflexos",
    positions: ["GOL"],
    bias: { reflexo: 7, posicionamento: -2, saida_gol: -3, jogo_pes: -2 },
    traits: { consistencia: [40, 70], temperamento: [35, 70] },
  },
  {
    id: "zagueiro_xerife",
    label: "Zagueiro xerife",
    positions: ["ZAG"],
    bias: { forca: 6, cabeceio: 5, marcacao: 3, passe: -5, velocidade: -3 },
    traits: { agressividade: [70, 92], temperamento: [55, 82], lideranca: [65, 92] },
  },
  {
    id: "zagueiro_tecnico",
    label: "Zagueiro técnico",
    positions: ["ZAG"],
    bias: { passe: 7, posicionamento: 4, visao: 6, forca: -4 },
    traits: { agressividade: [28, 55], temperamento: [20, 50], disciplina_tatica: [65, 90] },
  },
  {
    id: "lateral_apoiador",
    label: "Lateral apoiador",
    positions: ["LAT"],
    bias: { cruzamento: 6, velocidade: 4, resistencia: 3, marcacao: -5, desarme: -4 },
    traits: { disciplina_tatica: [35, 65] },
  },
  {
    id: "lateral_defensivo",
    label: "Lateral marcador",
    positions: ["LAT"],
    bias: { desarme: 5, marcacao: 5, cruzamento: -5, drible: -3 },
    traits: { disciplina_tatica: [65, 92], agressividade: [45, 75] },
  },
  {
    id: "volante_cao_de_guarda",
    label: "Volante cão de guarda",
    positions: ["VOL"],
    bias: { desarme: 7, marcacao: 6, forca: 4, passe: -6, visao: -6 },
    traits: { agressividade: [80, 95], temperamento: [70, 90], frieza: [30, 60] },
  },
  {
    id: "volante_construtor",
    label: "Volante construtor",
    positions: ["VOL", "MC"],
    bias: { passe: 6, visao: 6, desarme: -3, forca: -3 },
    traits: { agressividade: [28, 55], temperamento: [25, 55], disciplina_tatica: [60, 90] },
  },
  {
    id: "meia_box_to_box",
    label: "Meia box-to-box",
    positions: ["MC"],
    bias: { resistencia: 7, desarme: 3, finalizacao: 3, visao: -3 },
    traits: { agressividade: [50, 78], lideranca: [45, 80] },
  },
  {
    id: "meia_criativo",
    label: "Meia criativo (camisa 10)",
    positions: ["MEI", "MC"],
    bias: { visao: 8, passe: 6, drible: 3, resistencia: -4, forca: -5 },
    traits: { agressividade: [15, 40], frieza: [55, 88], disciplina_tatica: [30, 60] },
  },
  {
    id: "ponta_driblador",
    label: "Ponta driblador",
    positions: ["PON"],
    bias: { drible: 8, velocidade: 5, passe: -4, finalizacao: -2 },
    traits: { temperamento: [40, 78], disciplina_tatica: [30, 60] },
  },
  {
    id: "centroavante_finalizador",
    label: "Centroavante finalizador",
    positions: ["ATA"],
    bias: { finalizacao: 7, posicionamento: 5, forca: -2, passe: -3 },
    traits: { frieza: [62, 92] },
  },
  {
    id: "centroavante_pivo",
    label: "Centroavante pivô",
    positions: ["ATA"],
    bias: { forca: 8, cabeceio: 8, velocidade: -6, drible: -3 },
    traits: { agressividade: [50, 78], lideranca: [40, 75] },
  },
  {
    id: "veterano_experiente",
    label: "Veterano experiente",
    positions: [],
    bias: { velocidade: -8, resistencia: -6, visao: 5, posicionamento: 5 },
    traits: { lideranca: [70, 95], frieza: [70, 92], disciplina_tatica: [70, 95], propensao_lesao: [50, 80], consistencia: [65, 90] },
  },
  {
    id: "jovem_promessa",
    label: "Jovem promessa",
    positions: [],
    bias: { resistencia: 3, velocidade: 3, visao: -3, posicionamento: -3 },
    traits: { consistencia: [25, 50], frieza: [25, 55], lideranca: [10, 35], propensao_lesao: [15, 45] },
  },
];

export const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

/** Viés de atributos por posição (relativo ao overall-alvo). */
export const POSITION_BIAS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  GOL: { reflexo: 0, saida_gol: 0, posicionamento: 0, jogo_pes: -8, finalizacao: -38, drible: -32, cruzamento: -35, cabeceio: -30, desarme: -35, marcacao: -35, velocidade: -25, resistencia: -20, forca: -10, passe: -22, visao: -25 },
  ZAG: { desarme: 2, marcacao: 2, cabeceio: 2, forca: 2, posicionamento: 0, velocidade: -8, passe: -8, visao: -15, drible: -18, finalizacao: -25, cruzamento: -22, resistencia: -5 },
  LAT: { velocidade: 2, cruzamento: 0, desarme: -2, marcacao: -3, resistencia: 2, passe: -4, drible: -5, finalizacao: -20, cabeceio: -15, forca: -10, visao: -12, posicionamento: -6 },
  VOL: { desarme: 2, marcacao: 2, passe: -2, posicionamento: 0, resistencia: 2, forca: -2, visao: -6, drible: -12, finalizacao: -18, cruzamento: -18, velocidade: -8, cabeceio: -8 },
  MC: { passe: 2, visao: 0, resistencia: 2, desarme: -8, drible: -4, finalizacao: -10, posicionamento: -2, marcacao: -10, cruzamento: -10, velocidade: -6, cabeceio: -15, forca: -10 },
  MEI: { passe: 2, visao: 3, drible: 0, finalizacao: -3, posicionamento: -2, desarme: -25, marcacao: -25, cruzamento: -6, velocidade: -4, cabeceio: -18, forca: -15, resistencia: -6 },
  PON: { velocidade: 3, drible: 2, cruzamento: 0, finalizacao: -5, passe: -5, desarme: -28, marcacao: -28, visao: -8, cabeceio: -18, forca: -15, posicionamento: -8, resistencia: -2 },
  ATA: { finalizacao: 3, posicionamento: 1, cabeceio: -2, velocidade: -3, forca: -3, drible: -6, passe: -12, visao: -12, desarme: -35, marcacao: -35, cruzamento: -18, resistencia: -6 },
};

/** Composição do elenco: 25 jogadores. */
export const SQUAD_TEMPLATE: Position[] = [
  "GOL", "GOL", "GOL",
  "ZAG", "ZAG", "ZAG", "ZAG",
  "LAT", "LAT", "LAT", "LAT",
  "VOL", "VOL", "VOL",
  "MC", "MC", "MC",
  "MEI", "MEI",
  "PON", "PON", "PON",
  "ATA", "ATA", "ATA",
];
