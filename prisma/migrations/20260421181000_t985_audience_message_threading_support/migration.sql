-- AlterTable
ALTER TABLE "audience_messages"
ADD COLUMN "parent_message_id" TEXT,
ADD COLUMN "quoted_turn_id" TEXT,
ADD COLUMN "quoted_turn_excerpt" TEXT,
ADD COLUMN "quoted_turn_author_name" TEXT,
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audience_message_likes" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_message_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audience_messages_parent_message_id_created_at_idx" ON "audience_messages"("parent_message_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audience_message_likes_message_id_user_id_key" ON "audience_message_likes"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "audience_message_likes_user_id_created_at_idx" ON "audience_message_likes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "audience_messages"
ADD CONSTRAINT "audience_messages_parent_message_id_fkey"
FOREIGN KEY ("parent_message_id") REFERENCES "audience_messages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_message_likes"
ADD CONSTRAINT "audience_message_likes_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "audience_messages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_message_likes"
ADD CONSTRAINT "audience_message_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "human_users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
