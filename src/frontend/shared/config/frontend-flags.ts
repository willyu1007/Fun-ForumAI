export type FrontendFlagValue = 'true' | 'false'

export const FRONTEND_FLAG_KEYS = [
  'VITE_FF_AGENT_STATS_UI',
  'VITE_FF_GUIDANCE_V1',
  'VITE_FF_HOME_PROGRAMMING_V1',
  'VITE_FF_PROGRAMMING_OPS_V1',
  'VITE_FF_CHATROOM_STAGING_HOLD_V1',
  'VITE_FF_DISABLE_SSE',
  'VITE_FF_ADMIN_RUNTIME_RECORDS_UI',
] as const

export type FrontendFlagKey = typeof FRONTEND_FLAG_KEYS[number]
export type FrontendFlagSource = 'vite-env' | 'default'

export interface FrontendFlagDefinition {
  key: FrontendFlagKey
  label: string
  summary: string
  feature: string
  surfaces: string[]
  effect: string
  recommendation: string
  debugCommands?: Array<{
    label: string
    command: string
  }>
  defaultValue: FrontendFlagValue
  contractStatus: 'declared' | 'code-only'
}

export interface FrontendFlagDebugEntry extends FrontendFlagDefinition {
  value: FrontendFlagValue
  source: FrontendFlagSource
}

export const FRONTEND_FLAG_DEFINITIONS: readonly FrontendFlagDefinition[] = [
  {
    key: 'VITE_FF_AGENT_STATS_UI',
    label: 'Agent Stats UI',
    summary: '智能体 Stats 面板',
    feature: 'Owner agent modal 中的 Stats / 塑造能力面板。',
    surfaces: ['Agent modal / 塑造'],
    effect: '开启后 Owner 可在塑造页看到 Stats 能力区与相关解释面板。',
    recommendation: '与 backend `FF_AGENT_STATS_*` 配套开启，避免只暴露半开入口。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_GUIDANCE_V1',
    label: 'Guidance',
    summary: '指引系统',
    feature: 'Guidance Inbox、右 rail 承接区、agent modal guidance、私聊 receipt。',
    surfaces: ['Guidance Inbox', 'ShellRightRail', 'Agent modal', 'Private chat'],
    effect: '开启后会加载 guidance 相关入口、查询和回执 UI。',
    recommendation: '保留为总开关，不建议继续拆更多前端子开关。',
    defaultValue: 'true',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_HOME_PROGRAMMING_V1',
    label: 'Home Programming',
    summary: '首页节目编排',
    feature: '首页是否采用节目编排入口，而不是旧广场 feed。',
    surfaces: ['HomePage'],
    effect: '开启后 `/` 会渲染 programming home shelves；关闭则回退 FeedPage。',
    recommendation: '这是首页 IA 级切换，短中期可保留，方向定版后删除。',
    defaultValue: 'true',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_PROGRAMMING_OPS_V1',
    label: 'Programming Ops',
    summary: '编排后台能力',
    feature: 'Admin 面板中的 Programming tab。',
    surfaces: ['Admin / ProgrammingTab'],
    effect: '开启后 admin 可读 launch programming ops read model。',
    recommendation: '属于 admin/ops 能力门，建议保留。',
    defaultValue: 'true',
    contractStatus: 'declared',
  },
  {
    key: 'VITE_FF_CHATROOM_STAGING_HOLD_V1',
    label: 'Chatroom Hold',
    summary: '聊天室功能',
    feature: '聊天室 staging 占位页。',
    surfaces: ['ChatRoomListPage', 'ChatRoomPage'],
    effect: '开启后 `/rooms` 和 `/rooms/:roomId` 会展示亮点介绍与敬请期待，而不进入真实聊天室。',
    recommendation: '默认保持 hold；确认聊天室可公开使用后，显式设为 false 以重开真实聊天室。',
    debugCommands: [
      {
        label: '本地前端 hold',
        command: 'pnpm dev:frontend:chatroom:hold',
      },
      {
        label: '本地前后端 hold',
        command: 'pnpm dev:chatroom:hold',
      },
      {
        label: '构建证明检查',
        command: 'curl -s http://localhost:4000/frontend-build-capabilities.json | jq',
      },
    ],
    defaultValue: 'true',
    contractStatus: 'code-only',
  },
  {
    key: 'VITE_FF_DISABLE_SSE',
    label: 'Disable SSE',
    summary: '关闭实时更新',
    feature: 'Forum、公共 chat、私聊的实时更新 kill switch。',
    surfaces: ['Forum SSE', 'Chat room SSE', 'Private chat SSE'],
    effect: '开启后前端停止连接 SSE，实时刷新和新内容提示会消失。',
    recommendation: '运行行为 kill switch，建议保留。',
    defaultValue: 'false',
    contractStatus: 'code-only',
  },
  {
    key: 'VITE_FF_ADMIN_RUNTIME_RECORDS_UI',
    label: 'Admin Runtime Records UI',
    summary: '运行记录控制台',
    feature: 'T-301 admin "运行记录" 页：运行操作记录列表、infra snapshot、LLM 连通性诊断。',
    surfaces: ['Admin / RuntimeRecordsPage', 'Admin sidebar 状态与运维'],
    effect: '开启后 admin 侧栏出现 "运行记录" 入口，并启用 /admin/runtime-records 路由。',
    recommendation: '与后端 FF_ADMIN_RUNTIME_RECORDS_UI 配套开启。dev/local 默认开。',
    defaultValue: 'false',
    contractStatus: 'declared',
  },
] as const

const FLAG_DEFAULTS = Object.fromEntries(
  FRONTEND_FLAG_DEFINITIONS.map((definition) => [definition.key, definition.defaultValue]),
) as Record<FrontendFlagKey, FrontendFlagValue>

function isFrontendFlagValue(value: unknown): value is FrontendFlagValue {
  return value === 'true' || value === 'false'
}

function readFlagFromImportMetaEnv(key: FrontendFlagKey): string | undefined {
  switch (key) {
    case 'VITE_FF_AGENT_STATS_UI':
      return import.meta.env.VITE_FF_AGENT_STATS_UI
    case 'VITE_FF_GUIDANCE_V1':
      return import.meta.env.VITE_FF_GUIDANCE_V1
    case 'VITE_FF_HOME_PROGRAMMING_V1':
      return import.meta.env.VITE_FF_HOME_PROGRAMMING_V1
    case 'VITE_FF_PROGRAMMING_OPS_V1':
      return import.meta.env.VITE_FF_PROGRAMMING_OPS_V1
    case 'VITE_FF_CHATROOM_STAGING_HOLD_V1':
      return import.meta.env.VITE_FF_CHATROOM_STAGING_HOLD_V1
    case 'VITE_FF_DISABLE_SSE':
      return import.meta.env.VITE_FF_DISABLE_SSE
    case 'VITE_FF_ADMIN_RUNTIME_RECORDS_UI':
      return import.meta.env.VITE_FF_ADMIN_RUNTIME_RECORDS_UI
  }
}

function readBaseFrontendFlagValue(key: FrontendFlagKey): FrontendFlagValue {
  const value = readFlagFromImportMetaEnv(key)
  if (isFrontendFlagValue(value)) {
    return value
  }
  return FLAG_DEFAULTS[key]
}

export function readFrontendFlagValue(key: FrontendFlagKey): FrontendFlagValue {
  return readBaseFrontendFlagValue(key)
}

export function isFrontendFlagEnabled(key: FrontendFlagKey): boolean {
  return readFrontendFlagValue(key) === 'true'
}

export function readFrontendFlagSource(key: FrontendFlagKey): FrontendFlagSource {
  return isFrontendFlagValue(readFlagFromImportMetaEnv(key)) ? 'vite-env' : 'default'
}

export function readFrontendFlagDebugEntries(): FrontendFlagDebugEntry[] {
  return FRONTEND_FLAG_DEFINITIONS.map((definition) => ({
    ...definition,
    value: readFrontendFlagValue(definition.key),
    source: readFrontendFlagSource(definition.key),
  }))
}
