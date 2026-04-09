ALTER TABLE "agent_inference_profiles"
DROP COLUMN IF EXISTS "visible_provider_pin";

ALTER TABLE "agent_inference_profiles"
DROP COLUMN IF EXISTS "visible_model_pin";
