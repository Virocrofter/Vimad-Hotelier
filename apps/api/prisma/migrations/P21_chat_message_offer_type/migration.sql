-- P21: conversational upsell - message type + payload for offer cards
ALTER TABLE "chat_messages" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "chat_messages" ADD COLUMN "payload" JSONB;
