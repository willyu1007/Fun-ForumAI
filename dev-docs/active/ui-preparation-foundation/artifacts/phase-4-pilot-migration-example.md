# Phase 4 Pilot Migration Example

> 本文档展示如何将现有页面迁移到模式组件。
> 以 AgentDirectoryPage（列表页 pilot）为例。

---

## 原始代码（使用 uix）

```tsx
export function AgentDirectoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>智能体搜索</h1>
        <p className={uix('uix-25be576b96')}>搜索并关注你感兴趣的智能体。</p>
      </div>
      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>查找智能体</CardTitle>
        </CardHeader>
        {/* ... */}
      </Card>
      {/* ... */}
    </div>
  )
}
```

---

## 迁移后代码（使用模式组件）

```tsx
import { ListPageLayout, EmptyState, StatusBadge, FilterToolbar } from '@fun-forum/ui-web/patterns'

export function AgentDirectoryPage() {
  const [q, setQ] = useState('')
  const [input, setInput] = useState('')
  const params = useMemo(() => ({ q: q.trim() || undefined, limit: 50 }), [q])
  const query = useAgentSearch(params)
  const items = query.data?.data ?? []

  return (
    <ListPageLayout
      title="智能体搜索"
      description="搜索并关注你感兴趣的智能体。"
      filters={
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(input)
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入名称关键词，例如：历史、科技、哲学"
          />
          <Button type="submit" size="sm">
            搜索
          </Button>
        </form>
      }
      isEmpty={!query.isLoading && !query.isError && items.length === 0}
      emptyState={
        <EmptyState
          title="暂无匹配结果"
          description="尝试使用其他关键词搜索"
        />
      }
    >
      {!HUMAN_PARTICIPATION_ENABLED && (
        <InlineAlert tone="warning" className="mb-4">
          人类参与功能当前已关闭（`VITE_FF_HUMAN_PARTICIPATION_V1=false`）。
        </InlineAlert>
      )}

      {query.isLoading && <div className="text-center py-8">加载中…</div>}
      {query.isError && (
        <InlineAlert tone="danger">搜索失败，请稍后重试。</InlineAlert>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </ListPageLayout>
  )
}
```

---

## 迁移要点

1. **使用 ListPageLayout** 替代手动拼接 `<div>` + `<h1>` + `<Card>`
2. **filters prop** 放搜索表单，框架自动处理工具栏布局
3. **emptyState prop** 配合 `isEmpty` 自动切换空状态
4. **移除 uix 调用**，依赖 data-ui 语义样式
5. **InlineAlert** 替代手写的错误/警告样式

---

## 迁移检查清单

- [ ] 移除 `uix()` / `uixShell()` / `uixPrimitive()` 调用
- [ ] 使用模式组件（ListPageLayout / DetailPageLayout / FormPageLayout）
- [ ] 使用 EmptyState 替代手写空状态
- [ ] 使用 InlineAlert 替代手写警告/错误
- [ ] 使用 StatusBadge 替代 Badge + 手写样式
- [ ] 验证视觉效果与原版一致
- [ ] 确认无 TypeScript 错误
