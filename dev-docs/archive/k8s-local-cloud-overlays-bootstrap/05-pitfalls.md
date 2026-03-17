# 05 Pitfalls

## Do-Not-Repeat Summary
- `.dockerignore` 若排除 `.ai`，需要显式放开运行时必需目录（当前为 `.ai/llm-config/**`）。

## 2026-02-25 — Prompt template registry missing in container
- Symptom: backend logs showed `Failed to load registry: ... /.ai/llm-config/registry/prompt_templates.yaml`.
- Root cause: runtime image only copied `src/backend` + `dist/frontend`; `.ai/llm-config` was excluded by `.dockerignore` and not included in image.
- What was tried: direct `COPY .ai/llm-config` failed due ignore rule.
- Fix/workaround: allow `.ai/llm-config/**` in `.dockerignore` and copy it in Dockerfile.
- Prevention note: any runtime file resolved by absolute/relative path must be explicitly included in image and not ignored by build context.

## 2026-03-04 — zsh 对 jsonpath/custom-columns 里的 `[]` 执行 glob
- Symptom: `kubectl get pods -o custom-columns=...containerStatuses[0]...` 报 `zsh: no matches found`.
- Root cause: 未给 `-o custom-columns=...` 参数加引号，`[]` 被 shell 当作通配符展开。
- What was tried: 直接复用 bash 风格命令，zsh 下失败。
- Fix/workaround: 始终使用单引号包裹 `-o 'custom-columns=...'` 或切换 `jsonpath`。
- Prevention note: 所有包含 `[]` 的 kubectl 输出模板在 zsh 下必须加引号。

## 2026-03-04 — 高背景队列导致 T-023 drain 判定误报失败
- Symptom: `Queue did not drain back to baseline within wait window` 频繁出现，且 baseline 已长期高位。
- Root cause: 运行时背景流量持续产生事件，"回到 baseline" 判定在高压队列下过于严格。
- What was tried: 仅拉长 `wait-drain-ms`，失败率仍高。
- Fix/workaround:
  - 增加 `queue_drift_allowance`。
  - 引入峰值回落判定（`peak - now >= requiredDrop`）。
  - 高基线模式下采用受控增长容忍，避免误判。
- Prevention note: 生产/准生产队列冒烟不能只用“回 baseline”单一条件，必须考虑背景噪声。

## 2026-03-04 — Runtime Pod 在高负载下出现 Node heap fatal (exit 134)
- Symptom: smoke 过程中随机 `fetch failed`，同时 backend pod restart，`lastState.reason=Error`, `exitCode=134`。
- Root cause: Node 进程可用堆空间不足，叠加 runtime 高并发与历史队列负载触发 V8 heap fatal。
- What was tried: 仅跳过 PPR hydration，仍有偶发 134。
- Fix/workaround:
  - local-kind 注入 `NODE_OPTIONS=--max-old-space-size=1024`。
  - backend 内存资源提升至 `requests=512Mi / limits=2Gi`。
  - 重新 rollout 后 3 轮验收窗口无新增重启。
- Prevention note: 本地多实例+LLM真链路压测需要显式 Node heap 与容器资源预算，不能只依赖默认值。
