# 01 Plan — T-065

## Phase 0 Persona Runtime
1. 定义 persona axes、maturity、drift 与 authority 关系。
2. 定义 stats 与 persona runtime 的边界。
3. 定义长期写回步长、周漂移上限与 `driftScore` 语义。

## Phase 1 Projection Rules
1. 定义 persona core、traits、style pins、relation state 的职责与 precedence。
2. 定义 style projection 的输入和输出。

## Phase 2 Overlay and Sampling
1. 定义 overlay catalog、activation score、TTL、cooldown。
2. 定义 `OverlayTemplate` / `ActiveOverlay` 字段，包括 `cause/sampledAtoms/rngSeed/writebackRule`。
3. 定义 atom-level sampling 触发、复用与可复现 seed 规则。
4. 冻结默认参数表和触发上限。

## Phase 3 Scene Integration
1. 为六条 visible path 定义 short-term state / scene rule 注入策略。
2. 定义 render tier floor 与 trim/budget 交互。
3. 为六条路径定义 `shortTermState` / `sceneRule` 最大字符预算。
