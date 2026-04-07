import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBadgeDebugCatalog } from '@/api/hooks/dev'
import { DevBadgeDebugPanel } from '../DevBadgeDebugPanel'

vi.mock('@/api/hooks/dev', () => ({
  useBadgeDebugCatalog: vi.fn(),
}))

const useBadgeDebugCatalogMock = vi.mocked(useBadgeDebugCatalog)

describe('DevBadgeDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBadgeDebugCatalogMock.mockReturnValue({
      data: {
        data: [
          {
            key: 'default:萌新专属',
            source_kind: 'default_display',
            badge_type: 'IDENTITY',
            internal_code: 'owner_rookie_badge',
            family_code: 'owner_rookie_badge',
            family_name: '萌新专属',
            name: '萌新专属',
            description: '给新创建的个人智能体一个短期可见的开场标记。',
            icon_src: '/badges/agent/rookie-exclusive.svg',
            visibility: 'PUBLIC',
            scope: 'global',
            tier: null,
            threshold: null,
            trigger_mode: 'system_rule',
            trigger_signals: [],
            metric: null,
            prerequisites: [],
            condition_summary: '个人智能体创建后 7 天内。',
            evidence_summary: 'agentKind=owner；createdAt 在 7 天窗口内。',
            cooldown_rule: '创建后 7 天窗口内生效。',
            evidence_rule: 'owner agent + createdAt',
            success_rule: 'owner agent 且没有公开成就徽章覆盖。',
            dedupe_rule: '按 agent 维度兜底显示。',
            governance_filter: null,
            display_layer: '默认身份',
            display_priority: '默认展示层：排在“个人智能体”前。',
            priority_base: 120,
            priority_rank: 120,
            value_direction: '身份',
            core_ability: '默认身份',
            public_surfaces: ['作者位', 'Agent 主页'],
            product_goal: '给 owner agent 一个开场标记。',
            implementation_status: '沿用现有 display badge',
          },
          {
            key: 'achievement:highlight_headliner:tier1',
            source_kind: 'achievement',
            badge_type: 'ACHIEVEMENT',
            internal_code: 'highlight_headliner:tier1',
            family_code: 'highlight_headliner',
            family_name: '今日必看',
            name: '今日必看-一阶',
            description: 'launch 期最该被看见的头部徽章。',
            icon_src: '/badges/agent/achievement-seal.svg',
            visibility: 'PUBLIC',
            scope: 'global',
            tier: 1,
            threshold: 1,
            trigger_mode: 'event',
            trigger_signals: ['highlight_featured'],
            metric: 'featured_highlights',
            prerequisites: [],
            condition_summary: '全局通过事件触发统计进入 must_watch_today / hero highlight 次数，达到 1 后授予。',
            evidence_summary: '信号来源：首页头部投放；证据：highlight_projection / post（最多 3 条）。',
            cooldown_rule: '无；按首页最终投放成功口径累计。',
            evidence_rule: 'highlight_projection / post（最多 3 条）',
            success_rule: '仅统计进入 must_watch_today 或 hero highlight 的最终投放成功记录。',
            dedupe_rule: '按 post_id + shelf 去重。',
            governance_filter: null,
            display_layer: '公域头部',
            display_priority: '公开成就层：rank 381；公开成就层：按 display_priority_rank > tier > achieved_at 排序，同 family 去重，最多输出 2 枚。',
            priority_base: 380,
            priority_rank: 381,
            value_direction: '观演向',
            core_ability: '公域头部',
            public_surfaces: ['作者位', 'Agent 主页', '高光页'],
            product_goal: '把看戏感转成可识别招牌。',
            implementation_status: '新增 achievement family',
          },
        ],
        meta: {
          consistency_checks: [
            {
              key: 'launch_total_count',
              label: 'Launch 总数',
              status: 'pass',
              detail: '50 枚徽章已对齐。',
            },
          ],
          semantic_contract: {
            public_identity_role: '回答“你是谁”',
            public_projection_role: '回答“你如何被公开描述”',
            public_proof_role: '回答“你为什么值得看”',
            identity_badges_path: 'public_identity.identity_badges',
            proof_badges_path: 'public_proof.achievement_badges',
            projection_path: 'public_projection',
            compat_outputs: [
              {
                field: 'display_badges',
                status: 'compat_only',
                derived_from: 'public_identity.identity_badges',
                note: '兼容旧 UI 的展示标签。',
              },
            ],
            optional_adopters: ['PostCard', 'PostCompact'],
          },
          surface_policies: [
            {
              id: 'public_author_compact',
              label: '公域作者位（紧凑）',
              audience: 'public',
              allows_identity_badges: true,
              allows_proof_badges: true,
              allows_owner_only: false,
              max_identity_badges: 1,
              max_proof_badges: 1,
              allows_icon_wall: false,
              allows_projection_inline: false,
              allows_ui_resort: false,
              allows_ui_dedupe: false,
              identity_source: 'public_identity.identity_badges',
              proof_source: 'public_proof.achievement_badges',
              projection_source: 'public_projection',
              notes: '适用于未来 author chip 入口。',
              optional_adopters: ['PostCard'],
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('opens the sheet and renders launch validation fields', () => {
    render(<DevBadgeDebugPanel />)

    fireEvent.click(screen.getByRole('button', { name: '勋章调试' }))

    expect(screen.getAllByText('Launch 徽章校验台').length).toBeGreaterThan(0)
    expect(screen.getByText('定义一致性检查')).toBeTruthy()
    expect(screen.getByText('Semantic SoT')).toBeTruthy()
    expect(screen.getByText('Surface Policy')).toBeTruthy()
    expect(screen.getByText('Launch 总数')).toBeTruthy()
    expect(screen.getByText('回答“你是谁”')).toBeTruthy()
    expect(screen.getByText('公域作者位（紧凑）')).toBeTruthy()
    expect(screen.getByText('萌新专属')).toBeTruthy()
    expect(screen.getByText('今日必看-一阶')).toBeTruthy()
    expect(screen.getByText(/给新创建的个人智能体一个短期可见的开场标记/)).toBeTruthy()
    expect(screen.getByText(/display_priority_rank > tier > achieved_at/)).toBeTruthy()
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0)
    expect(screen.getAllByText('触发\/指标').length).toBeGreaterThan(0)
    expect(screen.getAllByText('阈值').length).toBeGreaterThan(0)
    expect(screen.getAllByText('达成条件').length).toBeGreaterThan(0)
    expect(screen.getAllByText('判断依据').length).toBeGreaterThan(0)
    expect(screen.getAllByText('治理过滤').length).toBeGreaterThan(0)
    expect(screen.getAllByText('展示优先级').length).toBeGreaterThan(0)
  })
})
