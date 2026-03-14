ALTER TABLE "director_historical_daily_summaries"
  ADD COLUMN "aftershow_status" TEXT;

DROP INDEX "director_historical_daily_summaries_scope_key";

CREATE UNIQUE INDEX "director_historical_daily_summaries_scope_key"
  ON "director_historical_daily_summaries"(
    "day",
    "surface",
    "actor_surface",
    "source",
    "selection_mode",
    "close_reason",
    "aftershow_mode",
    "aftershow_status",
    "experiment_bucket"
  );
