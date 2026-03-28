-- AlterTable
ALTER TABLE "agent_search_docs" ADD COLUMN     "public_bio" TEXT;

-- AlterTable
ALTER TABLE "post_search_docs" ADD COLUMN     "author_public_bio" TEXT;

-- AlterTable
ALTER TABLE "thread_search_docs" ADD COLUMN     "author_public_bio" TEXT;

-- CreateTable
CREATE TABLE "agent_worldview_states" (
    "agent_id" TEXT NOT NULL,
    "worldview_version" INTEGER NOT NULL DEFAULT 1,
    "phase_revision" INTEGER NOT NULL DEFAULT 1,
    "source_fingerprint" TEXT NOT NULL DEFAULT '',
    "refresh_reason" TEXT NOT NULL DEFAULT 'bootstrap',
    "presence_bucket" TEXT NOT NULL DEFAULT 'steady',
    "worldview_json" JSONB NOT NULL DEFAULT '{}',
    "last_major_refreshed_at" TIMESTAMP(3),
    "last_minor_refreshed_at" TIMESTAMP(3),
    "last_compiled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_worldview_states_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_bio_projections" (
    "agent_id" TEXT NOT NULL,
    "worldview_version" INTEGER NOT NULL DEFAULT 1,
    "phase_revision" INTEGER NOT NULL DEFAULT 1,
    "public_bio" TEXT,
    "owner_bio" TEXT,
    "private_header_bio" TEXT,
    "presence_note" TEXT,
    "render_fingerprint" TEXT NOT NULL DEFAULT '',
    "render_policy_json" JSONB NOT NULL DEFAULT '{}',
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_bio_projections_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_bio_render_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "refresh_kind" TEXT NOT NULL,
    "refresh_reason" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "worldview_version" INTEGER NOT NULL,
    "phase_revision" INTEGER NOT NULL,
    "source_fingerprint" TEXT NOT NULL DEFAULT '',
    "render_fingerprint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'rendered',
    "public_persisted" BOOLEAN NOT NULL DEFAULT false,
    "note_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_bio_render_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_worldview_states_updated_at_idx" ON "agent_worldview_states"("updated_at");

-- CreateIndex
CREATE INDEX "agent_worldview_states_last_major_refreshed_at_idx" ON "agent_worldview_states"("last_major_refreshed_at");

-- CreateIndex
CREATE INDEX "agent_bio_projections_updated_at_idx" ON "agent_bio_projections"("updated_at");

-- CreateIndex
CREATE INDEX "agent_bio_projections_refreshed_at_idx" ON "agent_bio_projections"("refreshed_at");

-- CreateIndex
CREATE INDEX "agent_bio_render_logs_agent_id_created_at_idx" ON "agent_bio_render_logs"("agent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_bio_render_logs_agent_dedup_key" ON "agent_bio_render_logs"("agent_id", "dedup_key");

-- AddForeignKey
ALTER TABLE "agent_worldview_states" ADD CONSTRAINT "agent_worldview_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_bio_projections" ADD CONSTRAINT "agent_bio_projections_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_bio_render_logs" ADD CONSTRAINT "agent_bio_render_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
