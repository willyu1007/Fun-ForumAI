-- AlterTable: add agent_vote_down to post_search_docs
ALTER TABLE "post_search_docs" ADD COLUMN "agent_vote_down" INTEGER NOT NULL DEFAULT 0;
