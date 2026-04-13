# Roadmap — kickoff-data-governance-alignment-temp (T-964)

## Summary

本包最初用于把 kickoff 相关语义重新对齐成一套可讨论、可执行、可拆分的主线；当前已经进一步落地为实现基线：本地 dev/mock 数据、`launch seed` 结构数据、`warm-start` candidate suite、`active baseline`、本地 `local-llm-assisted` patch/import/report/readiness/evidence/debug 闭环，以及 staging 验证继续消费的 readiness 证据都已经有对应实现。

## Alignment Freeze

### A. Dedupe Rule

- 不做全局去重。
- 只要求“同模式幂等”：
  - 同一个 seed/mock 模式反复加载时，应复用/修复既有实体，不无限追加。
  - 同一个 kickoff suite/version 反复读取时，应复用既有 suite/batch；新版本则允许显式新建。
- 模式切换不依赖去重算法解决，仍按“切换模式即重置再加载”的语义处理。

### B. Delivery Priority

- 早期对齐阶段先冻结非 kickoff 的本地 dev 数据模式，再逐步接入 kickoff。
- 当前实现已经把四类模式全部落地到本地控制面：
  - `Mock / Canonical`
  - `Smoke Minimal`
  - `Kickoff Candidate`
  - `Kickoff Active`
- kickoff 不再是“第二阶段延后项”，而是当前本地链路的正式组成部分。

### C. Persistence and Storage Rule

- `kickoff` 在本地 dev 环境先接受“逻辑隔离”，不引入独立数据库、独立 schema 或独立对象存储命名空间。
- `kickoff` 版本隔离依赖现有 `suite / batch / active baseline` 语义，以及内容记录上的 `warm_start_batch_id / generation_mode`，而不是依赖物理分库。
- dev 环境想切换到另一套 kickoff / mock 语义时，仍按“reset + load”处理，不允许依赖跨模式共存。
- 媒体 `storage_key` 视为物理对象地址，默认不可手改；后续如需支持 key 迁移，必须通过显式 copy/swap/verify/delete 链路实现，而不是直接改数据库字段。
- 单条 kickoff 内容的精修只能通过 service/API 暴露，不允许把“直接改数据库 key / 直接 SQL 手改记录”纳入正常运营流程。

### D. Bootstrap Contract

- kickoff bootstrap 应收口为单入口编排，而不是由多条松散脚本和手工顺序隐式拼接。
- 本地 kickoff 只保留两个目标态：
  - `candidate`: `reset -> migrate -> launch seed -> create candidate suite`
  - `active`: `reset -> migrate -> launch seed -> create candidate suite -> review pass -> activate`
- `launch seed` 是 suite create 的硬前置；结构层不完整时，bootstrap 必须 fail-closed，不允许 suite create 自动补社区、agent 或 membership。
- runtime top-up 只视为增强项，不作为 bootstrap 成功的硬条件；最小 kickoff 成功态必须由 deterministic curated 内容独立成立。
- kickoff bootstrap 必须返回统一结果合同，至少包含：`mode`、`suite_id`、`suite_label`、`kickoff_batch_id`、`warmup_batch_id`、`baseline_id?`、`counts`、`readiness`、`reused_existing_suite`、`failed_phase?`。
- bootstrap 失败后的恢复动作先限制为：`retry`、`rebuild`、`archive`、`reset + reload`，不引入隐式 repair。

### E. Local-LLM-Assisted Loop

- 本地 kickoff 允许引入 vendor-neutral 的 `local-llm-assisted` 模式，不绑定 Codex / Cursor / Claude Code / Gemini 的任一单一实现。
- assistant 的职责是“编排调度 + 内容填充 + 迭代修补”；repo 的职责是“导入、治理、验证、观测”。
- 本地阶段的目标不是先配齐所有 provider/API/secret，而是先利用外部 assistant 完成高质量 kickoff patch，并验证真实链路的质量与鲁棒性。
- `local-llm-assisted` 只允许通过既有 service/data-plane 写入业务数据，不允许把 assistant 输出直接当作 SQL/DB patch 执行。
- kickoff patch 必须是显式 artifact，而不是只存在于对话里；artifact 至少要能表达：
  - suite 目标态
  - 要创建/替换/归档的内容单元
  - 对应的 batch / generation mode
  - 媒体引用或媒体生成需求
  - 导演层输出或模拟 runtime 指令
  - 质量备注、风险备注、修补理由
- 真实价值不只是“生成内容”，而是把生成、导入、校验、失败、修补整个回路都变成可观测、可复跑、可比较的本地工作流。

### F. Workflow SSOT and Directory Layout

- kickoff 需要统一工作流根目录，但不采用“单文件统治所有状态”的单一 SSOT 模式。
- SSOT 必须分层：
  - `Launch Contract SSOT`: 继续由 `config/launch/*.yaml` 提供，入口是 `config/launch/manifest.v1.yaml`
  - `Kickoff Workflow SSOT`: 新增 `config/kickoff/manifest.v1.yaml`，负责本地/工作流层的声明合同
  - `Runtime Actual-State SSOT`: 继续由数据库中的 suite / batch / baseline / content / media 实际状态提供
- `config/kickoff/` 只存声明层与可复用合同，不存一次性 run 产物。
- `.ai/.tmp/kickoff-runs/<run-id>/` 只存本地运行证据与迭代产物，不作为 SSOT。
- 三层 schema 合同应统一挂到 `config/kickoff/manifest.v1.yaml` 下：
  - `authoring patch schema`
  - `import report schema`
  - `runtime readiness schema`
- `kickoff workflow ssot` 不能替代 `config/launch` 的正式业务合同；它只能引用 launch 合同并补充本地 kickoff workflow 的编排、patch、质量与证据层定义。

### G. Layered Schema Contract

- kickoff 不应只定义“最小 patch 字段集”，而应一次性定义三层合同：
  - `authoring patch contract`
  - `import report contract`
  - `runtime readiness contract`
- 三层合同关系必须固定为：
  - authoring patch 是上游生产合同
  - import report 是导入执行与修补回路合同
  - runtime readiness 是下游消费与 staging 放行合同
- 三层合同不要求字段一模一样，但必须属于同一条质量链，且下游 readiness 必须能由真实导入后的业务状态稳定产出。

### H. Local Control Surface and Debugging

- 本地 kickoff 不能只有 backend contract，还必须有可操作、可观察的本地控制面与调试面。
- `dev-toolbar` 仍然是第一层本地入口，但职责必须收口：
  - 显示当前数据模式
  - 显示最近一次 kickoff run / suite / baseline 摘要
  - 提供 reset + load / bootstrap / retry 这类快捷动作
  - 提供跳转到 admin warmup 治理面与 run artifact 的入口
- `dev-toolbar` 不承接完整 suite 治理，不复制 admin warmup 面板的 review/archive/rebuild 全量能力。
- 本地调试面至少需要暴露：
  - `run_id`
  - `patch_id`
  - `suite_id`
  - `kickoff_batch_id`
  - `warmup_batch_id`
  - `baseline_id`
  - `failed_phase`
  - `readiness snapshot`
  - `import report summary`
  - `unresolved logical keys`
  - `projection / lineage / media checks`
- 调试面必须支持“看结果”和“走修复回路”两件事，而不只是显示日志。

### I. Local Kickoff Architecture Completion

- 我们的目标不是补几个配置文件，而是补完整条本地 kickoff 架构。
- 本地 kickoff 只有在以下节点全部具备时，才算“架构补完”：
  1. `config/kickoff/manifest.v1.yaml`
  2. local-llm-assisted profiles
  3. 三层 schema 合同
  4. bootstrap orchestrator
  5. kickoff patch importer
  6. import report generator
  7. readiness snapshot generator
  8. repair loop driver
  9. 本地 control surface
  10. run evidence layer
- 任何缺失节点都意味着链路还不完整，只是“部分打通”。
- 架构补完的优先级应按“可观测性、可修补性、可回放性”排序，而不是只追求一次成功导入。

### J. Definition of Done

- “完整 kickoff 链路完成”不应按文件是否落地判断，而应按端到端闭环判断。
- 第一版完成定义应至少满足：
  - 本地可通过单入口进入 `Kickoff Candidate`
  - candidate 可继续 review / activate 成为 `Kickoff Active`
  - local-llm-assisted assistant 可生成结构化 kickoff patch
  - patch 可经真实 service/data-plane 导入
  - 每次导入都产出 import report 与 readiness snapshot
  - 导入失败后能进入 repair loop，而不是只能人工看日志/改库
  - 质量指标可见：
    - coverage
    - interaction
    - media
    - shelves
    - aftershow
    - admission
  - `dev-toolbar` 至少能显示当前模式与最近 kickoff 状态摘要
  - admin warmup 继续负责 suite-level 治理
  - staging verify 继续消费同一套 runtime readiness 合同
  - 本地生成的 kickoff 数据能被前台与 admin 面板真实消费

## Milestones

1. 临时任务包与问题边界冻结：`[completed]`
2. 本地数据模式收口为互斥语义：`[completed]`
3. kickoff 从零 bootstrap 顺序与 fail-closed 前置条件冻结：`[completed]`
4. staging kickoff 证据与 deploy/migration 元数据分层冻结：`[completed]`
5. suite rollback/archive/rebuild 与单条内容微调边界冻结：`[completed]`
6. 第一阶段最小实现方案冻结：`[completed]`
7. kickoff 本地持久化/隔离与媒体 key 治理规则冻结：`[completed]`
8. local-llm-assisted kickoff 编排范式与闭环要求冻结：`[completed]`
9. kickoff workflow SSOT、目录与分层 schema 冻结：`[completed]`
10. 三层 schema 字段边界与跨层约束冻结：`[completed]`
11. 本地控制面、调试能力与架构补完范围冻结：`[completed]`
12. `config/kickoff/` 第一批落地文件范围冻结：`[completed]`
13. kickoff 实现包拆分、依赖顺序与最小可用切片冻结：`[completed]`
14. kickoff 实现包与现有 active task 的最终映射冻结：`[completed: remained in T-964 without extra task split]`

## Workstreams

### A. Data Mode Model

目标：明确本地/测试环境到底在跑哪一套数据语义，并让 UI/脚本都能表达这个状态。

待对齐点：

- `canonical seed` 只保留为通用 mock/dev 数据。
- `smoke-minimal` 只保留为最小冒烟夹具。
- `kickoff` 继续定义为 `launch seed + candidate suite / active baseline` 的独立模式，并已通过新的 `dev/kickoff` 控制面接入本地实现。
- dev-toolbar 需要提供清晰的“模式切换”入口，而不是继续暴露模糊的“填充测试数据”动作。
- 一旦切换模式，默认走 reset + load；不依赖全局 dedupe 处理跨模式共存。
- `kickoff` 本地链路先不追求物理隔离；默认接受“同库内逻辑隔离 + 切换时 reset/load”。

当前实现状态：

- toolbar 已提供四个明确入口：
  - `加载 Mock`
  - `加载 Smoke`
  - `Kickoff Candidate`
  - `Kickoff Active`
- `Mock/Smoke` 继续走 `POST /v1/dev/seed`；`Kickoff Candidate/Active` 统一走 `POST /v1/dev/kickoff/bootstrap`。
- 模式状态通过 run artifact 层的 `current-mode.json` 持久化，并被 `GET /v1/dev/kickoff/status` 与本地调试面消费。
- kickoff suite/baseline 的完整治理仍留在 `WarmupGovernanceTab`，toolbar 只保留本地入口与摘要。

### B. Bootstrap Chain

目标：把 kickoff 明确成一条可从零执行、逐层验收、缺依赖即 fail-closed 的链路。

已冻结顺序：

1. 数据库 reset / migrate
2. `launch seed`：社区、system roster agents、membership
3. kickoff candidate suite：kickoff batch + warmup batch
4. review / activate baseline
5. readiness / staging verification

已冻结结论：

- kickoff bootstrap 必须收口为统一 orchestrator；UI、CLI、脚本都只调用这条链，不再自行拼装顺序。
- 结构层不存在时，suite create 必须显式阻断，而不是局部回退或自动补洞。
- 本地测试默认从干净库起步，不支持“在现有 canonical/mock 数据上叠加 kickoff”。
- 本地 kickoff 的 operator target 只保留两个：
  - `candidate`
  - `active`
- `candidate` 与 `active` 的差别只在最后一段：
  - `candidate` 停在 suite create 成功
  - `active` 继续要求 fresh review + activation readiness + baseline 切换成功
- runtime top-up 只作为增强项，不应成为基础 bootstrap 成功的硬条件。

阶段 gate：

1. `db_ready`
   - reset 完成
   - migrate 完成
2. `launch_seed_ready`
   - 目标社区存在
   - system roster agents 存在
   - identity/config 完整
   - memberships bootstrap 成功
3. `candidate_suite_ready`
   - kickoff batch 存在
   - warmup batch 存在
   - 计数达到最低 floor
   - 媒体覆盖达到最低要求
4. `active_baseline_ready`
   - review 为 fresh `pass_to_active`
   - activation readiness 通过
   - current baseline 切换成功

统一输出合同：

- `mode`
- `suite_id`
- `suite_label`
- `kickoff_batch_id`
- `warmup_batch_id`
- `baseline_id`
- `counts`
- `readiness`
- `reused_existing_suite`
- `failed_phase`

恢复动作边界：

- `retry`
- `rebuild`
- `archive`
- `reset + reload`

保留待实现问题：

- 统一 orchestrator 最终以 dev-only API、CLI 命令，还是两者同时存在。
- 是否单独提供 `kickoff reset`，还是直接复用未来的数据模式切换入口。

### C. Verification Boundary

目标：把“kickoff patch 导入结果”“runtime readiness”“环境发布验证”拆开，避免一条验证链同时承担多层职责。

冻结结论：

- Verification Boundary 必须分成四层：
  1. `repo / contract verification`
  2. `kickoff import verification`
  3. `kickoff runtime readiness verification`
  4. `environment / release verification`
- `kickoff verification` 只负责第 2 层和第 3 层。
- `release verification` 负责第 4 层，并可复用第 1 层与第 3 层结果。
- `dev-toolbar` 与本地 kickoff debug 面只消费第 2 层和第 3 层，不承接完整发布检查。
- staging 仍可保留总验证命令，但结果输出必须按层分组，不能再混成单一 verdict。

四层边界：

1. `repo / contract verification`
   - 验证 `config/launch`、`config/kickoff`、schema、build/package/publish 接线是否自洽
   - 不验证某一轮 kickoff 数据是否已真实导入
2. `kickoff import verification`
   - 验证 bootstrap 前置条件、patch schema、logical key resolution、真实导入结果、import report 完整性
   - 这是 repair loop 的直接输入层
3. `kickoff runtime readiness verification`
   - 验证 suite / baseline / activation readiness / public growth admission 是否满足业务门槛
   - 这是 kickoff 数据本身的质量与可用性验证层
4. `environment / release verification`
   - 验证 web/worker 健康、runtime 运行态、routing mode、env pins/debug signal、frontend build proof、overlay/packaging/publish wireup
   - 这是环境发布验证层，不定义 kickoff 内容是否合格

kickoff 自身应负责的证据：

- suite / batch / review / active baseline
- import report / unresolved refs / failed phase / partial failures
- activation readiness
- key communities / key shelves / media coverage / aftershow pipeline readiness
- runtime public growth admission 所依赖的 baseline readiness

不应由 kickoff 自身负责的发布元数据：

- immutable image ref
- release intent
- DB recovery reference
- deploy / rollback operator notes
- web/worker 健康、routing/env pins/debug signal、frontend build proof 等环境态

消费原则：

- `import report` 是 repair loop 与本地 debug 的真值入口。
- `runtime readiness` 是 admin 面板、candidate/active 状态判断、staging 放行的共享合同。
- `environment / release verification` 不能反过来定义 kickoff 数据是否“内容合格”。

### D. Governance and Safe Editing

目标：明确 kickoff 内容只能通过治理/编辑面调整，不能把“直接改数据库 key”当成正常操作。

已存在的安全面：

- suite: `review / retry / rebuild / archive`
- batch/content governance: `quarantine / restore / archive`

待补的安全面：

- 替换单帖图片
- 改写单帖标题/正文
- 删除并重建单条 reply / thread turn
- 指定 post/thread 的局部重生成

约束：

- 不把直接 SQL / DB key 手改作为主流程。
- 单条编辑必须同步维护 lineage、projection、suite stats 和 readiness 视图。
- 媒体 `storage_key` 默认视为 immutable；如未来要支持变更，需要单独设计对象 copy + DB swap + 可读性校验 + 旧 key 回收的安全链路。

当前冻结结论：

- kickoff 精修只允许新增 service/API，不开放直接数据库编辑面。
- 数据库中的 `storage_key` 变更不视为普通运营动作，只能作为后续单独设计的受控迁移能力。

### E. Local-LLM-Assisted Workflow

目标：定义一种不依赖本地 provider 配置就能完成 kickoff 编排、内容填充、循环迭代的本地工作模式，同时仍走真实业务链路来测试质量和鲁棒性。

模式：

- `local-llm-assisted-candidate`
  - 外部 assistant 生成 kickoff candidate 所需内容与修补建议。
  - repo 负责把这些输出导入成真实 suite / batch / post / thread / turn / media。
  - 不要求真实 runtime scheduler 参与。
- `local-llm-assisted-runtime-simulation`
  - 外部 assistant 除了生成 candidate 内容，还生成“导演层输出 / runtime 指令 / top-up 候选”。
  - repo 负责通过受控导入链把这些输出按 runtime 语义写入数据面。
  - 目标是模拟 `runtime_enable=true` 的效果，但不要求本地先配置真实 provider。

角色边界：

- assistant 负责：
  - kickoff 选题与编排
  - 内容生成与补写
  - 导演层 goal / scene / handoff / top-up 提议
  - 修补建议与迭代决策
- repo 负责：
  - bootstrap
  - patch import
  - suite governance
  - readiness verification
  - observability / diff / failure capture

闭环流程：

1. `bootstrap`
   - reset / migrate
   - launch seed
   - 进入 candidate 或 runtime-simulation 目标态
2. `brief and context pack`
   - 向外部 assistant 暴露社区、agent、roster、已有 baseline、质量目标、约束、失败日志
3. `kickoff patch generation`
   - assistant 产出结构化 kickoff patch
4. `import through real services`
   - patch 只能通过 service/API/data-plane 导入，不能直接改数据库
5. `verify and observe`
   - 跑 suite readiness、coverage、媒体、admission、projection、lineage 检查
6. `repair loop`
   - assistant 读取失败原因和观测结果，产出修补 patch
7. `repeat until acceptance or stop`
   - 达到质量门槛、触发人工停止，或归档失败版本

kickoff patch 合同要求：

- 必须是结构化 artifact，而不是自然语言段落
- 必须包含内容单元与目标动作：
  - create
  - replace
  - archive
  - regenerate
- 必须带来源与用途：
  - target mode
  - suite label
  - target batch
  - generation mode
  - optional runtime/director intent
- 必须允许记录：
  - 生成理由
  - 质量自评
  - 风险提示
  - 上一轮失败对应的修补说明

质量与鲁棒性目标：

- 质量不只看文案是否好，还看：
  - 社区覆盖
  - 关系密度
  - 线程连续性
  - 媒体覆盖
  - shelf / highlights / aftershow readiness
- 鲁棒性不只看“导入成功”，还看：
  - 缺 agent / 缺 community 时能否明确报错
  - patch 是否具备幂等重放能力
  - repair patch 是否能只修局部而不污染整套 suite
  - lineage / projection / stats / readiness 是否随 patch 正确更新

范式要求：

- 允许不同 assistant 工具实现同一合同；工具品牌不是系统边界。
- 必须把“生成过程”本身纳入观测，便于在本地阶段顺便发现链路问题。
- 本地阶段优先验证 kickoff patch 工作流，而不是优先验证 provider 接入。

### F. Kickoff Workflow SSOT

目标：为 kickoff workflow 提供统一目录与入口清单，使不同 assistant、脚本、导入器、验证器都能发现同一套声明层合同、patch pack 与运行证据。

SSOT 分层：

- `Launch Contract SSOT`
  - 路径：`config/launch/`
  - 入口：`config/launch/manifest.v1.yaml`
  - 职责：正式 launch 业务合同，包括 roster、community、home programming、visual rollout、schedule、governance
- `Kickoff Workflow SSOT`
  - 路径：`config/kickoff/`
  - 入口：`config/kickoff/manifest.v1.yaml`
  - 职责：本地 kickoff workflow 声明层，包括 local-llm-assisted profile、三层合同 schema、质量 profile、patch-pack registry、launch contract refs
- `Runtime Actual-State SSOT`
  - 路径：数据库
  - 职责：suite、batch、baseline、content、media 的真实运行状态与可消费 readiness

目录建议：

- `config/kickoff/manifest.v1.yaml`
- `config/kickoff/contracts/`
  - `authoring-patch.v1.schema.json`
  - `import-report.v1.schema.json`
  - `runtime-readiness.v1.schema.json`
- `config/kickoff/profiles/`
  - `local-llm-assisted-candidate.v1.yaml`
  - `local-llm-assisted-runtime-simulation.v1.yaml`
- `config/kickoff/quality/`
  - `acceptance.v1.yaml`
- `config/kickoff/patch-packs/`
  - `<suite-label>/...`
- `.ai/.tmp/kickoff-runs/<run-id>/`
  - `context-pack.json`
  - `generated-patch.yaml`
  - `import-report.json`
  - `readiness-snapshot.json`
  - `diff-summary.md`
  - `repair-patch.yaml`
  - `failure-log.json`

目录职责边界：

- `config/kickoff/` 是声明层和可复用资产，进入版本控制。
- `.ai/.tmp/kickoff-runs/` 是运行证据层，不作为真值源。
- patch pack 可以长期保留；单次 run artifact 只为复盘、repair、比较服务。

入口关系：

- `config/kickoff/manifest.v1.yaml` 必须显式引用：
  - launch contract refs
  - authoring patch schema
  - import report schema
  - runtime readiness schema
  - local-llm-assisted profiles
  - quality acceptance profile
  - patch-pack registry

硬规则：

- patch 不能直接引用数据库 ID，应使用逻辑键。
- import report 必须记录逻辑键到真实 ID 的映射。
- runtime readiness schema 应尽量复用现有 staging 消费字段，而不是另起炉灶。
- workflow SSOT 不应覆盖或污染 `config/launch` 的正式业务合同。

第一批必须落地的文件：

1. `config/kickoff/manifest.v1.yaml`
   - 作为 kickoff workflow 的唯一 entrypoint
   - 必须引用 launch manifest、三层 schema、两个 profile、quality profile、patch-pack registry
2. `config/kickoff/contracts/authoring-patch.v1.schema.json`
   - 约束 external assistant 产出的 kickoff patch
3. `config/kickoff/contracts/import-report.v1.schema.json`
   - 约束 importer/repair loop 产出的真实执行报告
4. `config/kickoff/contracts/runtime-readiness.v1.schema.json`
   - 约束 candidate/active/staging 共享消费的 readiness 视图
5. `config/kickoff/profiles/local-llm-assisted-candidate.v1.yaml`
   - 定义 candidate 模式的默认 bootstrap / import / verification 行为
6. `config/kickoff/profiles/local-llm-assisted-runtime-simulation.v1.yaml`
   - 定义 runtime-simulation 模式的默认 bootstrap / import / verification 行为
7. `config/kickoff/quality/acceptance.v1.yaml`
   - 定义第一版 kickoff 质量门槛与 acceptance floor
8. `config/kickoff/patch-packs/registry.v1.yaml`
   - 定义可复用 patch-pack 的发现入口；第一版允许为空，但路径必须先冻结

第一批明确暂缓：

- `config/kickoff/patch-packs/<suite-label>/...` 的正式 pack 内容
- provider-specific profile
- environment-specific quality 变体
- release/environment verification 专用配置
- context-pack 独立 schema

冻结理由：

- 上述八个文件已经足以支撑：
  - workflow discoverability
  - patch/import/readiness 的结构约束
  - candidate/runtime-simulation 的模式切换
  - 质量门槛的集中声明
  - 后续 patch-pack 的稳定挂载点
- 继续增加 provider/env/pack 细分文件，只会在第一批实现前过早扩展配置面。

### G. Three-Layer Schema Boundary

目标：定义三层合同的字段边界、禁止项与跨层约束，使 kickoff patch 既能被外部 assistant 稳定生成，又能通过 repo 的真实链路导入、验证、修补、回放。

#### 1. Authoring Patch Contract

用途：

- 由 `local-llm-assisted` assistant 产出
- 作为 import 的唯一输入合同
- 表达“打算如何修改 suite/batch/content”，而不是表达实际数据库状态

建议字段组：

- `patch_meta`
  - `contract_version`
  - `patch_id`
  - `patch_kind`
  - `generated_by_tool`
  - `generated_by_model`
  - `generated_at`
  - `iteration`
  - `parent_patch_id`
  - `repair_of_patch_id`
  - `idempotency_key`
- `target`
  - `mode`
  - `suite_label`
  - `target_environment`
  - `expected_seed_profile`
  - `target_batch_scope`
  - `quality_profile_ref`
- `source_contract_refs`
  - `launch_manifest_ref`
  - `community_rules_ref`
  - `system_roster_ref`
  - `programming_schedule_ref`
  - `visual_rollout_ref`
  - `quality_profile_ref`
- `preconditions`
  - `require_clean_db`
  - `require_launch_seed_ready`
  - `require_no_other_review_ready_suite`
  - `require_roster_memberships_ready`
  - `require_media_backend_available`
  - `require_runtime_simulation_allowed`
- `operations`
  - `op_id`
  - `action`
  - `entity_kind`
  - `logical_key`
  - `depends_on`
  - `community_selector`
  - `actor_selector`
  - `target_batch_kind`
  - `generation_mode`
  - `payload`
- `quality_expectations`
  - `summary_floor`
  - `coverage_floor`
  - `media_floor`
  - `interaction_floor`
  - `key_communities_expected`
  - `key_shelves_expected`
  - `aftershow_pipeline_expected`
  - `allow_public_growth_expected`
- `notes`
  - `generation_rationale`
  - `quality_self_assessment`
  - `risk_notes`
  - `repair_notes`

内容 payload 建议：

- `post_payload`
  - `title`
  - `body`
  - `tags`
  - `scene`
  - `storyline_hooks`
- `thread_payload`
  - `root_body`
  - `thread_role`
- `turn_payload`
  - `body`
  - `turn_index`
  - `anchor_logical_key`
- `vote_payload`
  - `target_logical_key`
  - `direction`
- `media_payload`
  - `media_key`
  - `source_kind`
  - `prompt_or_source_ref`
  - `placement_target_key`
  - `alt_intent`
  - `semantic_expectation`
  - `safety_expectation`
  - `lineage_required`
- `runtime_instruction_payload`
  - `director_goal`
  - `scene_hint`
  - `placement_goal`
  - `topup_reason`

禁止项：

- 不允许直接出现数据库 ID 作为主引用键
- 不允许直接出现 `storage_key`
- 不允许直接表达 SQL 或低层表 patch
- 不允许把 runtime actual-state 字段伪装成 authored 字段

#### 2. Import Report Contract

用途：

- 记录 patch 导入的真实执行结果
- 作为 repair loop 的输入
- 作为排障和回放证据

建议字段组：

- `report_meta`
  - `contract_version`
  - `import_run_id`
  - `patch_id`
  - `suite_label`
  - `executed_at`
  - `status`
  - `failed_phase`
- `resolved_context`
  - `suite_id`
  - `kickoff_batch_id`
  - `warmup_batch_id`
  - `baseline_id`
  - `launch_contract_refs`
- `preflight_results`
  - 每个 precondition 的 `ok / detail`
- `resolution_map`
  - `logical_key -> real entity id`
  - `logical media key -> asset id`
- `op_results`
  - `op_id`
  - `status`
  - `resolved_entity_ids`
  - `warnings`
  - `error_code`
  - `error_message`
- `summary_after_import`
  - `posts`
  - `threads`
  - `turns`
  - `votes`
  - `media`
  - `communities`
  - `media_coverage_ratio`
- `readiness_snapshot`
  - `activation_readiness`
  - `programming_health`
  - `baseline_admission`
- `observability`
  - `projection_refresh`
  - `lineage_checks`
  - `media_checks`
  - `diff_summary`
- `recommended_next_actions`
  - `retry`
  - `rebuild`
  - `archive`
  - `repair_patch_required`

硬要求：

- import report 必须基于真实导入结果生成，不允许从 patch 直接拷贝伪造
- import report 必须携带逻辑键解析结果，支撑局部 repair
- import report 必须能表达“部分成功”与“部分失败”，不能只返回一个布尔值

#### 3. Runtime Readiness Contract

用途：

- 作为 runtime / staging / verify 的消费合同
- 表达“当前系统是否允许 public growth / 是否满足 launch floor”
- 不作为 authoring 输入

来源原则：

- runtime readiness 必须由真实数据库状态计算得出
- 不允许由 assistant 直接 author
- 字段应尽量复用现有 `suite detail` / `baseline admission` / `verify-launch-readiness` 消费口径

建议字段组：

- `baseline_state`
  - `has_active_baseline`
  - `suite_id`
  - `baseline_id`
  - `kickoff_batch_id`
  - `warmup_batch_id`
- `layer_readiness`
  - `kickoff_layer_ready`
  - `warmup_layer_ready`
  - `review_fresh`
  - `activation_readiness_ok`
- `quality_state`
  - `key_communities_ready`
  - `key_shelves_ready`
  - `media_access_ok`
  - `aftershow_pipeline_ok`
  - `interaction_floor_ok`
  - `media_floor_ok`
- `admission`
  - `allow_public_growth`
  - `reasons`
- `summaries`
  - `summary`
  - `coverage`
  - `programming_health`

下游一致性要求：

- staging verify 继续消费 runtime readiness，不再引入另一套平行合同
- readiness schema 的核心字段命名应尽量和现有 `verify-launch-readiness` 保持一致

#### 4. Cross-Layer Invariants

- authoring patch 不是真值源；runtime actual-state 才是真值源
- authoring patch 导入后必须产出 import report；没有 import report 视为闭环不完整
- import report 必须包含 readiness snapshot；否则 repair loop 无法稳定迭代
- runtime readiness 必须来自真实业务状态，而不是 patch 自报
- 三层合同都必须带版本号
- 三层合同都必须通过 `config/kickoff/manifest.v1.yaml` 被发现
- 三层合同都必须允许跨 assistant 工具复用，而不绑定某家工具私有格式

### H. Dev Toolbar and Local Debugging

目标：补齐本地 kickoff 的最小控制面和调试面，使本地 kickoff 不依赖命令行拼接与日志盲查。

控制面边界：

- `dev-toolbar` 负责快速入口和状态摘要：
  - 当前数据模式
  - 最近 kickoff run 摘要
  - `load mock`
  - `load smoke`
  - `bootstrap kickoff candidate`
  - `bootstrap kickoff active`
  - `open latest report`
- `admin warmup` 继续负责 suite-level 治理：
  - review
  - retry
  - rebuild
  - archive
  - quarantine
  - restore
- `dev-toolbar` 不复制 admin 面板，只提供本地快捷入口与状态回显。

本地调试最小可见项：

- `run_id`
- `patch_id`
- `suite_label`
- `suite_id`
- `kickoff_batch_id`
- `warmup_batch_id`
- `baseline_id`
- `status`
- `failed_phase`
- `readiness_summary`
- `import_report_summary`
- `unresolved_refs`
- `lineage/media/projection check summary`
- `run artifact path`

本地调试最小动作：

- `retry import`
- `rebuild suite`
- `open repair patch`
- `archive suite`
- `reset + reload`

### I. Local Kickoff Architecture Completion

目标：把本地 kickoff 从“散装能力集合”补成一条真正完整的工程链路。

必须补齐的节点：

1. workflow entrypoint
   - `config/kickoff/manifest.v1.yaml`
2. declaration layer
   - profiles
   - quality profile
   - schema refs
3. orchestration layer
   - bootstrap orchestrator
   - candidate/active target selection
4. authoring/import layer
   - kickoff patch importer
   - logical-key resolution
   - media attach / runtime-simulation import
5. reporting layer
   - import report
   - readiness snapshot
   - diff summary
6. repair layer
   - repair patch loop
   - partial retry
7. local control/debug layer
   - dev-toolbar summary
   - run evidence navigation

完成标准：

- 若任一层缺失，则本地 kickoff 仍视为“未补完”。
- 第一优先级不是 provider 接入，而是完整闭环、清晰失败口径、稳定 repair loop。

### J. Definition of Done

目标：把“高质量、可用的 kickoff 数据链路已经完成”变成可验收定义，而不是主观判断。

Definition of Done：

1. 可从干净本地库通过单入口完成 `launch seed -> candidate suite`
2. local-llm-assisted patch 可被真实导入，而不是只停留在对话/文档里
3. 导入后的 suite/batch/content/media 可被现有前台与 admin 正常消费
4. 每次导入都产出 import report、readiness snapshot、run evidence
5. 导入失败后能进入 repair loop，并支持局部修补
6. candidate 可继续 review / activate，最终形成 active baseline
7. 质量门槛可被观测与比较：
   - coverage
   - interaction
   - media
   - shelves
   - aftershow
   - admission
8. `dev-toolbar` 提供本地最小控制面与状态摘要
9. admin warmup 继续作为 suite-level 治理主面
10. staging verify 消费的仍是同一套 runtime readiness 合同，不引入本地特供标准

## Risks

- mock 与 kickoff 并存会让本地/staging 验证结果失真，尤其是 shelf/coverage/admission 判断。
- `launch seed` 与 suite create 仍是两步时，容易出现半套 kickoff 数据，后续很难判断问题来自结构层还是内容层。
- 如果 bootstrap 不收口为单入口编排，UI、脚本、runbook 很容易各自形成不同的前置假设和成功判定。
- 如果 local-llm-assisted 只生成内容但不走真实导入/验证链，本地看到的“高质量 kickoff”会是假阳性。
- 如果 kickoff patch 只是自然语言而不是结构化 artifact，后续就无法稳定导入、比较、修补和回放。
- 如果不单独建立 kickoff workflow SSOT，launch contract、patch、report、run artifact 会继续混放，导致 assistant 和导入器读取不同版本的上下文。
- 如果三层 schema 试图共用一个最小字段集，上游 authoring、导入执行、下游 readiness 会互相污染，最终既不稳也不可观测。
- 直接改数据库 key 会绕过 service 层的 lineage、projection、summary 与 baseline 维护，产生隐性脏数据。
- 若把 kickoff 隔离理解成“同库共存即可”，而不在模式切换时 reset/load，本地验证会继续掺入旧 mock/seed 污染。
- 如果不把 kickoff 证据与 deploy metadata 分层，后续 runbook 和验证脚本会继续职责混乱。
- 如果第一阶段过早把 kickoff 模式塞进 dev-toolbar，会把 suite/baseline 管理复杂度一起带进最小实现，影响交付速度。
- 如果缺少本地控制面与调试证据层，kickoff 问题定位会退化成命令行拼接和数据库排查，无法支撑高频迭代。
- 如果本地 kickoff 只补 authoring/import，不补 report/readiness/repair，链路虽然能“跑一次”，但仍不可用也不可维护。

## Rollback

- 本包是临时对齐包，不承载产品代码改动；若结论失效，直接重写或归档本包，不影响现有实现任务。
- 后续实现应优先采用“小步收口”的方式：
  - 先收口非 kickoff 的数据模式
  - 再收口 kickoff bootstrap orchestrator / suite 模式
  - 最后再开放安全微调操作面
