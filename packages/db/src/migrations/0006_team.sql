--
-- The team: invitations into the admin.
--
-- Sign-up stays closed. An admin invites someone, who chooses their own
-- password from a single-use link; until then their account is "invited" and
-- cannot hold a session. "deactivated" keeps the row — and the name on every
-- note it wrote — while refusing to sign it in.
--
-- Every existing account is already in use, so it starts "active".
--
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_status_known" CHECK ("status" IN ('invited', 'active', 'deactivated'));
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "team_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "team_invitation" ADD CONSTRAINT "team_invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "team_invitation_userId_idx" ON "team_invitation" USING btree ("user_id");
