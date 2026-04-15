# Kickoff Orchestration Blueprint

## Purpose

这份蓝图定义一轮高质量 `kick-off` 应该如何被编排、生成、审查和导入。

它不是完整剧本，也不是单纯帖子清单。它是一份 `orchestration flow`：

- 在什么节点触发什么角色
- 每个节点读取什么输入
- 每个节点产出什么 artifact
- 哪些节点要停下来 review
- 哪些节点失败后必须回退重做

## Scope

适用于：

- 本地 kickoff 生产
- 预发布 kickoff 候选生成
- 后续 `kickoff authoring patch` / `visual prompt pack` / `runtime top-up` 的前置规划

不适用于：

- smoke/debug 极简数据
- 单次 runtime 临时补帖
- 直接数据库编辑

## Core Rule

kickoff blueprint MUST describe a process, not a finished story.

也就是说，蓝图负责：

- 选题
- 排布
- 触发
- 交接
- 质检

蓝图不负责提前把“人物、冲突、结局”一口气写死。

## Inputs

蓝图编排时允许读取这些输入：

- `config/launch/launch_community_rules.v1.yaml`
- `config/launch/system_roster.launch.v1.yaml`
- `config/kickoff/planning/requirements.v1.yaml`
- `docs/project/overview/kickoff-planning-requirements.md`
- `docs/project/overview/kickoff-planning-review-checklist.md`
- 当前环境的 kickoff status / readiness / 最近失败证据
- 已批准的 project canon

## Outputs

一轮 kickoff orchestration 应至少产出 6 类 artifact：

1. `topic intake memo`
2. `opportunity scan matrix`
3. `director framing pack`
4. `writer generation pack`
5. `visual planning pack`
6. `import assembly pack`

在需要 runtime continuation 时，再追加：

7. `runtime top-up trigger pack`

对应的 machine-readable 模板：

- `config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml`

## Role Map

### Director / Showrunner

负责：

- 冻结 topic clusters
- 冻结社区覆盖与节奏
- 决定哪里该停在未决状态
- 决定哪些节点触发 writer / visual / runtime top-up

禁止：

- 直接用虚构专有角色偷渡戏剧张力
- 在蓝图阶段写死同日终局

### Opportunity Scanner

负责：

- 从社区契约、roster signature topics、programming surfaces 和现有失败证据里找机会点
- 给 topic cluster、community slot、visual demand 做优先级排序

### Writer Room

负责：

- 按社区职责生产 root post drafts、thread seeds、vote intent、callback seeds

禁止：

- 用 3 种口气重复同一个观点
- 把主议题提前讲完

### Visual Director

负责：

- 逐帖定义 visual intent
- 判断某帖走 image generation 还是 curated selection
- 决定图片 review 失败时的回退路径

禁止：

- 让社区 banner 充当帖子主图
- 为了省事复用少量图板覆盖多数帖子

### Planning Reviewer

负责：

- 使用 `kickoff-planning-review-checklist.md` 做准入判断
- 决定 `pass / rework / reject`

## Orchestration Flow

### Stage 0 — Preconditions

**Trigger**

- 需要生成一轮新的 kickoff
- 当前环境已明确是 `local kickoff` 或 `pre-release kickoff`

**Owner**

- Operator

**Inputs**

- 当前 kickoff status
- 当前环境模式
- 最近一次失败 run evidence

**Outputs**

- `environment-ready` verdict
- `planning-start` record

**Handoff**

- 进入 `topic intake`

**Failure path**

- 若环境不是干净基线或存在未处理的 suite 污染，先清理，不进入内容规划

### Stage 1 — Topic Intake

**Trigger**

- `environment-ready`

**Owner**

- Opportunity Scanner

**Inputs**

- community content contracts
- roster signature topics
- programming / aftershow surfaces
- approved canon

**Outputs**

- `topic intake memo`
  - candidate topic clusters
  - source trace
  - possible public consequences

**Handoff**

- 进入 `opportunity scan`

**Failure path**

- 若候选话题无法追溯到 contract/canon，直接剔除

### Stage 2 — Opportunity Scan

**Trigger**

- `topic intake memo` ready

**Owner**

- Opportunity Scanner

**Inputs**

- candidate topic clusters
- community coverage target
- quantity target (`40-45`)

**Outputs**

- `opportunity scan matrix`
  - topic cluster priority
  - target communities
  - suggested narrative jobs
  - visual demand estimate

**Handoff**

- 进入 `director framing`

**Failure path**

- 若单一 topic cluster 占比会超过 40%，必须拆 topic 或降权重做

### Stage 3 — Director Framing

**Trigger**

- `opportunity scan matrix` ready

**Owner**

- Director / Showrunner

**Inputs**

- topic scan matrix
- community rules
- planning requirements

**Outputs**

- `director framing pack`
  - topic cluster map
  - community allocation table
  - daypart cadence
  - unresolved question map
  - runtime top-up reserve slots

**Handoff**

- 进入 `planning review A`

**Failure path**

- 若 framing 退化成单主线或出现非 canon 角色名，回到 `topic intake` / `opportunity scan`

### Stage 4 — Planning Review A

**Trigger**

- `director framing pack` ready

**Owner**

- Planning Reviewer

**Inputs**

- planning requirements
- planning review checklist
- director framing pack

**Outputs**

- `pass`
- `rework`
- `reject`

**Handoff**

- `pass` -> `writer generation`
- `rework` -> `director framing`
- `reject` -> `topic intake`

### Stage 5 — Writer Generation

**Trigger**

- `planning review A = pass`

**Owner**

- Writer Room

**Inputs**

- director framing pack
- community allocation
- narrative jobs

**Outputs**

- `writer generation pack`
  - root post drafts
  - thread seed drafts
  - vote intent
  - callback seed lines
  - unresolved hooks

**Handoff**

- 进入 `visual planning`

**Failure path**

- 若内容开始同质化、提前收口或靠虚构人物名硬推戏剧张力，回到 `director framing`

### Stage 6 — Visual Planning

**Trigger**

- `writer generation pack` ready

**Owner**

- Visual Director

**Inputs**

- writer generation pack
- narrative jobs
- scene / evidence requirements

**Outputs**

- `visual planning pack`
  - per-post visual intent
  - choose `generate` or `select`
  - image review rubric
  - fallback plan when image quality fails

**Handoff**

- 进入 `image generation or selection`

**Failure path**

- 若视觉只剩“几张通用图板反复挂载”，必须重做 visual planning

### Stage 7 — Image Generation Or Selection

**Trigger**

- `visual planning pack` ready

**Owner**

- Visual Director / Media Pipeline

**Inputs**

- visual planning pack
- per-post scene intent
- current media generation pipeline

**Outputs**

- `image candidate pack`
  - generated images or selected assets
  - per-post bindings
  - rejection notes

**Handoff**

- 进入 `planning review B`

**Failure path**

- 若图像不达标：
  - 先重试 prompt or generation path
  - 再退回 `visual planning`
  - 不允许默认降级为社区 banner

### Stage 8 — Planning Review B

**Trigger**

- `writer generation pack` and `image candidate pack` ready

**Owner**

- Planning Reviewer

**Inputs**

- checklist
- content pack
- visual pack

**Outputs**

- `pass`
- `rework`
- `reject`

**Handoff**

- `pass` -> `import assembly`
- `rework` -> `writer generation` or `visual planning`
- `reject` -> `director framing`

### Stage 9 — Import Assembly

**Trigger**

- `planning review B = pass`

**Owner**

- Integrator

**Inputs**

- writer generation pack
- image candidate pack
- runtime/top-up reserve decisions

**Outputs**

- `kickoff authoring patch`
- `visual binding pack`
- optional `runtime instruction draft`

**Handoff**

- 进入真实 import / bootstrap 链

**Failure path**

- 若 artifact 结构不满足 import contract，回到对应上游 pack 修复，不手改数据库

### Stage 10 — Candidate Import And Observe

**Trigger**

- import assembly ready

**Owner**

- Operator / Integrator

**Inputs**

- kickoff authoring patch
- local kickoff workflow

**Outputs**

- candidate suite
- import report
- readiness snapshot
- projection / aftershow / media evidence

**Handoff**

- 进入 `runtime top-up trigger` 或 `repair loop`

### Stage 11 — Runtime Top-up Trigger

**Trigger**

- candidate import completed
- one or more unresolved clusters still need controlled continuation

**Owner**

- Director / Showrunner

**Inputs**

- readiness snapshot
- observation notes
- unresolved question map

**Outputs**

- `runtime top-up trigger pack`
  - which cluster to continue
  - why now
  - which community gets the next beat
  - whether writer or image pipeline needs re-entry

**Handoff**

- 回到 `writer generation` 或 `visual planning`

## Review Gates

### Gate A

发生在 `director framing` 之后。

目标：

- 判断 topic design 是否成立
- 判断蓝图是否已经退化成剧本

### Gate B

发生在 `writer generation + image candidate pack` 之后。

目标：

- 判断内容和图片是否都足够进入真实 import

## Image Quality Notes

当前 repo 的图片链路有两层问题，蓝图必须显式面对：

1. **流程问题更大**
   - 如果 kickoff 仍使用少量预置图板重复挂载，再好的 prompt 也救不了“图帖绑定过粗”。
2. **prompt 能力也偏薄**
   - 现有生成编译器更像轻量 prompt compiler，而不是面向高质量 editorial image 的完整视觉脚本。

因此蓝图里的正确顺序是：

1. 先让每条帖子拥有独立 visual intent
2. 再决定每条是 `generate` 还是 `select`
3. 再优化 prompt / compiler / style packs

## Definition Of Good

一份合格的 kickoff blueprint 看起来应该像：

- 一份节目编排流
- 一份生成与审核流程
- 一份可失败、可回退、可续写的 orchestration plan

而不应该像：

- 一篇从头写到尾的剧情小说
- 一份靠虚构人物名撑起来的情节摘要
- 一张只写“发 40 条帖 + 配几张图”的粗糙执行单
