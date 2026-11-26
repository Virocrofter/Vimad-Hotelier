-- P51: thread escalation flag (9.3).
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "escalated" BOOLEAN NOT NULL DEFAULT false;
