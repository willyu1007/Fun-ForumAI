-- CreateTable
CREATE TABLE "agent_biography_materials" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "factual_summary" TEXT NOT NULL,
    "actors_json" JSONB NOT NULL DEFAULT '[]',
    "scene_json" JSONB,
    "possible_effects_json" JSONB NOT NULL DEFAULT '[]',
    "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "can_be_turning_point" BOOLEAN NOT NULL DEFAULT false,
    "can_be_later_note" BOOLEAN NOT NULL DEFAULT false,
    "biography_hint" TEXT,
    "deferred_source" BOOLEAN NOT NULL DEFAULT false,
    "raw_ref_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_biography_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_biography_chapters" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "chapter_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "skeleton_json" JSONB NOT NULL DEFAULT '{}',
    "current_revision_id" TEXT,
    "material_count" INTEGER NOT NULL DEFAULT 0,
    "chapter_digest_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_biography_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biography_chapter_revisions" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "body_kind" TEXT NOT NULL DEFAULT 'CHAPTER',
    "skeleton_json" JSONB NOT NULL DEFAULT '{}',
    "body_json" JSONB,
    "later_notes_json" JSONB NOT NULL DEFAULT '[]',
    "material_digest_json" JSONB,
    "writer_config_id" TEXT,
    "model_name" TEXT,
    "prompt_template_id" TEXT,
    "prompt_version" INTEGER,
    "prompt_hash" TEXT,
    "input_hash" TEXT,
    "generation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "factual_audit_json" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biography_chapter_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biography_chapter_material_refs" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "material_role" TEXT NOT NULL,
    "importance_score" DOUBLE PRECISION,
    "contribution_summary" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biography_chapter_material_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biography_book_memories" (
    "agent_id" TEXT NOT NULL,
    "memory_json" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biography_book_memories_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "biography_tone_profiles" (
    "agent_id" TEXT NOT NULL,
    "tone_profile_id" TEXT NOT NULL DEFAULT 'default',
    "profile_json" JSONB NOT NULL DEFAULT '{}',
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biography_tone_profiles_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_biography_compile_states" (
    "agent_id" TEXT NOT NULL,
    "dirty" BOOLEAN NOT NULL DEFAULT false,
    "dirty_reasons_json" JSONB,
    "last_material_id" TEXT,
    "last_compiled_material_id" TEXT,
    "active_chapter_id" TEXT,
    "skeleton_revision" INTEGER NOT NULL DEFAULT 0,
    "published_body_revision" INTEGER,
    "compile_status" TEXT NOT NULL DEFAULT 'CLEAN',
    "latest_material_digest_json" JSONB,
    "stale_since" TIMESTAMP(3),
    "last_compiled_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_biography_compile_states_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_biography_book_views" (
    "agent_id" TEXT NOT NULL,
    "view_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_biography_book_views_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_biography_read_telemetry_events" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "chapter_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_at" TIMESTAMP(3) NOT NULL,
    "is_owner_view" BOOLEAN NOT NULL DEFAULT false,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_biography_read_telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_biography_writer_telemetry_events" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "prompt_template_id" TEXT,
    "prompt_version" INTEGER,
    "model_name" TEXT,
    "provider_id" TEXT,
    "input_hash" TEXT,
    "render_fingerprint" TEXT,
    "publish_status" TEXT NOT NULL,
    "audit_status" TEXT,
    "privacy_blocked" BOOLEAN NOT NULL DEFAULT false,
    "unsupported_claim_count" INTEGER NOT NULL DEFAULT 0,
    "invented_entity_count" INTEGER NOT NULL DEFAULT 0,
    "invented_relationship_count" INTEGER NOT NULL DEFAULT 0,
    "later_note_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_biography_writer_telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_biography_materials_agent_id_occurred_at_idx" ON "agent_biography_materials"("agent_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_biography_materials_agent_source_key" ON "agent_biography_materials"("agent_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "agent_biography_chapters_agent_id_status_idx" ON "agent_biography_chapters"("agent_id", "status");

-- CreateIndex
CREATE INDEX "agent_biography_chapters_agent_id_updated_at_idx" ON "agent_biography_chapters"("agent_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_biography_chapters_agent_chapter_no" ON "agent_biography_chapters"("agent_id", "chapter_no");

-- CreateIndex
CREATE INDEX "biography_chapter_revisions_chapter_id_created_at_idx" ON "biography_chapter_revisions"("chapter_id", "created_at");

-- CreateIndex
CREATE INDEX "biography_chapter_revisions_agent_id_created_at_idx" ON "biography_chapter_revisions"("agent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "biography_chapter_revisions_chapter_revision_no" ON "biography_chapter_revisions"("chapter_id", "revision_no");

-- CreateIndex
CREATE INDEX "biography_chapter_material_refs_chapter_id_idx" ON "biography_chapter_material_refs"("chapter_id");

-- CreateIndex
CREATE INDEX "biography_chapter_material_refs_agent_id_occurred_at_idx" ON "biography_chapter_material_refs"("agent_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "biography_chapter_material_refs_source_key" ON "biography_chapter_material_refs"("chapter_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "biography_tone_profiles_updated_at_idx" ON "biography_tone_profiles"("updated_at");

-- CreateIndex
CREATE INDEX "agent_biography_compile_states_dirty_updated_at_idx" ON "agent_biography_compile_states"("dirty", "updated_at");

-- CreateIndex
CREATE INDEX "agent_biography_book_views_updated_at_idx" ON "agent_biography_book_views"("updated_at");

-- CreateIndex
CREATE INDEX "agent_biography_read_telemetry_events_agent_id_event_at_idx" ON "agent_biography_read_telemetry_events"("agent_id", "event_at");

-- CreateIndex
CREATE INDEX "agent_biography_writer_telemetry_events_agent_id_created_at_idx" ON "agent_biography_writer_telemetry_events"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_biography_materials" ADD CONSTRAINT "agent_biography_materials_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_biography_chapters" ADD CONSTRAINT "agent_biography_chapters_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biography_chapter_revisions" ADD CONSTRAINT "biography_chapter_revisions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biography_book_memories" ADD CONSTRAINT "biography_book_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biography_tone_profiles" ADD CONSTRAINT "biography_tone_profiles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_biography_compile_states" ADD CONSTRAINT "agent_biography_compile_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_biography_book_views" ADD CONSTRAINT "agent_biography_book_views_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_biography_read_telemetry_events" ADD CONSTRAINT "agent_biography_read_telemetry_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_biography_writer_telemetry_events" ADD CONSTRAINT "agent_biography_writer_telemetry_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
