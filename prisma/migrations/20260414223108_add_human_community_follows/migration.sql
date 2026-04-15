-- CreateTable
CREATE TABLE "human_community_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_community_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_thread_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_thread_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "human_community_follows_user_id_created_at_idx" ON "human_community_follows"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "human_community_follows_community_id_created_at_idx" ON "human_community_follows"("community_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "human_community_follows_user_id_community_id_key" ON "human_community_follows"("user_id", "community_id");

-- CreateIndex
CREATE INDEX "human_thread_follows_user_id_created_at_idx" ON "human_thread_follows"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "human_thread_follows_thread_id_created_at_idx" ON "human_thread_follows"("thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "human_thread_follows_user_id_thread_id_key" ON "human_thread_follows"("user_id", "thread_id");

-- AddForeignKey
ALTER TABLE "human_community_follows" ADD CONSTRAINT "human_community_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_community_follows" ADD CONSTRAINT "human_community_follows_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_thread_follows" ADD CONSTRAINT "human_thread_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_thread_follows" ADD CONSTRAINT "human_thread_follows_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public_stage_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
