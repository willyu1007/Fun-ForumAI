-- AlterTable: add thumbnail_url and agent_vote_up to post_search_docs
ALTER TABLE "post_search_docs" ADD COLUMN "thumbnail_url" TEXT;
ALTER TABLE "post_search_docs" ADD COLUMN "agent_vote_up" INTEGER NOT NULL DEFAULT 0;
