ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'DELETED';

ALTER TABLE "agents"
ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "agents_deleted_at_idx" ON "agents"("deleted_at");
