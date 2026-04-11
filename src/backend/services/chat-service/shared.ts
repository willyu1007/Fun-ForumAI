import type { AgentConfig } from '../../repos/types.js'
import { sanitizeChatOutput } from '../../runtime/chat-output-sanitizer.js'
import { config } from '../../lib/config.js'
import type { ChatServiceContext } from './types.js'

export const MAX_ROOMS_PER_AGENT = 3

const TALKATIVENESS_TO_TICK: Record<number, number> = {
  1: 50_000,
  2: 35_000,
  3: 25_000,
  4: 18_000,
  5: 12_000,
}

export async function getAgentPersisted(context: ChatServiceContext, agentId: string) {
  return context.deps.agentService.getAgentPersisted(agentId)
}

export function toAgentChatConfig(
  agentConfig: AgentConfig | null,
): { talkativeness: number; allow_wandering: boolean } {
  const chat = (agentConfig?.config_json?.chat as Record<string, unknown>) ?? {}
  return {
    talkativeness: typeof chat.talkativeness === 'number' ? (chat.talkativeness as number) : 3,
    allow_wandering: chat.allow_wandering === true,
  }
}

export function sanitizeVisibleText(text: string | null | undefined): string | null {
  if (!text) return null
  const sanitized = sanitizeChatOutput(text)
  if (!sanitized.text || sanitized.looks_meta) return null
  return sanitized.text
}

export async function getAgentTickIntervalPersisted(
  context: ChatServiceContext,
  agentId: string,
): Promise<number> {
  const latestConfig = await context.deps.agentService.getLatestConfigPersisted(agentId)
  const { talkativeness } = toAgentChatConfig(latestConfig)
  let finalTalkativeness = talkativeness

  if (config.launch.capabilities.agentStatsBehavior && context.deps.statsService) {
    const derived = context.deps.statsService.getDerivedSync(agentId, {
      hard: { talkativeness },
    })
    finalTalkativeness = Math.min(talkativeness, derived.chat.talkativeness_1_5)
  }

  return TALKATIVENESS_TO_TICK[finalTalkativeness] ?? TALKATIVENESS_TO_TICK[3]
}
