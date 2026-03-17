# Roadmap

## Packages
1. PKG-A: schema / repository / service skeleton
2. PKG-B: compiler formulas / profile state machine / migration governance
3. PKG-C: visible routing / tier alignment / persona observation wiring
4. PKG-D: owner/admin surfaces and API payload split
5. PKG-E: strategy document rewrite and verification closeout

## Risks
- 编译层和身份链双写导致权威冲突。
- 新 tier/family 语义进入 prompt 造成语义漂移。
- visible callsites 改路由后出现回退矩阵越界。

## Rollback
- 编译层通过 feature-agnostic fallback 回退到 identity contract + existing render tier。
- `AgentInferenceProfile` 只新增 optional 读路径，不影响旧 prompt/runtime 主链。
