# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要只记录 disclosure 请求值，不记录 effective/cap source。
- 不要让高风险 config 继续走盲 merge。
- 不要让 shadow mode 产生持久化治理副作用；auto-cap 之类的状态写入必须和 enforcement 语义一致。
- 不要用“先 release 后 create”的两步写法替换 ACTIVE override；这会在失败/并发下留下保护缺口或重复 ACTIVE 行。

## 2026-03-13 - Spillover Shadow Mode / Active Override Replacement
- 症状：
  - public spillover 在 shadow mode 下仍会创建持久化 agent cap。
  - disclosure cap override 的替换逻辑先释放旧 ACTIVE，再新建下一条；第二步失败时会丢失保护，并发时还能留下多个 ACTIVE。
- 根因：
  - policy 层把“审计 side effect”和“治理 state mutation”混在一起，shadow mode 只 shadow 了 action，没 shadow 自动压帽。
  - repo 层缺少事务化 replace 语义，也没有 DB 级 ACTIVE 唯一约束。
- 试过什么：
  - 先在 service 层用 `findActive -> release -> create` 修补，但这只能改顺序，不能解决并发和失败回滚。
- 修复：
  - policy 侧只在非 shadowed spillover enforcement 时创建 auto-cap。
  - repo 新增 `replaceActivePublicDisclosureCapOverride`，统一做事务内 release/create 或 retain/heal duplicate。
  - migration 新增 partial unique index，限制同一 scope 只能有一条 ACTIVE override。
- 预防：
  - 以后凡是“单 scope 只有一条 ACTIVE”的治理对象，都优先设计成 repo 原子 replace + DB 唯一约束，而不是 service 层串两次写操作。
