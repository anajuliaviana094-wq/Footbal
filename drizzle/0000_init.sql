CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_player_state" (
	"career_id" text NOT NULL,
	"player_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"condition" real DEFAULT 100 NOT NULL,
	"morale" real DEFAULT 60 NOT NULL,
	"yellow_accum" integer DEFAULT 0 NOT NULL,
	"suspended_rounds" integer DEFAULT 0 NOT NULL,
	"injury_days" integer DEFAULT 0 NOT NULL,
	"age_delta" integer DEFAULT 0 NOT NULL,
	"progression" integer DEFAULT 0 NOT NULL,
	"appearances" integer DEFAULT 0 NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"yellows" integer DEFAULT 0 NOT NULL,
	"reds" integer DEFAULT 0 NOT NULL,
	"rating_sum" real DEFAULT 0 NOT NULL,
	CONSTRAINT "career_player_state_career_id_player_id_pk" PRIMARY KEY("career_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "careers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"league_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"total_rounds" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tactics" jsonb NOT NULL,
	"lineup" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" integer PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"city" text NOT NULL,
	"stadium" text NOT NULL,
	"primary_color" text NOT NULL,
	"secondary_color" text NOT NULL,
	"crest" jsonb NOT NULL,
	"strength" integer NOT NULL,
	"default_formation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"home_club_id" integer NOT NULL,
	"away_club_id" integer NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"home_goals" integer,
	"away_goals" integer,
	"match_id" integer
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"flag" text NOT NULL,
	"inspiration" text NOT NULL,
	"level" integer NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"career_id" text NOT NULL,
	"event_key" text NOT NULL,
	"minute" integer NOT NULL,
	"type" text NOT NULL,
	"side" text,
	"player_id" integer,
	"other_player_id" integer,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "match_narrations" (
	"match_id" integer NOT NULL,
	"event_key" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "match_narrations_match_id_event_key_pk" PRIMARY KEY("match_id","event_key")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"fixture_id" integer NOT NULL,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"home_club_id" integer NOT NULL,
	"away_club_id" integer NOT NULL,
	"home_goals" integer DEFAULT 0 NOT NULL,
	"away_goals" integer DEFAULT 0 NOT NULL,
	"seed" integer NOT NULL,
	"is_user_match" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'finished' NOT NULL,
	"stats" jsonb,
	"snapshot" jsonb,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ratings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"short_name" text NOT NULL,
	"nationality" text NOT NULL,
	"age" integer NOT NULL,
	"position" text NOT NULL,
	"foot" text NOT NULL,
	"height" integer NOT NULL,
	"archetype" text NOT NULL,
	"attributes" jsonb NOT NULL,
	"traits" jsonb NOT NULL,
	"potential" integer NOT NULL,
	"overall" integer NOT NULL,
	"value" integer NOT NULL,
	"wage" integer NOT NULL,
	"shirt_number" integer NOT NULL,
	"scout_report" text
);
--> statement-breakpoint
CREATE TABLE "season_history" (
	"career_id" text NOT NULL,
	"season" integer NOT NULL,
	"champion_club_id" integer NOT NULL,
	"user_position" integer NOT NULL,
	"user_points" integer NOT NULL,
	"top_scorer_id" integer,
	"top_scorer_goals" integer,
	CONSTRAINT "season_history_career_id_season_pk" PRIMARY KEY("career_id","season")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"career_id" text NOT NULL,
	"season" integer NOT NULL,
	"club_id" integer NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"drawn" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"form" text DEFAULT '' NOT NULL,
	CONSTRAINT "standings_career_id_season_club_id_pk" PRIMARY KEY("career_id","season","club_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"status" text NOT NULL,
	"price_id" text,
	"current_period_end" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_news" ADD CONSTRAINT "career_news_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD CONSTRAINT "career_player_state_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD CONSTRAINT "career_player_state_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "careers" ADD CONSTRAINT "careers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "careers" ADD CONSTRAINT "careers_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "careers" ADD CONSTRAINT "careers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_narrations" ADD CONSTRAINT "match_narrations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_history" ADD CONSTRAINT "season_history_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "career_news_idx" ON "career_news" USING btree ("career_id");--> statement-breakpoint
CREATE INDEX "cps_club_idx" ON "career_player_state" USING btree ("career_id","club_id");--> statement-breakpoint
CREATE INDEX "careers_user_idx" ON "careers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clubs_league_idx" ON "clubs" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "fixtures_round_idx" ON "fixtures" USING btree ("career_id","season","round");--> statement-breakpoint
CREATE INDEX "match_events_match_idx" ON "match_events" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_career_idx" ON "matches" USING btree ("career_id","season","round");--> statement-breakpoint
CREATE INDEX "players_club_idx" ON "players" USING btree ("club_id");