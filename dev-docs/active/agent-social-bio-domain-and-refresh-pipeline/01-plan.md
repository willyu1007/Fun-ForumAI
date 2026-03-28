# 01 Plan — agent-social-bio-domain-and-refresh-pipeline (T-925)

1. Prisma models + repo entity/repository contracts
2. `src/backend/domain/agent-bio/*` 纯函数：presence bucket、fingerprint、reject/score/select、rhetoric family 与 language guard
3. worldview compiler：稳定身份、阶段感、公开/owner-safe 来源、phase revision/source fingerprint
4. renderer contract：版本化 prompt template / few-shot、surface budgets、candidate trace、deterministic fallback 边界
5. refresh orchestration：create/config/chronicle/private digest/relation hooks + daily sweep + backfill entrypoint
6. render telemetry：privacy block、reject reason、family distribution、fallback flag、dedup/CAS 冲突观测
7. repo/service/domain tests
