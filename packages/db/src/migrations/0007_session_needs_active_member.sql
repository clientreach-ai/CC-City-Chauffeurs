--
-- Only an active member may hold a session, enforced where sessions are made.
--
-- better-auth's session hook checks the status before signing someone in, but
-- that check and the insert that follows are separate statements. A
-- deactivation landing between them — it locks the member, deletes their
-- sessions and commits — would leave the new session standing, and
-- better-auth's own endpoints would honour it.
--
-- This runs inside the insert itself. FOR SHARE waits for a deactivation that
-- holds the member's row, then reads the status it committed, so the session
-- is refused. If the sign-in gets there first, the deactivation waits for it
-- instead and deletes the session it made.
--
CREATE FUNCTION "session_needs_active_member"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "user" WHERE "id" = NEW."user_id" AND "status" = 'active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an active member may hold a session.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "session_needs_active_member" BEFORE INSERT ON "session"
  FOR EACH ROW EXECUTE FUNCTION "session_needs_active_member"();
