DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'vector'
  ) THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
  END IF;
END $$;

ALTER TABLE "media_assets"
  ADD COLUMN "duplicate_cluster_id" TEXT,
  ADD COLUMN "duplicate_distance" DOUBLE PRECISION;

CREATE TABLE "media_catalog_cards" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "semantic_snapshot_id" TEXT,
  "schema_version" TEXT NOT NULL DEFAULT 'media-catalog-card.v1',
  "modality" TEXT NOT NULL,
  "source_kind" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "build_status" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_catalog_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_duplicate_clusters" (
  "id" TEXT NOT NULL,
  "duplicate_kind" TEXT NOT NULL,
  "canonical_asset_id" TEXT NOT NULL,
  "evidence_json" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_duplicate_clusters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_retrieval_documents" (
  "id" TEXT NOT NULL,
  "doc_key" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "catalog_card_id" TEXT,
  "duplicate_cluster_id" TEXT,
  "schema_version" TEXT NOT NULL DEFAULT 'media-retrieval-doc.v1',
  "doc_scope" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "track_kind" TEXT,
  "segment_start_ms" INTEGER,
  "segment_end_ms" INTEGER,
  "source_kind" TEXT NOT NULL,
  "owner_user_id" TEXT,
  "steward_agent_id" TEXT,
  "community_id" TEXT,
  "is_canonical" BOOLEAN NOT NULL DEFAULT true,
  "lifecycle_status" TEXT NOT NULL DEFAULT 'active',
  "document_text" TEXT NOT NULL,
  "document_hash" TEXT NOT NULL,
  "document_meta_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_retrieval_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_embedding_snapshots" (
  "id" TEXT NOT NULL,
  "retrieval_document_id" TEXT NOT NULL,
  "index_profile_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "output_type" TEXT NOT NULL,
  "vector_dimension" INTEGER NOT NULL,
  "document_content_hash" TEXT NOT NULL,
  "embedding_hash" TEXT NOT NULL,
  "search_status" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "activated_at" TIMESTAMP(3),
  "error_code" TEXT,
  "error_message" TEXT,
  "provider_request_summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_embedding_snapshots_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
  ) THEN
    EXECUTE 'ALTER TABLE "media_embedding_snapshots" ADD COLUMN "embedding_vector" vector(1024)';
  ELSE
    EXECUTE 'ALTER TABLE "media_embedding_snapshots" ADD COLUMN "embedding_vector" TEXT';
  END IF;
END $$;

CREATE TABLE "media_import_jobs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "entrypoint" TEXT NOT NULL,
  "requested_by_type" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "manifest_version" INTEGER NOT NULL,
  "intent_fingerprint" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "staging_manifest_key" TEXT NOT NULL,
  "normalized_manifest_key" TEXT,
  "result_manifest_key" TEXT,
  "failure_log_key" TEXT,
  "scope_summary_json" JSONB NOT NULL,
  "total_items" INTEGER NOT NULL DEFAULT 0,
  "processed_items" INTEGER NOT NULL DEFAULT 0,
  "created_items" INTEGER NOT NULL DEFAULT 0,
  "reused_items" INTEGER NOT NULL DEFAULT 0,
  "suppressed_items" INTEGER NOT NULL DEFAULT 0,
  "failed_items" INTEGER NOT NULL DEFAULT 0,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "failed_phase" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "claimed_by_worker" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "last_heartbeat_at" TIMESTAMP(3),
  "retry_of_job_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_import_job_items" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_index" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "input_kind" TEXT NOT NULL,
  "source_kind" TEXT NOT NULL,
  "index_scope" TEXT NOT NULL,
  "owner_user_id" TEXT,
  "steward_agent_id" TEXT,
  "community_id" TEXT,
  "staging_object_key" TEXT,
  "origin_url" TEXT,
  "source_asset_id" TEXT,
  "generated_job_id" TEXT,
  "duplicate_cluster_id" TEXT,
  "declared_sha256" TEXT,
  "mime_type" TEXT,
  "file_size_bytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "failed_phase" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "resolved_asset_id" TEXT,
  "resolved_request_json" JSONB NOT NULL,
  "result_summary_json" JSONB,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_import_job_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_retrieval_documents_doc_key_key" ON "media_retrieval_documents"("doc_key");
CREATE UNIQUE INDEX "media_import_jobs_request_fingerprint_key" ON "media_import_jobs"("request_fingerprint");
CREATE UNIQUE INDEX "media_import_job_items_job_id_item_id_key" ON "media_import_job_items"("job_id", "item_id");

CREATE INDEX "media_assets_duplicate_cluster_id_created_at_idx" ON "media_assets"("duplicate_cluster_id", "created_at");
CREATE INDEX "media_catalog_cards_asset_id_is_current_created_at_idx" ON "media_catalog_cards"("asset_id", "is_current", "created_at");
CREATE INDEX "media_catalog_cards_source_kind_build_status_created_at_idx" ON "media_catalog_cards"("source_kind", "build_status", "created_at");
CREATE INDEX "media_catalog_cards_semantic_snapshot_id_created_at_idx" ON "media_catalog_cards"("semantic_snapshot_id", "created_at");
CREATE INDEX "media_duplicate_clusters_duplicate_kind_status_created_at_idx" ON "media_duplicate_clusters"("duplicate_kind", "status", "created_at");
CREATE INDEX "media_duplicate_clusters_canonical_asset_id_idx" ON "media_duplicate_clusters"("canonical_asset_id");
CREATE INDEX "media_retrieval_documents_asset_id_doc_scope_created_at_idx" ON "media_retrieval_documents"("asset_id", "doc_scope", "created_at");
CREATE INDEX "media_retrieval_documents_doc_scope_source_kind_created_at_idx" ON "media_retrieval_documents"("doc_scope", "source_kind", "created_at");
CREATE INDEX "media_retrieval_documents_community_id_doc_scope_created_at_idx" ON "media_retrieval_documents"("community_id", "doc_scope", "created_at");
CREATE INDEX "media_retrieval_documents_owner_user_id_doc_scope_created_at_idx" ON "media_retrieval_documents"("owner_user_id", "doc_scope", "created_at");
CREATE INDEX "media_retrieval_documents_duplicate_cluster_id_is_canonical_created_at_idx" ON "media_retrieval_documents"("duplicate_cluster_id", "is_canonical", "created_at");
CREATE INDEX "media_retrieval_documents_lifecycle_status_created_at_idx" ON "media_retrieval_documents"("lifecycle_status", "created_at");
CREATE INDEX "media_embedding_snapshots_retrieval_document_id_index_profile_id_is_active_created_at_idx" ON "media_embedding_snapshots"("retrieval_document_id", "index_profile_id", "is_active", "created_at");
CREATE INDEX "media_embedding_snapshots_index_profile_id_search_status_created_at_idx" ON "media_embedding_snapshots"("index_profile_id", "search_status", "created_at");
CREATE INDEX "media_embedding_snapshots_created_at_idx" ON "media_embedding_snapshots"("created_at");
CREATE UNIQUE INDEX "media_embedding_snapshots_one_active_per_doc_profile" ON "media_embedding_snapshots"("retrieval_document_id", "index_profile_id") WHERE "is_active" = true;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
  ) THEN
    EXECUTE 'CREATE INDEX "media_embedding_snapshots_hnsw_active_text_embedding_v4_1024" ON "media_embedding_snapshots" USING hnsw ("embedding_vector" vector_cosine_ops)
      WHERE "index_profile_id" = ''text-embedding-v4-1024''
        AND "is_active" = true
        AND "search_status" = ''searchable''
        AND "embedding_vector" IS NOT NULL';
  END IF;
END $$;
CREATE INDEX "media_import_jobs_intent_fingerprint_created_at_idx" ON "media_import_jobs"("intent_fingerprint", "created_at");
CREATE INDEX "media_import_jobs_status_created_at_idx" ON "media_import_jobs"("status", "created_at");
CREATE INDEX "media_import_jobs_phase_updated_at_idx" ON "media_import_jobs"("phase", "updated_at");
CREATE INDEX "media_import_jobs_entrypoint_created_at_idx" ON "media_import_jobs"("entrypoint", "created_at");
CREATE INDEX "media_import_jobs_requested_by_type_requested_by_id_created_at_idx" ON "media_import_jobs"("requested_by_type", "requested_by_id", "created_at");
CREATE INDEX "media_import_jobs_retry_of_job_id_idx" ON "media_import_jobs"("retry_of_job_id");
CREATE INDEX "media_import_jobs_last_heartbeat_at_idx" ON "media_import_jobs"("last_heartbeat_at");
CREATE INDEX "media_import_job_items_job_id_item_index_idx" ON "media_import_job_items"("job_id", "item_index");
CREATE INDEX "media_import_job_items_job_id_status_item_index_idx" ON "media_import_job_items"("job_id", "status", "item_index");
CREATE INDEX "media_import_job_items_resolved_asset_id_idx" ON "media_import_job_items"("resolved_asset_id");
CREATE INDEX "media_import_job_items_source_asset_id_idx" ON "media_import_job_items"("source_asset_id");
CREATE INDEX "media_import_job_items_generated_job_id_idx" ON "media_import_job_items"("generated_job_id");
CREATE INDEX "media_import_job_items_duplicate_cluster_id_idx" ON "media_import_job_items"("duplicate_cluster_id");
CREATE INDEX "media_import_job_items_community_id_created_at_idx" ON "media_import_job_items"("community_id", "created_at");
CREATE INDEX "media_import_job_items_owner_user_id_created_at_idx" ON "media_import_job_items"("owner_user_id", "created_at");
CREATE INDEX "media_import_job_items_steward_agent_id_created_at_idx" ON "media_import_job_items"("steward_agent_id", "created_at");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_duplicate_cluster_id_fkey"
  FOREIGN KEY ("duplicate_cluster_id") REFERENCES "media_duplicate_clusters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_catalog_cards"
  ADD CONSTRAINT "media_catalog_cards_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_catalog_cards"
  ADD CONSTRAINT "media_catalog_cards_semantic_snapshot_id_fkey"
  FOREIGN KEY ("semantic_snapshot_id") REFERENCES "media_semantic_snapshots"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_duplicate_clusters"
  ADD CONSTRAINT "media_duplicate_clusters_canonical_asset_id_fkey"
  FOREIGN KEY ("canonical_asset_id") REFERENCES "media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_retrieval_documents"
  ADD CONSTRAINT "media_retrieval_documents_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_retrieval_documents"
  ADD CONSTRAINT "media_retrieval_documents_catalog_card_id_fkey"
  FOREIGN KEY ("catalog_card_id") REFERENCES "media_catalog_cards"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_retrieval_documents"
  ADD CONSTRAINT "media_retrieval_documents_duplicate_cluster_id_fkey"
  FOREIGN KEY ("duplicate_cluster_id") REFERENCES "media_duplicate_clusters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_embedding_snapshots"
  ADD CONSTRAINT "media_embedding_snapshots_retrieval_document_id_fkey"
  FOREIGN KEY ("retrieval_document_id") REFERENCES "media_retrieval_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_import_jobs"
  ADD CONSTRAINT "media_import_jobs_retry_of_job_id_fkey"
  FOREIGN KEY ("retry_of_job_id") REFERENCES "media_import_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_import_job_items"
  ADD CONSTRAINT "media_import_job_items_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "media_import_jobs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_import_job_items"
  ADD CONSTRAINT "media_import_job_items_source_asset_id_fkey"
  FOREIGN KEY ("source_asset_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_import_job_items"
  ADD CONSTRAINT "media_import_job_items_resolved_asset_id_fkey"
  FOREIGN KEY ("resolved_asset_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_import_job_items"
  ADD CONSTRAINT "media_import_job_items_generated_job_id_fkey"
  FOREIGN KEY ("generated_job_id") REFERENCES "media_generation_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_import_job_items"
  ADD CONSTRAINT "media_import_job_items_duplicate_cluster_id_fkey"
  FOREIGN KEY ("duplicate_cluster_id") REFERENCES "media_duplicate_clusters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
