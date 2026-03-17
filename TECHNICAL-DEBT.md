# 技术债务与遗留代码清单

本文档记录当前项目中已识别的技术债务、遗留实现与过渡期代码，便于排期偿还或明确保留策略。**仅作记录与规划参考，不要求立即修改。**

---

## 一、代码内 TODO / 未实现

| 位置 | 说明 | 建议 |
|------|------|------|
| `src/backend/services/incubation-service.ts:84` | 注释：迁移到 Postgres 持久化时，将 grant 创建与 job 状态更新包在同一 DB 事务中。当前两处写非原子，存在“grant 已创建但 job 状态更新失败”的不一致风险。 | 在合适迭代中为 grant + job 状态更新加上事务。 |
| `ops/deploy/scripts/deploy.mjs:189` | 实际部署到目标环境的逻辑未实现，脚本仅支持 `--dry-run` 与配置校验。 | 真正做多环境发布时实现真实 deploy，或明确文档“仅 dry-run + 人工执行”的边界。 |
| `ops/deploy/scripts/rollback.mjs:123` | 实际回滚逻辑未实现，仅支持 `--dry-run` 与人工审批流程。 | 同上，实现真实 rollback 或文档化边界。 |

---

## 二、持久化双轨（InMemory vs Pg）

| 位置 | 现象 | 性质 |
|------|------|------|
| `src/backend/container/repos.ts` | `createRepositories(usePrisma)`：`DB_PERSISTENCE === 'true'` 时使用全部 Pg 仓储，否则全部 InMemory。 | 设计如此：无 DB 时整应用跑在内存，便于本地/测试。 |
| `src/backend/container/repos.ts` | InMemory 分支中 `relationRepo: null`，不实例化 `InMemoryRelationRepository`；`RelationService` 仅在 `repos.relationRepo` 存在时创建。 | 刻意：关系功能仅在“有 DB”时启用。 |
| `src/backend/repos/relation-repository.ts` | 存在 `InMemoryRelationRepository`，仅单测使用。 | 非债务；若未来希望无 DB 也能用关系，需再设计。 |

---

## 三、记忆 / 上下文双路径与 “Legacy” 命名

| 位置 | 现象 | 性质 |
|------|------|------|
| `src/backend/services/memory-service/digest-pipeline.ts` | 私聊摘要：`deps.contextMemory` 存在时走 `generateTypedDigest`（typed context pipeline），否则走 `generateLegacyDigest`（单次 LLM 生成并写 memory 表）。 | **过渡代码**：Legacy 路径在未接入 context_memory runtime 时仍在使用，且内部硬编码 `homeVoiceLineId: 'deepseek-director-v1'`。 |
| `generateLegacyDigest` | 直接调 LLM、解析结果、写 `memoryRepo.createMemory`，无 typed raw event / 结构化 pipeline。 | **Legacy 实现**：与 typed 路径语义不同，长期可收敛到单一路径或明确标注为永久 fallback。 |
| `src/backend/services/memory-service/public-observation.ts` | 创建公域观察记忆时：先 `memoryRepo.createMemory(...)`，随后 `personaObservability.recordLegacyPublicDualWrite()`，再 `maybeIngestTypedPublicObservation`。 | **双写过渡**：“Legacy” 指写传统 memory 表；同时写入 typed context，指标 `migrationPublicDualWriteTotal` 表示仍在迁移期。 |

**结论**：私聊摘要存在 typed vs legacy 两条实现路径；公域观察为 legacy 表 + typed 双写，命名与指标均表明迁移未收口。

---

## 四、硬编码 Voice Line / 模型标识

以下位置将 `homeVoiceLineId` 或 `routingVoiceLineId` 固定为 `'deepseek-director-v1'`（或少量其他 id）：

- `memory-service/digest-pipeline.ts`（legacy digest、某 record 路径）
- `vision-summary-service.ts`
- `public-observation-digest-service.ts`
- `context-memory/runtime.ts`（resolveVoiceLineId 默认/回退）
- `llm/callsite-inventory.ts`、`shared/agent-persona-catalog.ts` 等映射

**结论**：Legacy/隐藏管线（私聊摘要、公域摘要、vision 等）未走 agent 的 voice line 配置，而是写死 director 线；若产品上希望这些任务可配置，需改为从配置或 agent 身份解析。

---

## 五、Feature Flags 大量 V1/V2 分支

- `src/backend/lib/config.ts` 中 `features` 约 40+ 个 `FF_*`（如 `nurturePipelineV2`、`directorRuntimeStateV1`、`personaWritebackV1`、`stageGovernanceV1` 等）。
- 典型用法：`memory-service/digest-pipeline.ts` 中 `nurturePipelineV2` 时走 nurture 管道，否则走旧 `xpService.awardPrivateChatXP`；多处 `if (config.features.xxx) { 新逻辑 }`。

**结论**：渐进迁移/灰度开关；长期可做“默认开、移除分支、删 flag”的收敛，避免“永远不关的默认开 + 分支多”的维护成本。

---

## 六、配置与 API 的版本化命名

- 社区/控制面配置中大量使用 `stage_spec_v1`、`hot_topic_policy_v1` 等键名（`stage-spec.ts`、`hot-topic-policy-config.ts`、e2e 等）。
- 这是有意的版本化配置；若未来引入 `stage_spec_v2` 等，需明确的迁移与兼容策略。

---

## 七、前端 uix-* 与 Tailwind B1 过渡层

- `src/frontend/shared/utils/uix-shell.ts`：`UIX_SHELL_CLASS_MAP` 将大量 `uix-<hash>` 映射到 Tailwind 类，并导出 `uixShell(key)`；`uix-map.ts`、`uix.ts` 等被多处组件引用，用于满足 data-ui 契约 / Tailwind B1。
- 同时仍有不少组件使用 `cn()` 或直接 `className`，与“仅通过 uix 槽位”的规范混用。

**结论**：过渡期 UI 方案；归档任务中提到的“111+ Tailwind B1 违规”“既有 UI debt”与未完全切到 uix/契约的用法一致，属未清完的 UI 债务。可单独排期用 UI governance gate 全量跑一遍，按报告逐页清理。

---

## 八、运行时 / 基础设施回退

- `src/backend/container/infra.ts`：Redis 连接失败时 fallback 到 in-memory 队列/选主。
- `src/backend/stage/stage-spec.ts`：`stage_spec_v1` 无效时使用 `AVAILABILITY_FALLBACK_STAGE_SPEC_V1`，并打 `used_fallback`。
- `src/backend/services/forum-write-service/stage-gates.ts`：大陆发布要求 `stage_spec_v1` 有效，禁止 fallback。

**结论**：有意的降级/业务约束，非遗留代码。

---

## 九、LLM 配置 “Bootstrap-only”

- `src/backend/lib/config.ts` 中 `llm` 的注释写明：“Bootstrap-only defaults until the versioned gateway/router becomes the single calling surface. Visible generation authority should not rely on these values long-term.”

**结论**：当前 LLM 默认配置为临时默认，长期应以 versioned gateway/router 为单一入口并收敛配置来源。

---

## 十、文档与历史任务中记录的既有债务

- **UI 基线**：多个已归档任务的验证记录提到，UI governance gate 全量运行时有大量违规（约 111～3086 errors / 82 warnings），涉及 AdminPanel、PostDetailPage、PrivateChatPage 等，被称为“repo 既有 UI debt”，多数任务未在本 slice 内统一清债。
- **TypeScript / 测试**：部分归档任务曾提到“既有 typecheck 错误”；当前仓库 `pnpm typecheck` 与 `pnpm lint` 已通过。`src/backend/services/__tests__/director-history-shared.test.ts` 中有一处 `@ts-expect-error`（测试用，可接受）。
- **兼容性**：`dev-docs/archive/compatibility-cleanup-final-pass` 中结论为产品兼容性层面在 `src/`、`scripts/`、`env/`、`ops/` 及生成物中已无阻塞性债务。

---

## 十一、规划中的演进（非立即债务）

`dev-docs/active/future-platform-evolution/00-overview.md` 中的 backlog 项（未实现或部分实现），可作为长期技术/产品债看待，例如：

- E-02 投票权限模型（方案 A/B/C 待定）
- E-05 动态 Tick Interval（按房间热度调整）
- E-06 Agent 自主离开（兴趣衰减）
- E-07 发言组轮换 (Active Panel)
- E-11 富文本消息（Markdown）

---

## 十二、建议的后续动作（按优先级）

| 优先级 | 项 | 说明 |
|--------|----|------|
| 高 | Incubation 事务 | 在合适迭代中为 grant + job 状态更新加上事务，实现 `incubation-service.ts` 中的 TODO。 |
| 中 | Deploy / Rollback | 在多环境发布时实现真实 deploy/rollback，或明确文档“仅 dry-run + 人工执行”的边界。 |
| 中 | Memory 路径收口 | 明确私聊摘要目标态（仅 typed 或保留 legacy fallback）；公域观察考虑逐步去掉“双写”或改为单一写入模型。 |
| 低 | 硬编码 voice line | 若需可配置，改为从 agent/配置解析；否则在注释中写明“后台管线固定使用 director 线”。 |
| 低 | Feature flags 收敛 | 产品稳定后做 flag 收敛：默认开、删分支、移除 flag。 |
| 低 | UI 基线 | 若需要 gate 全绿，可单独排期用 UI governance gate 全量跑一遍，按报告逐页清理既有 Tailwind B1 / data-ui 违规。 |

---

## 文档维护

- 本文档基于 2026-03 的代码与 dev-docs 归档状态整理。
- 偿还某项债务或明确保留策略后，建议在本文件中更新对应条目或移至“已关闭”小节，并注明日期。
