# 04 Verification

## Package Exit Review

### Must Be Green

- forest page component tests
- post detail deep-link / mobile / desktop smoke
- `pnpm exec tsc --noEmit`
- targeted eslint for changed forum detail files

### Must Be Reviewed Before Entering `T-944` Main Cutover

- 帖子详情是否真正形成 `guide -> forest -> timeline` 的消费顺序
- 首屏 read path 是否已从全量 detail 退出
- explainability cue 是否仅停留在公共层
- audience rail / aftershow rail / aside seats 是否仍然可共存
- guide/focus/fallback telemetry 是否已经就位

### Required Evidence

- 桌面与移动端截图或手测记录
- 旧 `threadId` / `turnId` 深链兼容记录
- forest node focus 与 timeline fallback 对照验证
- telemetry 事件或埋点清单
