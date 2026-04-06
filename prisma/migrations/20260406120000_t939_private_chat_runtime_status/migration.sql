CREATE TYPE "PrivateMessageRuntimeStatus" AS ENUM ('READY', 'THINKING', 'FAILED');

ALTER TABLE "private_messages"
  ADD COLUMN "reply_to_message_id" TEXT,
  ADD COLUMN "runtime_status" "PrivateMessageRuntimeStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "runtime_error_code" TEXT;

CREATE INDEX "private_messages_session_id_runtime_status_created_at_idx"
  ON "private_messages"("session_id", "runtime_status", "created_at");

CREATE INDEX "private_messages_reply_to_message_id_idx"
  ON "private_messages"("reply_to_message_id");
