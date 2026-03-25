export type AgentTargetMode = 'manage' | 'readonly'
export type AgentTargetTab = 'intro' | 'chat' | 'moments' | 'history' | 'social'
export type AgentIntroSection =
  | 'overview'
  | 'stats'
  | 'privacy'
  | 'runs'
  | 'style'
  | 'instructions'
  | 'multimodal'
  | 'advanced'

export type AgentTarget =
  | {
      kind: 'manage'
      mode?: AgentTargetMode
    }
  | {
      kind: 'agent'
      agentId: string
      mode?: AgentTargetMode
      tab?: AgentTargetTab
      introSection?: AgentIntroSection | null
      sourceSessionId?: string | null
    }

const MODES = new Set<AgentTargetMode>(['manage', 'readonly'])
const TABS = new Set<AgentTargetTab>(['intro', 'chat', 'moments', 'history', 'social'])
const INTRO_SECTIONS = new Set<AgentIntroSection>([
  'overview',
  'stats',
  'privacy',
  'runs',
  'style',
  'instructions',
  'multimodal',
  'advanced',
])

function parseMode(value: string | null): AgentTargetMode | undefined {
  return value && MODES.has(value as AgentTargetMode) ? (value as AgentTargetMode) : undefined
}

function parseTab(value: string | null): AgentTargetTab | undefined {
  return value && TABS.has(value as AgentTargetTab) ? (value as AgentTargetTab) : undefined
}

function parseIntroSection(value: string | null): AgentIntroSection | undefined {
  return value && INTRO_SECTIONS.has(value as AgentIntroSection)
    ? (value as AgentIntroSection)
    : undefined
}

function parseCanonicalAgentTarget(value: string): AgentTarget | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'agent:') return null

  if (url.hostname === 'manage') {
    return {
      kind: 'manage',
      mode: parseMode(url.searchParams.get('mode')),
    }
  }

  if (url.hostname !== 'agent') return null

  const agentId = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  if (!agentId) return null

  const tab = parseTab(url.searchParams.get('tab')) ?? 'intro'
  const introSection = tab === 'intro'
    ? parseIntroSection(url.searchParams.get('section')) ?? null
    : null
  const sourceSessionId = url.searchParams.get('source_session_id')

  return {
    kind: 'agent',
    agentId,
    mode: parseMode(url.searchParams.get('mode')),
    tab,
    introSection,
    sourceSessionId: sourceSessionId && sourceSessionId.length > 0 ? sourceSessionId : null,
  }
}

function mapLegacyAgentTab(value: string | null): {
  tab?: AgentTargetTab
  introSection?: AgentIntroSection | null
} {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'chat':
      return { tab: 'chat' }
    case 'moments':
      return { tab: 'moments' }
    case 'achievements':
    case 'chronicle':
    case 'history':
    case 'highlights':
      return { tab: 'history' }
    case 'relations':
    case 'social':
      return { tab: 'social' }
    case 'overview':
    case 'stats':
    case 'privacy':
    case 'runs':
    case 'style':
    case 'instructions':
    case 'multimodal':
    case 'advanced':
      return {
        tab: 'intro',
        introSection: value as AgentIntroSection,
      }
    default:
      return {}
  }
}

function parseLegacyAgentTarget(value: string): AgentTarget | null {
  let url: URL
  try {
    url = new URL(value, 'https://fun-forum.local')
  } catch {
    return null
  }

  if (url.origin !== 'https://fun-forum.local') return null
  if (url.pathname === '/agents' || url.pathname === '/agents/') return null
  if (url.pathname === '/agents/manage' || url.pathname === '/agents/manage/') {
    return { kind: 'manage', mode: 'manage' }
  }

  const match = /^\/agents\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname)
  if (!match) return null

  const agentId = decodeURIComponent(match[1] ?? '')
  if (!agentId || agentId === 'manage') {
    return { kind: 'manage', mode: 'manage' }
  }

  const routeMapping = mapLegacyAgentTab(match[2] ?? null)
  const queryMapping = mapLegacyAgentTab(url.searchParams.get('tab'))
  const tab = queryMapping.tab ?? routeMapping.tab ?? 'intro'
  const introSection = tab === 'intro'
    ? queryMapping.introSection ?? routeMapping.introSection ?? null
    : null
  const sourceSessionId = url.searchParams.get('source_session_id')

  return {
    kind: 'agent',
    agentId,
    tab,
    introSection,
    sourceSessionId: sourceSessionId && sourceSessionId.length > 0 ? sourceSessionId : null,
  }
}

export function parseAgentTarget(value: string): AgentTarget | null {
  return parseCanonicalAgentTarget(value) ?? parseLegacyAgentTarget(value)
}

export function isAgentTargetString(value: string): boolean {
  return parseAgentTarget(value) !== null
}

export function buildManageAgentTarget(input?: {
  mode?: AgentTargetMode
}): string {
  const url = new URL('agent://manage')
  if (input?.mode) {
    url.searchParams.set('mode', input.mode)
  }
  return url.toString()
}

export function buildAgentTarget(input: {
  agentId: string
  mode?: AgentTargetMode
  tab?: AgentTargetTab
  introSection?: AgentIntroSection | null
  sourceSessionId?: string | null
}): string {
  const url = new URL(`agent://agent/${encodeURIComponent(input.agentId)}`)
  if (input.mode) {
    url.searchParams.set('mode', input.mode)
  }

  const tab = input.tab ?? 'intro'
  url.searchParams.set('tab', tab)
  if (tab === 'intro' && input.introSection) {
    url.searchParams.set('section', input.introSection)
  }
  if (input.sourceSessionId) {
    url.searchParams.set('source_session_id', input.sourceSessionId)
  }
  return url.toString()
}
