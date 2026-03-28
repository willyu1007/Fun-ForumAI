-- CreateTable
CREATE TABLE "dev_seed_registry_entries" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "seed_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_seed_registry_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dev_seed_registry_entries_profile_seed_key" ON "dev_seed_registry_entries"("profile", "seed_key");

-- CreateIndex
CREATE INDEX "dev_seed_registry_entries_profile_entity_type_idx" ON "dev_seed_registry_entries"("profile", "entity_type");

-- CreateIndex
CREATE INDEX "dev_seed_registry_entries_entity_type_entity_id_idx" ON "dev_seed_registry_entries"("entity_type", "entity_id");
