# 05 Pitfalls — kickoff-data-governance-alignment-temp (T-964)

## Do-Not-Repeat Summary

- 不要把 `Mock/Smoke` 切换实现成“只重新 seed，不 reset”；这会和 kickoff suite/baseline 的逻辑隔离合同冲突。
- 不要允许 `profile_id`、`patch_kind`、`target.mode` 分别表达不同语义；kickoff import 的执行 profile 必须只有一个真值。
- 不要在内容重建后刷新“旧 id”；`regenerate_thread` / `regenerate_turn` 这类动作必须刷新新建实体对应的读模型。
- kickoff 测试生成的 `.ai/.tmp/*kickoff*` 临时目录必须自清理，否则会污染真实本地调试证据层。

## Resolved Lessons

### 1. Mock/Smoke 模式切换没有 reset

- Symptom: `DevAuthToolbar` 的 `加载 Mock / 加载 Smoke` 只调用 `POST /v1/dev/seed`，旧 kickoff suite 仍可能留在数据库里。
- Root cause: 早期把 `dev/seed` 继续当成“快速填充数据”接口，没有把“跨模式切换必须 reset + load”的 kickoff 约束真正落到本地入口。
- What was tried: 先在 review 中比对需求冻结结论和 toolbar 实现，确认前者要求 reset+load，后者没有执行 reset。
- Fix/workaround: `dev-seed` route 新增 `reset_before_seed` 支持；toolbar 对 `Mock/Smoke` 固定传 `reset_before_seed=true`；route 内部执行安全检查后 `migrate reset + db:generate + runDevSeed(profile)`。
- Prevention note: 以后任何本地“模式切换”能力都要先判断它是不是跨模式切换；如果是，就不能只靠幂等 seed。

### 2. Import profile 与 patch metadata 漂移

- Symptom: 同一份 kickoff patch 可以用另一个 `profile_id` 导入，导致 `runtime_instruction` 等能力按错误 profile 执行。
- Root cause: import route 同时接收 `profile_id` 与 `patch.patch_meta.patch_kind`，但 service 没有把它们收口成单一真值。
- What was tried: review `KickoffPatchImportService.importPatch()`，确认 profile 读取和 patch 执行都依赖 `profile_id`，而 patch metadata 只被记录不被校验。
- Fix/workaround: 在 import service 中强制校验 `profile_id === patch.patch_meta.patch_kind`，同时要求 `profile.mode === patch.target.mode`。
- Prevention note: 以后任何 kickoff contract 如果既有“请求层 profile”又有“artifact 内 profile”，都必须在进入写链前就做一致性校验。

### 3. regenerate_thread 刷新了被删除的旧 thread

- Symptom: `regenerate_thread` 删除旧 thread 并新建 thread 后，搜索投影刷新仍然指向旧 thread id。
- Root cause: edit service 在重建链路中沿用了原 thread id 做刷新，没有使用 `createThread()` 的返回值。
- What was tried: review 精修闭环时检查 “写入 -> projection refresh” 链路，发现 `refreshThread(thread.id)` 作用在已删除实体上。
- Fix/workaround: 改为读取 `createThread()` 的新 thread id 并刷新它；同时对缺失 `actor_agent_id` 的重建动作改为 fail-closed。
- Prevention note: 以后涉及重建/替换的治理动作，要明确区分“旧实体清理”和“新实体索引刷新”，不能复用旧 id。
