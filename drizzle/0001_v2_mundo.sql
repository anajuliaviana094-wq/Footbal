CREATE SEQUENCE "public"."youth_player_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000000 CACHE 1;--> statement-breakpoint
CREATE TABLE "career_clubs" (
	"career_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"league_id" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"academy_level" integer DEFAULT 1 NOT NULL,
	"capacity" integer DEFAULT 20000 NOT NULL,
	CONSTRAINT "career_clubs_career_id_club_id_pk" PRIMARY KEY("career_id","club_id")
);
--> statement-breakpoint
CREATE TABLE "career_members" (
	"career_id" text NOT NULL,
	"user_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"tactics" jsonb NOT NULL,
	"lineup" jsonb,
	"ready" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "career_members_career_id_user_id_pk" PRIMARY KEY("career_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "career_seasons" (
	"career_id" text NOT NULL,
	"season" integer NOT NULL,
	"competition_id" text NOT NULL,
	"competition" text NOT NULL,
	"champion_club_id" integer NOT NULL,
	"runner_up_club_id" integer,
	"top_scorer_id" integer,
	"top_scorer_goals" integer,
	"promoted" jsonb,
	"relegated" jsonb,
	CONSTRAINT "career_seasons_career_id_season_competition_id_pk" PRIMARY KEY("career_id","season","competition_id")
);
--> statement-breakpoint
CREATE TABLE "club_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"season" integer NOT NULL,
	"day" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"career_id" text NOT NULL,
	"player_id" integer NOT NULL,
	"seller_club_id" integer NOT NULL,
	"buyer_club_id" integer NOT NULL,
	"fee" bigint NOT NULL,
	"wage" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"season" integer NOT NULL,
	"created_day" integer NOT NULL,
	"expires_day" integer NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_news" ADD COLUMN "club_id" integer;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD COLUMN "wage" integer;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD COLUMN "squad_role" text DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD COLUMN "transfer_listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD COLUMN "asking_price" bigint;--> statement-breakpoint
ALTER TABLE "career_player_state" ADD COLUMN "since_season" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "system_id" text;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "calendar" jsonb;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "is_multiplayer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "league_id" text;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "competition" text DEFAULT 'league' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "stage" integer;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "winner_club_id" integer;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "penalties" text;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "system_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "tier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "career_id" text;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "league_id" text;--> statement-breakpoint
ALTER TABLE "career_clubs" ADD CONSTRAINT "career_clubs_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_members" ADD CONSTRAINT "career_members_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_members" ADD CONSTRAINT "career_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_seasons" ADD CONSTRAINT "career_seasons_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_transactions" ADD CONSTRAINT "club_transactions_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_offers" ADD CONSTRAINT "transfer_offers_career_id_careers_id_fk" FOREIGN KEY ("career_id") REFERENCES "public"."careers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_clubs_league_idx" ON "career_clubs" USING btree ("career_id","league_id");--> statement-breakpoint
CREATE UNIQUE INDEX "career_members_club_idx" ON "career_members" USING btree ("career_id","club_id");--> statement-breakpoint
CREATE INDEX "career_members_user_idx" ON "career_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "club_tx_idx" ON "club_transactions" USING btree ("career_id","club_id","season");--> statement-breakpoint
CREATE INDEX "transfer_offers_idx" ON "transfer_offers" USING btree ("career_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "careers_invite_idx" ON "careers" USING btree ("invite_code");