-- AlterTable: human_users — add auth-related fields
ALTER TABLE "human_users" ADD COLUMN "phone" TEXT;
ALTER TABLE "human_users" ADD COLUMN "wechat_open_id" TEXT;
ALTER TABLE "human_users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "human_users" ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "human_users" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "human_users_phone_key" ON "human_users"("phone");
CREATE UNIQUE INDEX "human_users_wechat_open_id_key" ON "human_users"("wechat_open_id");
