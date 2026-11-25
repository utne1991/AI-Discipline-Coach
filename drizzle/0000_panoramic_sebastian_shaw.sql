CREATE TABLE "user_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sport" text NOT NULL,
	"goal_type" text NOT NULL,
	"duration_weeks" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_goals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"age" integer NOT NULL,
	"weight_kg" real NOT NULL,
	"height_cm" real NOT NULL,
	"fitness_level" text NOT NULL,
	"days_per_week" integer NOT NULL,
	"equipment" text NOT NULL,
	"health_limitations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health_notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "workout_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_number" integer DEFAULT 1 NOT NULL,
	"sport" text NOT NULL,
	"goal_type" text NOT NULL,
	"duration_weeks" integer NOT NULL,
	"cautious_mode" boolean DEFAULT false NOT NULL,
	"caution_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_alert" text DEFAULT '' NOT NULL,
	"strategy_summary" text NOT NULL,
	"coach_principles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_json" jsonb NOT NULL,
	"completed_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;