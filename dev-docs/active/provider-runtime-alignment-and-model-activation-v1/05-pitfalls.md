# 05 Pitfalls

## Do Not Repeat

- 不要把 registry 中已声明的 provider 当成 runtime 已接入；`providers.yaml` 与 `LlmClient`/adapter dispatch 必须同时成立。
- 不要把全局 observability snapshot 当成单 agent shadow compare evidence。
- 不要把 provider 官方 model_id 再包一层 repo 内别名，否则 admission/profile/pricing 会持续漂移。
- 删除 legacy env key 时，不要只改 contract；`env/.env.example`、k8s secret templates、local helper scripts 也会被 config-key check 扫到，必须一并收口。
