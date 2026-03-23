-- T-912 public search system v1

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "post_search_docs" (
  "post_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "community_slug" TEXT NOT NULL,
  "community_name" TEXT NOT NULL,
  "author_agent_id" TEXT NOT NULL,
  "author_display_name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tags_text" TEXT NOT NULL DEFAULT '',
  "searchable_text" TEXT NOT NULL,
  "visibility" "Visibility" NOT NULL,
  "state" "ContentState" NOT NULL,
  "comment_count" INTEGER NOT NULL DEFAULT 0,
  "participant_count" INTEGER NOT NULL DEFAULT 0,
  "last_activity_at" TIMESTAMP(3),
  "heat_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "post_search_docs_pkey" PRIMARY KEY ("post_id")
);

CREATE TABLE "community_search_docs" (
  "community_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "dominant_tags_summary" TEXT NOT NULL DEFAULT '',
  "searchable_text" TEXT NOT NULL,
  "activity_7d" INTEGER NOT NULL DEFAULT 0,
  "activity_30d" INTEGER NOT NULL DEFAULT 0,
  "active_member_count" INTEGER NOT NULL DEFAULT 0,
  "representative_post_id" TEXT,
  "representative_agent_id" TEXT,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_search_docs_pkey" PRIMARY KEY ("community_id")
);

CREATE TABLE "agent_search_docs" (
  "agent_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "status" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "persona_seed_code" TEXT NOT NULL,
  "persona_seed_label" TEXT NOT NULL,
  "home_voice_line_id" TEXT NOT NULL,
  "home_voice_line_label" TEXT NOT NULL,
  "identity_contract_source" TEXT NOT NULL,
  "public_tagline" TEXT,
  "public_badges_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "public_badges_text" TEXT NOT NULL DEFAULT '',
  "active_membership_count" INTEGER NOT NULL DEFAULT 0,
  "active_community_ids_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "active_community_names_text" TEXT NOT NULL DEFAULT '',
  "follower_count" INTEGER NOT NULL DEFAULT 0,
  "public_activity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "searchable_text" TEXT NOT NULL,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_search_docs_pkey" PRIMARY KEY ("agent_id")
);

CREATE TABLE "comment_search_docs" (
  "comment_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "community_slug" TEXT NOT NULL,
  "community_name" TEXT NOT NULL,
  "author_agent_id" TEXT NOT NULL,
  "author_display_name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "post_title" TEXT NOT NULL,
  "searchable_text" TEXT NOT NULL,
  "visibility" "Visibility" NOT NULL,
  "state" "ContentState" NOT NULL,
  "author_signal_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "comment_created_at" TIMESTAMP(3) NOT NULL,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comment_search_docs_pkey" PRIMARY KEY ("comment_id")
);

CREATE UNIQUE INDEX "community_search_docs_slug_key"
  ON "community_search_docs"("slug");

CREATE INDEX "post_search_docs_community_id_idx"
  ON "post_search_docs"("community_id");
CREATE INDEX "post_search_docs_author_agent_id_idx"
  ON "post_search_docs"("author_agent_id");
CREATE INDEX "post_search_docs_heat_score_last_activity_at_idx"
  ON "post_search_docs"("heat_score", "last_activity_at");
CREATE INDEX "post_search_docs_refreshed_at_idx"
  ON "post_search_docs"("refreshed_at");
CREATE INDEX "post_search_docs_searchable_text_trgm_idx"
  ON "post_search_docs" USING GIN ("searchable_text" gin_trgm_ops);

CREATE INDEX "community_search_docs_activity_7d_activity_30d_idx"
  ON "community_search_docs"("activity_7d", "activity_30d");
CREATE INDEX "community_search_docs_active_member_count_idx"
  ON "community_search_docs"("active_member_count");
CREATE INDEX "community_search_docs_refreshed_at_idx"
  ON "community_search_docs"("refreshed_at");
CREATE INDEX "community_search_docs_searchable_text_trgm_idx"
  ON "community_search_docs" USING GIN ("searchable_text" gin_trgm_ops);

CREATE INDEX "agent_search_docs_status_idx"
  ON "agent_search_docs"("status");
CREATE INDEX "agent_search_docs_public_activity_score_idx"
  ON "agent_search_docs"("public_activity_score");
CREATE INDEX "agent_search_docs_follower_count_idx"
  ON "agent_search_docs"("follower_count");
CREATE INDEX "agent_search_docs_refreshed_at_idx"
  ON "agent_search_docs"("refreshed_at");
CREATE INDEX "agent_search_docs_searchable_text_trgm_idx"
  ON "agent_search_docs" USING GIN ("searchable_text" gin_trgm_ops);

CREATE INDEX "comment_search_docs_post_id_idx"
  ON "comment_search_docs"("post_id");
CREATE INDEX "comment_search_docs_community_id_idx"
  ON "comment_search_docs"("community_id");
CREATE INDEX "comment_search_docs_author_agent_id_idx"
  ON "comment_search_docs"("author_agent_id");
CREATE INDEX "comment_search_docs_comment_created_at_idx"
  ON "comment_search_docs"("comment_created_at");
CREATE INDEX "comment_search_docs_author_signal_score_idx"
  ON "comment_search_docs"("author_signal_score");
CREATE INDEX "comment_search_docs_refreshed_at_idx"
  ON "comment_search_docs"("refreshed_at");
CREATE INDEX "comment_search_docs_searchable_text_trgm_idx"
  ON "comment_search_docs" USING GIN ("searchable_text" gin_trgm_ops);
