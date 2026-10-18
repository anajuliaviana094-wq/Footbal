import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { CrestSpec } from "@/seed/generate";
import type { Attributes, Formation, MatchChange, MatchEvent, MatchInput, Position, Tactics, TeamStats, Traits } from "@/engine/types";

// ---------- usuários / auth ----------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  plan: text("plan").$type<"free" | "premium">().notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(), // id da assinatura no provedor
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe"),
  status: text("status").notNull(),
  priceId: text("price_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- dados-base compartilhados ----------

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  flag: text("flag").notNull(),
  inspiration: text("inspiration").notNull(),
  level: integer("level").notNull(),
  isFree: boolean("is_free").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const clubs = pgTable(
  "clubs",
  {
    id: integer("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    city: text("city").notNull(),
    stadium: text("stadium").notNull(),
    primaryColor: text("primary_color").notNull(),
    secondaryColor: text("secondary_color").notNull(),
    crest: jsonb("crest").$type<CrestSpec>().notNull(),
    strength: integer("strength").notNull(),
    defaultFormation: text("default_formation").$type<Formation>().notNull(),
  },
  (t) => [index("clubs_league_idx").on(t.leagueId)],
);

export const players = pgTable(
  "players",
  {
    id: integer("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    shortName: text("short_name").notNull(),
    nationality: text("nationality").notNull(),
    age: integer("age").notNull(),
    position: text("position").$type<Position>().notNull(),
    foot: text("foot").notNull(),
    height: integer("height").notNull(),
    archetype: text("archetype").notNull(),
    attributes: jsonb("attributes").$type<Attributes>().notNull(),
    traits: jsonb("traits").$type<Traits>().notNull(),
    potential: integer("potential").notNull(),
    overall: integer("overall").notNull(),
    value: integer("value").notNull(),
    wage: integer("wage").notNull(),
    shirtNumber: integer("shirt_number").notNull(),
    scoutReport: text("scout_report"),
  },
  (t) => [index("players_club_idx").on(t.clubId)],
);

// ---------- carreira ----------

export interface Lineup {
  /** ids na ordem dos slots da formação */
  starters: number[];
  bench: number[];
}

export const careers = pgTable(
  "careers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    season: integer("season").notNull().default(1),
    currentRound: integer("current_round").notNull().default(1),
    totalRounds: integer("total_rounds").notNull(),
    status: text("status").$type<"active" | "season_over">().notNull().default("active"),
    tactics: jsonb("tactics").$type<Tactics>().notNull(),
    lineup: jsonb("lineup").$type<Lineup>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("careers_user_idx").on(t.userId)],
);

export const careerPlayerState = pgTable(
  "career_player_state",
  {
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    /** clube atual na carreira (preparado para transferências) */
    clubId: integer("club_id").notNull(),
    condition: real("condition").notNull().default(100),
    morale: real("morale").notNull().default(60),
    yellowAccum: integer("yellow_accum").notNull().default(0),
    suspendedRounds: integer("suspended_rounds").notNull().default(0),
    injuryDays: integer("injury_days").notNull().default(0),
    ageDelta: integer("age_delta").notNull().default(0),
    progression: integer("progression").notNull().default(0),
    // estatísticas da temporada
    appearances: integer("appearances").notNull().default(0),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    yellows: integer("yellows").notNull().default(0),
    reds: integer("reds").notNull().default(0),
    ratingSum: real("rating_sum").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.careerId, t.playerId] }), index("cps_club_idx").on(t.careerId, t.clubId)],
);

export const fixtures = pgTable(
  "fixtures",
  {
    id: serial("id").primaryKey(),
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    homeClubId: integer("home_club_id").notNull(),
    awayClubId: integer("away_club_id").notNull(),
    played: boolean("played").notNull().default(false),
    homeGoals: integer("home_goals"),
    awayGoals: integer("away_goals"),
    matchId: integer("match_id"),
  },
  (t) => [index("fixtures_round_idx").on(t.careerId, t.season, t.round)],
);

export interface MatchSnapshot {
  /** entrada completa do motor (para recalcular frames no replay) */
  input: MatchInput;
  engineVersion: number;
}

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    fixtureId: integer("fixture_id").notNull(),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    homeClubId: integer("home_club_id").notNull(),
    awayClubId: integer("away_club_id").notNull(),
    homeGoals: integer("home_goals").notNull().default(0),
    awayGoals: integer("away_goals").notNull().default(0),
    seed: integer("seed").notNull(),
    isUserMatch: boolean("is_user_match").notNull().default(false),
    status: text("status").$type<"live" | "finished">().notNull().default("finished"),
    stats: jsonb("stats").$type<{ home: TeamStats; away: TeamStats }>(),
    snapshot: jsonb("snapshot").$type<MatchSnapshot>(),
    changes: jsonb("changes").$type<MatchChange[]>().notNull().default([]),
    /** avaliação dos jogadores do jogo (id → nota) */
    ratings: jsonb("ratings").$type<Record<string, number>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("matches_career_idx").on(t.careerId, t.season, t.round)],
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    careerId: text("career_id").notNull(),
    eventKey: text("event_key").notNull(),
    minute: integer("minute").notNull(),
    type: text("type").$type<MatchEvent["type"]>().notNull(),
    side: text("side"),
    playerId: integer("player_id"),
    otherPlayerId: integer("other_player_id"),
    detail: jsonb("detail"),
  },
  (t) => [index("match_events_match_idx").on(t.matchId)],
);

export const matchNarrations = pgTable(
  "match_narrations",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    text: text("text").notNull(),
    source: text("source").$type<"ai" | "template">().notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.eventKey] })],
);

export const standings = pgTable(
  "standings",
  {
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    clubId: integer("club_id").notNull(),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    drawn: integer("drawn").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    points: integer("points").notNull().default(0),
    form: text("form").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.careerId, t.season, t.clubId] })],
);

export const careerNews = pgTable(
  "career_news",
  {
    id: serial("id").primaryKey(),
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("career_news_idx").on(t.careerId)],
);

export const seasonHistory = pgTable(
  "season_history",
  {
    careerId: text("career_id")
      .notNull()
      .references(() => careers.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    championClubId: integer("champion_club_id").notNull(),
    userPosition: integer("user_position").notNull(),
    userPoints: integer("user_points").notNull(),
    topScorerId: integer("top_scorer_id"),
    topScorerGoals: integer("top_scorer_goals"),
  },
  (t) => [primaryKey({ columns: [t.careerId, t.season] })],
);

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<"narration" | "scout">().notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    success: boolean("success").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_idx").on(t.userId, t.createdAt)],
);
