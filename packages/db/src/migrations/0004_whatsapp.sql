--
-- WhatsApp: the numbers that write to us, the conversations held with them,
-- every message in both directions, and a record of each assistant turn.
--
-- One business, so no tenant column anywhere.
--
-- Idempotency is held by the database, in two layers, because a provider
-- retries a webhook whenever it is unsure the first attempt landed:
--
--   1. whatsapp_message_provider_idx — the provider's own message id may be
--      stored once. A retry of the same message cannot make a second row.
--   2. whatsapp_agent_run.triggering_message_id is UNIQUE — one assistant
--      run per inbound message, ever, so a message cannot be answered twice.
--
-- And one rule about conversations: a number has at most one that is not
-- closed. A closed conversation is history and is never reopened.
--
CREATE TABLE "whatsapp_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"customer_id" text,
	"profile_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_identity_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"identity_id" text NOT NULL,
	"customer_id" text,
	"status" text DEFAULT 'ai_active' NOT NULL,
	"state" jsonb DEFAULT '{"journey":{},"references":[]}'::jsonb NOT NULL,
	"handoff_reason" text,
	"handoff_summary" text,
	"last_inbound_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"direction" text NOT NULL,
	"author" text NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"delivery" text NOT NULL,
	"error_code" text,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "whatsapp_message_body_length" CHECK (char_length("body") <= 4096)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_agent_run" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"triggering_message_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"model" text,
	"iterations" integer,
	"tool_calls" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"error_code" text,
	"duration_ms" integer,
	"reply_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "whatsapp_agent_run_triggering_message_id_unique" UNIQUE("triggering_message_id")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_identity" ADD CONSTRAINT "whatsapp_identity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversation" ADD CONSTRAINT "whatsapp_conversation_identity_id_whatsapp_identity_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."whatsapp_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversation" ADD CONSTRAINT "whatsapp_conversation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_conversation_id_whatsapp_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_run" ADD CONSTRAINT "whatsapp_agent_run_conversation_id_whatsapp_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_run" ADD CONSTRAINT "whatsapp_agent_run_triggering_message_id_whatsapp_message_id_fk" FOREIGN KEY ("triggering_message_id") REFERENCES "public"."whatsapp_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
--
-- One open conversation per number. Partial, so any number of closed ones
-- may sit behind it as history.
--
CREATE UNIQUE INDEX "whatsapp_conversation_open_idx" ON "whatsapp_conversation" USING btree ("identity_id") WHERE "status" <> 'closed';--> statement-breakpoint
CREATE INDEX "whatsapp_conversation_status_idx" ON "whatsapp_conversation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_conversation_last_message_idx" ON "whatsapp_conversation" USING btree ("last_message_at");--> statement-breakpoint
--
-- Partial, because an outbound message has no provider id until it is sent,
-- and any number of those may be waiting at once.
--
CREATE UNIQUE INDEX "whatsapp_message_provider_idx" ON "whatsapp_message" USING btree ("provider","provider_message_id") WHERE "provider_message_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_message_conversation_idx" ON "whatsapp_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_agent_run_status_idx" ON "whatsapp_agent_run" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_agent_run_conversation_idx" ON "whatsapp_agent_run" USING btree ("conversation_id");
