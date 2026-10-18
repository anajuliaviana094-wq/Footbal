// Ligas e clubes 100% fictícios. Nenhum nome real de liga, clube, cidade ou estádio.

export type NamePool = "br" | "en" | "es" | "it" | "de" | "fr" | "sa" | "pt" | "ar" | "ng";

export interface LeagueDef {
  id: string;
  /** país/sistema de ligas */
  systemId: string;
  /** 1 = primeira divisão */
  tier: number;
  name: string;
  country: string;
  flag: string;
  inspiration: string;
  /** overall médio aproximado dos titulares */
  level: number;
  isFree: boolean;
  pool: NamePool;
  /** pools de estrangeiros com pesos */
  foreignPools: Partial<Record<NamePool, number>>;
  foreignRate: number;
  clubs: { name: string; short: string; city: string }[];
  sortOrder: number;
}

function clubs(prefixes: string[], cities: string[], pattern: "prefix" | "suffix"): LeagueDef["clubs"] {
  return cities.map((city, i) => {
    const pre = prefixes[i % prefixes.length];
    const name = pattern === "prefix" ? `${pre} ${city}` : `${city} ${pre}`;
    const short = city
      .replace(/^(de|do|da|dos|das)\s/i, "")
      .split(/[\s-]+/)
      .filter((w) => w.length > 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .padEnd(3, city.replace(/[^A-Za-z]/g, "").toUpperCase().slice(1, 3))
      .slice(0, 3);
    return { name, short, city };
  });
}

export const LEAGUES: LeagueDef[] = [
  {
    id: "pindorama-elite",
    systemId: "pindorama",
    tier: 1,
    name: "Liga Pindorama — Elite",
    country: "Pindorama",
    flag: "🟩",
    inspiration: "Brasil — 1ª divisão",
    level: 72,
    isFree: false,
    pool: "br",
    foreignPools: { ar: 3, pt: 2, es: 1, ng: 1 },
    foreignRate: 0.08,
    sortOrder: 1,
    clubs: clubs(
      ["Esporte Clube", "Clube Atlético", "Associação Esportiva", "Futebol Clube", "Sociedade Esportiva"],
      [
        "Porto Anil", "Serra Cobalto", "Rio Turmalina", "Pedra Lunar", "Bela Brisa",
        "Cajuaçu", "Itamarê", "Lagoa Prateada", "Monte Coral", "Santa Alvorada",
        "Jacarandá do Norte", "Pirauê", "Ventania", "Cachoeira Rubi", "Ilha Safira",
        "Mata Dourada", "Campo Celeste", "Tabocal", "Maracajuba", "Vale do Ouro Velho",
      ],
      "prefix",
    ),
  },
  {
    id: "pindorama-acesso",
    systemId: "pindorama",
    tier: 2,
    name: "Liga Pindorama — Acesso",
    country: "Pindorama",
    flag: "🟩",
    inspiration: "Brasil — 2ª divisão",
    level: 64,
    isFree: true,
    pool: "br",
    foreignPools: { ar: 2, pt: 1 },
    foreignRate: 0.04,
    sortOrder: 2,
    clubs: clubs(
      ["Esporte Clube", "Clube Atlético", "Associação Esportiva", "Futebol Clube", "Sociedade Esportiva"],
      [
        "Taquaruna", "Ubiraçá", "Moranguaba", "Coqueiral do Leste", "Tucanópolis",
        "Araraquena", "Sabiá Velho", "Vila Ventura", "Lagoa Turquesa", "Arraial do Sol",
        "Recanto Verde", "Guaraçuí", "Pinheiral Azul", "Juritiba", "Barra do Vento",
        "Cerro Lilás", "Ibitarema", "Pau-Ferro do Sul", "Brejo Encantado", "Morro do Farol",
      ],
      "prefix",
    ),
  },
  {
    id: "albion",
    systemId: "albion",
    tier: 1,
    name: "Liga Albion",
    country: "Albion",
    flag: "🟥",
    inspiration: "Inglaterra",
    level: 77,
    isFree: false,
    pool: "en",
    foreignPools: { fr: 3, es: 2, br: 2, de: 1, pt: 2, ng: 2, ar: 1, it: 1 },
    foreignRate: 0.35,
    sortOrder: 3,
    clubs: clubs(
      ["FC", "Athletic", "Rovers", "Town", "Wanderers", "United", "City", "Borough"],
      [
        "Ashmere", "Brackwater", "Coldharrow", "Dunmarsh", "Elmsgate",
        "Fernhollow", "Galebridge", "Harrowmoor", "Ironvale", "Kestrelby",
        "Lynwick", "Marrowby", "Northwyke", "Oakhollow", "Pennyrigg",
        "Quarrymoor", "Ravensholt", "Saltmarsh Bay", "Thornwick", "Wexmoor",
      ],
      "suffix",
    ),
  },
  {
    id: "hispania",
    systemId: "hispania",
    tier: 1,
    name: "Liga Hispânia",
    country: "Hispânia",
    flag: "🟨",
    inspiration: "Espanha",
    level: 76,
    isFree: false,
    pool: "es",
    foreignPools: { ar: 3, br: 2, fr: 2, pt: 2, ng: 1 },
    foreignRate: 0.25,
    sortOrder: 4,
    clubs: clubs(
      ["CD", "UD", "CF", "SD", "Atlético", "Deportivo"],
      [
        "Valdecorza", "Montebruma", "Almarena", "Peñaverde", "Torrealba del Mar",
        "Castrolargo", "Villasombra", "Riosalado", "Sierra Cárdena", "Puertolino",
        "Navalcielo", "Arenisca", "Fuentelobos", "Laguna Plata", "Benicorvo",
        "Olmedilla Alta", "Cabo Ámbar", "Robledal", "Mirasierra Nueva", "Calablanca",
      ],
      "prefix",
    ),
  },
  {
    id: "peninsulare",
    systemId: "peninsulare",
    tier: 1,
    name: "Lega Peninsulare",
    country: "Peninsulare",
    flag: "🟦",
    inspiration: "Itália",
    level: 75,
    isFree: false,
    pool: "it",
    foreignPools: { ar: 2, br: 2, fr: 2, es: 1, de: 1, ng: 1 },
    foreignRate: 0.3,
    sortOrder: 5,
    clubs: clubs(
      ["AC", "US", "FC", "SS", "Calcio"],
      [
        "Valfiorita", "Montecorvo", "Rocca Azzurra", "Portobruno", "Lagofosco",
        "San Ventoso", "Castelmarino", "Pietralba", "Torrenera", "Borgo Lucente",
        "Vallerossa", "Colleverde", "Marisella", "Fonteluna", "Capo Argento",
        "Altopiano Grigio", "Serravento", "Riva Dorata", "Campobianco", "Isola Sereno",
      ],
      "prefix",
    ),
  },
  {
    id: "teutonica",
    systemId: "teutonica",
    tier: 1,
    name: "Liga Teutônica",
    country: "Teutônia",
    flag: "⬛",
    inspiration: "Alemanha",
    level: 74,
    isFree: false,
    pool: "de",
    foreignPools: { fr: 2, ng: 1, es: 1, br: 1, it: 1, pt: 1 },
    foreignRate: 0.28,
    sortOrder: 6,
    clubs: clubs(
      ["FC", "SV", "TSV", "SC", "SpVgg", "VfR"],
      [
        "Eichenwald", "Brunnstadt", "Falkenried", "Grauhafen", "Lindenhain",
        "Mühlenbrück", "Nebelberg", "Ostermark", "Rabenfels", "Silberau",
        "Tannenhorst", "Wolkenheim", "Kesselbach", "Sturmhagen", "Felsenkirch",
        "Hirschwalde", "Sonnenstein", "Erlenmoor",
      ],
      "prefix",
    ),
  },
  {
    id: "galia",
    systemId: "galia",
    tier: 1,
    name: "Liga Gália",
    country: "Gália",
    flag: "🟪",
    inspiration: "França",
    level: 73,
    isFree: false,
    pool: "fr",
    foreignPools: { ng: 3, br: 1, pt: 1, es: 1, it: 1 },
    foreignRate: 0.25,
    sortOrder: 7,
    clubs: clubs(
      ["FC", "AS", "US", "Stade", "SC"],
      [
        "Montclair-sur-Brume", "Valrose", "Port-Sablon", "Beaumarais", "Rochebleue",
        "Saint-Ventoux", "Chantelune", "Belvoir-les-Pins", "Clairmont-Sec", "Fontaine-Grise",
        "Mirabel-Haut", "Pontaval", "Roseval", "Sauvenay", "Terrenoire-Basse",
        "Vauclaire", "Lormont-Doré", "Champ-d'Azur",
      ],
      "prefix",
    ),
  },
  {
    id: "deserto-dourado",
    systemId: "deserto",
    tier: 1,
    name: "Liga do Deserto Dourado",
    country: "Deserto Dourado",
    flag: "🟫",
    inspiration: "Arábia Saudita",
    level: 67,
    isFree: true,
    pool: "sa",
    foreignPools: { br: 3, fr: 2, pt: 2, es: 1, ng: 2, ar: 1, en: 1 },
    foreignRate: 0.24,
    sortOrder: 8,
    clubs: clubs(
      ["SC", "FC", "Club"],
      [
        "Wadi Zahran", "Ras Almira", "Jebel Safra", "Nahr Ghaleb", "Qasr Annur",
        "Bir Sahlan", "Dar Waha", "Rimal Khadra", "Tal Fidda", "Ain Nujum",
        "Saqr Bay", "Hisn Amwaj", "Nakhla Sahil", "Jazirat Zumurrud", "Burj Rimal",
        "Sahl Dhahab", "Wahat Qamar", "Madinat Ruba",
      ],
      "prefix",
    ),
  },
];

export const LEAGUE_BY_ID = new Map(LEAGUES.map((l) => [l.id, l]));

export interface LeagueSystem {
  id: string;
  name: string;
  /** copa nacional (mata-mata) com todos os clubes do sistema */
  cup: { id: string; name: string };
  /** ligas do sistema, da 1ª divisão para baixo */
  leagues: string[];
  /** quantos sobem/descem entre divisões consecutivas */
  promotionSpots: number;
}

export const SYSTEMS: LeagueSystem[] = [
  { id: "pindorama", name: "Pindorama", cup: { id: "taca-pindorama", name: "Taça Pindorama" }, leagues: ["pindorama-elite", "pindorama-acesso"], promotionSpots: 4 },
  { id: "albion", name: "Albion", cup: { id: "copa-albion", name: "Copa Albion" }, leagues: ["albion"], promotionSpots: 0 },
  { id: "hispania", name: "Hispânia", cup: { id: "copa-hispania", name: "Copa Hispânia" }, leagues: ["hispania"], promotionSpots: 0 },
  { id: "peninsulare", name: "Peninsulare", cup: { id: "coppa-peninsulare", name: "Coppa Peninsulare" }, leagues: ["peninsulare"], promotionSpots: 0 },
  { id: "teutonica", name: "Teutônia", cup: { id: "pokal-teutonia", name: "Taça Teutônia" }, leagues: ["teutonica"], promotionSpots: 0 },
  { id: "galia", name: "Gália", cup: { id: "coupe-galia", name: "Copa Gália" }, leagues: ["galia"], promotionSpots: 0 },
  { id: "deserto", name: "Deserto Dourado", cup: { id: "taca-deserto", name: "Taça do Deserto" }, leagues: ["deserto-dourado"], promotionSpots: 0 },
];

export const SYSTEM_BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));
export function systemOfLeague(leagueId: string): LeagueSystem {
  const sid = LEAGUE_BY_ID.get(leagueId)?.systemId;
  const sys = sid ? SYSTEM_BY_ID.get(sid) : undefined;
  if (!sys) throw new Error(`Sistema não encontrado para ${leagueId}`);
  return sys;
}

/** Combinações de nome famosas que nunca devem ser geradas (normalizadas, sem acento). */
export const FAMOUS_NAME_BLOCKLIST = new Set(
  [
    "ronaldo nazario", "ronaldo lima", "neymar santos", "neymar silva", "romario faria", "romario souza",
    "ronaldinho gaucho", "roberto carlos", "kaka leite", "rivaldo ferreira", "vinicius junior", "gabriel jesus",
    "gabriel barbosa", "gabriel martinelli", "lucas paqueta", "thiago silva", "dani alves", "daniel alves",
    "marcelo vieira", "casemiro", "fernandinho roza", "philippe coutinho", "rafael leao", "joao felix",
    "bruno fernandes", "bernardo silva", "ruben dias", "diogo jota", "pedro neto", "nuno mendes", "joao cancelo",
    "harry kane", "wayne rooney", "david beckham", "steven gerrard", "frank lampard", "john terry", "jack grealish",
    "harry maguire", "jordan henderson", "jordan pickford", "declan rice", "mason mount", "luke shaw", "kyle walker",
    "jamie vardy", "james milner", "phil foden", "marcus rashford", "ben white", "jack wilshere", "ashley cole",
    "sergio ramos", "andres iniesta", "david villa", "fernando torres", "carlos puyol", "iker casillas", "david silva",
    "sergio busquets", "pedro gonzalez", "alvaro morata", "dani carvajal", "marcos llorente", "pablo sarabia",
    "francesco totti", "andrea pirlo", "alessandro del piero", "paolo maldini", "gianluigi buffon", "fabio cannavaro",
    "alessandro nesta", "daniele de rossi", "giorgio chiellini", "leonardo bonucci", "marco verratti", "nicolo barella",
    "federico chiesa", "lorenzo insigne", "ciro immobile", "gianluigi donnarumma", "roberto baggio", "filippo inzaghi",
    "thomas muller", "manuel neuer", "toni kroos", "philipp lahm", "bastian schweinsteiger", "mesut ozil",
    "marco reus", "mats hummels", "leon goretzka", "joshua kimmich", "kai havertz", "timo werner", "leroy sane",
    "miroslav klose", "lukas podolski", "oliver kahn", "michael ballack", "julian brandt", "niklas sule",
    "antoine griezmann", "kylian mbappe", "paul pogba", "olivier giroud", "hugo lloris", "karim benzema",
    "thierry henry", "zinedine zidane", "ngolo kante", "raphael varane", "theo hernandez", "lucas hernandez",
    "benjamin pavard", "kingsley coman", "ousmane dembele", "franck ribery", "samir nasri", "adrien rabiot",
    "salem al-dossary", "salem al-dawsari", "yasser al-qahtani", "sami al-jaber", "majed abdullah",
    "mohammed al-deayea", "nawaf al-temyat", "saud kariri", "mohammed al-owais", "firas al-buraikan",
    "lionel messi", "angel di maria", "sergio aguero", "lautaro martinez", "emiliano martinez", "nicolas otamendi",
    "rodrigo de paul", "gonzalo higuain", "juan riquelme", "enzo fernandez", "alexis mac allister", "julian alvarez",
    "nicolas tagliafico", "leandro paredes", "paulo dybala", "javier mascherano",
    "jay-jay okocha", "nwankwo kanu", "victor osimhen", "wilfred ndidi", "kelechi iheanacho", "alex iwobi",
    "ademola lookman", "samuel chukwueze", "john obi", "mikel obi",
    "cristiano ronaldo", "luis figo", "rui costa", "pepe ferreira", "ricardo carvalho", "nani cunha",
  ].map((s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()),
);
