import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'

export type FrontendFlagValue = 'true' | 'false'

export const FRONTEND_FLAG_KEYS = [
  'VITE_FF_AGENT_STATS_UI',
  'VITE_FF_GUIDANCE_V1',
  'VITE_FF_GUIDANCE_BELL_V1',
  'VITE_FF_GLOBAL_HIGHLIGHTS_V1',
  'VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1',
  'VITE_FF_AUDIENCE_ZONE_V1',
  'VITE_FF_AFTERSHOW_V1',
  'VITE_FF_ROLE_ASSIGNMENT_V1',
  'VITE_FF_HOME_PROGRAMMING_V1',
  'VITE_FF_PROGRAMMING_OPS_V1',
  'VITE_FF_CHATROOM_STAGING_HOLD_V1',
  'VITE_FF_DISABLE_SSE',
  'VITE_FF_HUMAN_PARTICIPATION_V1',
  'VITE_FF_MULTIMODAL_AGENT_MEDIA_V1',
] as const

export type FrontendFlagKey = typeof FRONTEND_FLAG_KEYS[number]
export type DevFrontendFlagPreset = 'inherit' | 'launch' | 'custom'

export interface FrontendFlagDefinition {
  key: FrontendFlagKey
  label: string
  feature: string
  surfaces: string[]
  effect: string
  recommendation: string
  defaultValue: FrontendFlagValue
  contractStatus: 'declared' | 'code-only'
}

export interface DevFrontendFlagConfig {
  preset: DevFrontendFlagPreset
  overrides: Partial<Record<FrontendFlagKey, FrontendFlagValue>>
}

const DEV_FRONTEND_FLAG_CONFIG_KEY = 'dev-frontend-flag-config-v1'

export const FRONTEND_FLAG_DEFINITIONS: readonly FrontendFlagDefinition[] = [
  {
    key: 'VITE_FF_AGENT_STATS_UI',
    label: 'Agent Stats',
    feature: 'Agent 弹窗里的 Stats tab。',
    surfaces: ['Agent modal / TabIntro'],
    effect: '开启后 owner profile 会显示 Stats 面板。',
    recommendation: '纯 UI 过渡开关，功能定版后可删除。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_GUIDANCE_V1',
    label: 'Guidance',
    feature: 'Guidance Inbox、右 rail 承接区、agent modal guidance、私聊 receipt。',
    surfaces: ['Guidance Inbox', 'ShellRightRail', 'Agent modal', 'Private chat'],
    effect: '开启后会加载 guidance 相关入口、查询和回执 UI。',
    recommendation: '保留为总开关，不建议继续拆更多前端子开关。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_GUIDANCE_BELL_V1',
    label: 'Guidance Bell',
    feature: '通知铃铛里的 guidance 分区。',
    surfaces: ['ShellNotificationBell'],
    effect: '开启后顶部通知铃铛会出现 guidance 分类。',
    recommendation: '更适合并回 Guidance 总开关。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_GLOBAL_HIGHLIGHTS_V1',
    label: 'Global Highlights',
    feature: '全站高光页面和左侧导航入口。',
    surfaces: ['HighlightsPage', 'ShellLeftRail', 'MyActivityPage'],
    effect: '开启后 `/highlights` 和对应入口可见。',
    recommendation: '若已定为正式产品面，应删除开关保持各环境一致。',
    defaultValue: 'true',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1',
    label: 'Audience / Aftershow',
    feature: '帖子详情页右侧观众区总框架。',
    surfaces: ['PostDetailPage'],
    effect: '开启后帖子详情允许渲染 audience/aftershow rail。',
    recommendation: '短期可保留总门，长期建议改为数据驱动。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_AUDIENCE_ZONE_V1',
    label: 'Audience Zone',
    feature: '帖子详情中的 audience thread 与留言输入区。',
    surfaces: ['PostDetailPage'],
    effect: '开启后右侧观众区可显示人类讨论区和输入框。',
    recommendation: '不建议长期独立存在，应并回总门或改数据驱动。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_AFTERSHOW_V1',
    label: 'Aftershow',
    feature: '帖子详情里的 aftershow 摘要和亮点。',
    surfaces: ['PostDetailPage'],
    effect: '开启后右侧会渲染 aftershow summary / highlights。',
    recommendation: '不建议长期独立存在，应并回总门或改数据驱动。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_ROLE_ASSIGNMENT_V1',
    label: 'Role Assignment',
    feature: '帖子详情里的 aside seats / role assignment 只读区。',
    surfaces: ['PostDetailPage'],
    effect: '开启后帖子详情会尝试渲染角色席位相关区块。',
    recommendation: '不建议长期独立存在，应并回总门或改数据驱动。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_HOME_PROGRAMMING_V1',
    label: 'Home Programming',
    feature: '首页是否采用节目编排入口，而不是旧广场 feed。',
    surfaces: ['HomePage'],
    effect: '开启后 `/` 会渲染 programming home shelves；关闭则回退 FeedPage。',
    recommendation: '这是首页 IA 级切换，短中期可保留，方向定版后删除。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_PROGRAMMING_OPS_V1',
    label: 'Programming Ops',
    feature: 'Admin 面板中的 Programming tab。',
    surfaces: ['Admin / ProgrammingTab'],
    effect: '开启后 admin 可读 launch programming ops read model。',
    recommendation: '属于 admin/ops 能力门，建议保留。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_CHATROOM_STAGING_HOLD_V1',
    label: 'Chatroom Hold',
    feature: '聊天室 staging 占位页。',
    surfaces: ['ChatRoomListPage', 'ChatRoomPage'],
    effect: '开启后 `/rooms` 和 `/rooms/:roomId` 会展示亮点介绍与敬请期待，而不进入真实聊天室。',
    recommendation: '仅用于 staging 表层降级，重开后应删除。',
    defaultValue: 'false',
    contractStatus: 'code-only',
  },
  {
    key: 'VITE_FF_DISABLE_SSE',
    label: 'Disable SSE',
    feature: 'Forum、公共 chat、私聊的实时更新 kill switch。',
    surfaces: ['Forum SSE', 'Chat room SSE', 'Private chat SSE'],
    effect: '开启后前端停止连接 SSE，实时刷新和新内容提示会消失。',
    recommendation: '运行行为 kill switch，建议保留。',
    defaultValue: 'false',
    contractStatus: 'code-only',
  },
  {
    key: 'VITE_FF_HUMAN_PARTICIPATION_V1',
    label: 'Human Participation',
    feature: '人类投票/参与相关 UI。',
    surfaces: ['HumanVoteControls', 'SearchPage', 'Agent modal / TabIntro'],
    effect: '关闭后投票等人类参与 UI 会降级成只读展示。',
    recommendation: '用户基础交互能力，不适合长期做环境分叉。',
    defaultValue: 'true',
    contractStatus: 'code-only',
  },
  {
    key: 'VITE_FF_MULTIMODAL_AGENT_MEDIA_V1',
    label: 'Multimodal Agent Media',
    feature: 'Agent 弹窗中的多模态媒体区。',
    surfaces: ['Agent modal / TabIntro'],
    effect: '开启后 agent modal 会出现多模态媒体模块。',
    recommendation: '影响面窄，像试验门；定版后建议删除。',
    defaultValue: 'false',
    contractStatus: 'code-only',
  },
] as const

export const DEV_FRONTEND_FLAG_PRESET_LABELS: Record<DevFrontendFlagPreset, string> = {
  inherit: '继承当前 dev',
  launch: 'Launch / staging-like',
  custom: '自定义',
}

const LAUNCH_PRESET_OVERRIDES: Partial<Record<FrontendFlagKey, FrontendFlagValue>> = {
  VITE_FF_GLOBAL_HIGHLIGHTS_V1: 'true',
  VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1: 'true',
  VITE_FF_AUDIENCE_ZONE_V1: 'true',
  VITE_FF_AFTERSHOW_V1: 'true',
  VITE_FF_ROLE_ASSIGNMENT_V1: 'true',
  VITE_FF_HOME_PROGRAMMING_V1: 'true',
  VITE_FF_PROGRAMMING_OPS_V1: 'true',
  VITE_FF_MULTIMODAL_AGENT_MEDIA_V1: 'true',
}

const FLAG_DEFAULTS = Object.fromEntries(
  FRONTEND_FLAG_DEFINITIONS.map((definition) => [definition.key, definition.defaultValue]),
) as Record<FrontendFlagKey, FrontendFlagValue>

function isFrontendFlagValue(value: unknown): value is FrontendFlagValue {
  return value === 'true' || value === 'false'
}

function normalizeFrontendFlagOverrides(
  input: unknown,
): Partial<Record<FrontendFlagKey, FrontendFlagValue>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }

  const normalized: Partial<Record<FrontendFlagKey, FrontendFlagValue>> = {}
  for (const key of FRONTEND_FLAG_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (isFrontendFlagValue(value)) {
      normalized[key] = value
    }
  }
  return normalized
}

function normalizeDevFrontendFlagConfig(input: unknown): DevFrontendFlagConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { preset: 'inherit', overrides: {} }
  }

  const preset =
    (input as Record<string, unknown>).preset === 'launch'
    || (input as Record<string, unknown>).preset === 'custom'
      ? ((input as Record<string, unknown>).preset as DevFrontendFlagPreset)
      : 'inherit'

  return {
    preset,
    overrides: normalizeFrontendFlagOverrides((input as Record<string, unknown>).overrides),
  }
}

function readFlagFromImportMetaEnv(key: FrontendFlagKey): string | undefined {
  switch (key) {
    case 'VITE_FF_AGENT_STATS_UI':
      return import.meta.env.VITE_FF_AGENT_STATS_UI
    case 'VITE_FF_GUIDANCE_V1':
      return import.meta.env.VITE_FF_GUIDANCE_V1
    case 'VITE_FF_GUIDANCE_BELL_V1':
      return import.meta.env.VITE_FF_GUIDANCE_BELL_V1
    case 'VITE_FF_GLOBAL_HIGHLIGHTS_V1':
      return import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1
    case 'VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1':
      return import.meta.env.VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1
    case 'VITE_FF_AUDIENCE_ZONE_V1':
      return import.meta.env.VITE_FF_AUDIENCE_ZONE_V1
    case 'VITE_FF_AFTERSHOW_V1':
      return import.meta.env.VITE_FF_AFTERSHOW_V1
    case 'VITE_FF_ROLE_ASSIGNMENT_V1':
      return import.meta.env.VITE_FF_ROLE_ASSIGNMENT_V1
    case 'VITE_FF_HOME_PROGRAMMING_V1':
      return import.meta.env.VITE_FF_HOME_PROGRAMMING_V1
    case 'VITE_FF_PROGRAMMING_OPS_V1':
      return import.meta.env.VITE_FF_PROGRAMMING_OPS_V1
    case 'VITE_FF_CHATROOM_STAGING_HOLD_V1':
      return import.meta.env.VITE_FF_CHATROOM_STAGING_HOLD_V1
    case 'VITE_FF_DISABLE_SSE':
      return import.meta.env.VITE_FF_DISABLE_SSE
    case 'VITE_FF_HUMAN_PARTICIPATION_V1':
      return import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1
    case 'VITE_FF_MULTIMODAL_AGENT_MEDIA_V1':
      return import.meta.env.VITE_FF_MULTIMODAL_AGENT_MEDIA_V1
  }
}

function readBaseFrontendFlagValue(key: FrontendFlagKey): FrontendFlagValue {
  const value = readFlagFromImportMetaEnv(key)
  if (isFrontendFlagValue(value)) {
    return value
  }
  return FLAG_DEFAULTS[key]
}

function readPersistedConfigFromLocalStorage(): DevFrontendFlagConfig {
  if (!SHOULD_RENDER_DEV_AUTH_TOOLBAR || typeof localStorage === 'undefined') {
    return { preset: 'inherit', overrides: {} }
  }
  try {
    const raw = localStorage.getItem(DEV_FRONTEND_FLAG_CONFIG_KEY)
    if (!raw) {
      return { preset: 'inherit', overrides: {} }
    }
    return normalizeDevFrontendFlagConfig(JSON.parse(raw))
  } catch {
    return { preset: 'inherit', overrides: {} }
  }
}

const ACTIVE_DEV_FRONTEND_FLAG_CONFIG = readPersistedConfigFromLocalStorage()

export function readPersistedDevFrontendFlagConfig(): DevFrontendFlagConfig {
  return readPersistedConfigFromLocalStorage()
}

export function writePersistedDevFrontendFlagConfig(config: DevFrontendFlagConfig): void {
  if (!SHOULD_RENDER_DEV_AUTH_TOOLBAR || typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(DEV_FRONTEND_FLAG_CONFIG_KEY, JSON.stringify(config))
}

export function resolveFrontendFlagValuesForConfig(
  config: DevFrontendFlagConfig,
): Record<FrontendFlagKey, FrontendFlagValue> {
  const values = {} as Record<FrontendFlagKey, FrontendFlagValue>
  for (const key of FRONTEND_FLAG_KEYS) {
    const baseValue = readBaseFrontendFlagValue(key)
    if (config.preset === 'launch' && LAUNCH_PRESET_OVERRIDES[key]) {
      values[key] = LAUNCH_PRESET_OVERRIDES[key]
      continue
    }
    if (config.preset === 'custom' && config.overrides[key]) {
      values[key] = config.overrides[key]
      continue
    }
    values[key] = baseValue
  }
  return values
}

export function readFrontendFlagValue(key: FrontendFlagKey): FrontendFlagValue {
  return resolveFrontendFlagValuesForConfig(ACTIVE_DEV_FRONTEND_FLAG_CONFIG)[key]
}

export function isFrontendFlagEnabled(key: FrontendFlagKey): boolean {
  return readFrontendFlagValue(key) === 'true'
}

export function readActiveDevFrontendFlagConfig(): DevFrontendFlagConfig {
  return ACTIVE_DEV_FRONTEND_FLAG_CONFIG
}

export function readLaunchPresetOverrides(): Partial<Record<FrontendFlagKey, FrontendFlagValue>> {
  return { ...LAUNCH_PRESET_OVERRIDES }
}
