-- CreateTable
CREATE TABLE "visual_directives" (
    "id" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL DEFAULT 'visual-directive.v1',
    "scene_ref" JSONB NOT NULL,
    "goal" JSONB NOT NULL,
    "narrative_context" JSONB NOT NULL,
    "sourcing_policy" JSONB NOT NULL,
    "guardrails" JSONB NOT NULL,
    "budget" JSONB NOT NULL,
    "audit" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_directives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_plans" (
    "id" TEXT NOT NULL,
    "directive_id" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL DEFAULT 'image-plan.v1',
    "scene_ref" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "runtime" JSONB NOT NULL,
    "display" JSONB NOT NULL,
    "generation" JSONB NOT NULL,
    "selected_sources" JSONB NOT NULL,
    "planner_audit" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visual_directives_created_at_idx" ON "visual_directives"("created_at");

-- CreateIndex
CREATE INDEX "image_plans_directive_id_created_at_idx" ON "image_plans"("directive_id", "created_at");

-- CreateIndex
CREATE INDEX "image_plans_status_created_at_idx" ON "image_plans"("status", "created_at");

-- AddForeignKey
ALTER TABLE "image_plans" ADD CONSTRAINT "image_plans_directive_id_fkey" FOREIGN KEY ("directive_id") REFERENCES "visual_directives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
