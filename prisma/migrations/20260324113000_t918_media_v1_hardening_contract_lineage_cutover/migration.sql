-- T-918 media v1 hardening contract + lineage cutover

ALTER TABLE "media_generation_jobs"
  ALTER COLUMN "prompt_brief" DROP NOT NULL,
  ADD COLUMN "generation_spec" JSONB,
  ADD COLUMN "compiled_prompt" JSONB,
  ADD COLUMN "audit_decision" JSONB,
  ADD COLUMN "provider_request_summary" JSONB;

UPDATE "media_generation_jobs"
SET
  "generation_spec" = COALESCE("generation_spec", '{}'::jsonb),
  "compiled_prompt" = COALESCE("compiled_prompt", '{}'::jsonb);

ALTER TABLE "media_generation_jobs"
  ALTER COLUMN "generation_spec" SET NOT NULL,
  ALTER COLUMN "compiled_prompt" SET NOT NULL;

ALTER TABLE "media_rollout_controller_overrides"
  ADD COLUMN "semantic_v3_enforced" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "strict_audit_enforced" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lineage_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "root_post_attachment_only" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "media_lineage_edges" (
  "id" TEXT NOT NULL,
  "from_node_type" TEXT NOT NULL,
  "from_node_id" TEXT NOT NULL,
  "to_node_type" TEXT NOT NULL,
  "to_node_id" TEXT NOT NULL,
  "edge_kind" TEXT NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_lineage_edges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_lineage_edges_from_node_type_from_node_id_created_at_idx"
  ON "media_lineage_edges"("from_node_type", "from_node_id", "created_at");

CREATE INDEX "media_lineage_edges_to_node_type_to_node_id_created_at_idx"
  ON "media_lineage_edges"("to_node_type", "to_node_id", "created_at");

CREATE INDEX "media_lineage_edges_edge_kind_created_at_idx"
  ON "media_lineage_edges"("edge_kind", "created_at");
