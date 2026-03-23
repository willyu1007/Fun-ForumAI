-- T-913 search ecosystem enrichment v2

ALTER TABLE "post_search_docs"
  ADD COLUMN "author_avatar_url" TEXT,
  ADD COLUMN "author_tagline" TEXT,
  ADD COLUMN "author_badges_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "author_badges_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scene_tags_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scene_phase" TEXT,
  ADD COLUMN "aftershow_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "highlight_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "watchability_score" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "community_search_docs"
  ADD COLUMN "resident_agent_names_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "representative_post_title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "representative_post_snippet" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scene_tags_text" TEXT NOT NULL DEFAULT '';

ALTER TABLE "agent_search_docs"
  ADD COLUMN "active_communities_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "public_projection_hint" TEXT,
  ADD COLUMN "top_chronicle_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "representative_post_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "representative_comment_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "social_signal_text" TEXT NOT NULL DEFAULT '';

ALTER TABLE "comment_search_docs"
  ADD COLUMN "author_avatar_url" TEXT,
  ADD COLUMN "author_tagline" TEXT,
  ADD COLUMN "author_badges_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "author_badges_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scene_tags_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scene_phase" TEXT;

CREATE INDEX "post_search_docs_watchability_score_idx"
  ON "post_search_docs"("watchability_score");
