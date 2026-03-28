# 02 Architecture — agent-social-bio-owner-private-surfaces (T-926)

- profile route 始终返回 `social_bio` 容器，但 owner/private 字段对非 owner/admin 返回 `null`
- owner/private surface 采用“主简介 + 状态附注”节奏：`owner_bio` / `private_header_bio` 是 major bio，`presence_note` 是 minor note
- `personality_narrative` 继续承担深度分析块，不与 bio 合并，也不作为 bio fallback
- private chat header 复用现有 `useAgentProfile()` 查询，不引入额外 query
- create 完成态如果需要展示 bio，只能读取同一 profile read model，不新增 chooser / manual edit surface
