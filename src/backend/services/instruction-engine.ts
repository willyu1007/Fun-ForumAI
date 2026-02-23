import type { PrismaClient } from '@prisma/client'

export interface InstructionContext {
  scene: 'chat_room' | 'forum_post' | 'forum_comment'
  conversation_text: string
  is_new_member_reply: boolean
  is_first_in_room: boolean
  controversy_score: number
}

interface MatchedInstruction {
  id: string
  name: string
  body: string
  priority: number
}

const TRIGGER_LEVEL_GATES: Record<string, number> = {
  always: 2,
  keyword: 2,
  scene: 2,
  reply_to_new_member: 3,
  first_message_in_room: 3,
  high_controversy: 4,
  custom_condition: 4,
}

const INSTRUCTION_TEMPLATES = [
  {
    id: 'socratic',
    name: '苏格拉底式提问',
    trigger_type: 'always',
    trigger_params: null,
    body: '用提问引导思考，不直接给结论',
  },
  {
    id: 'devils_advocate',
    name: '魔鬼代言人',
    trigger_type: 'keyword',
    trigger_params: { keywords: ['辩论', '讨论', '争议'] },
    body: '刻意提出对立观点，即使你不完全同意',
  },
  {
    id: 'eli5',
    name: 'ELI5 简单解释',
    trigger_type: 'keyword',
    trigger_params: { keywords: ['解释', '什么是', '为什么'] },
    body: '用最简单的语言解释，像对5岁小孩一样',
  },
  {
    id: 'pros_cons',
    name: '正反两面分析',
    trigger_type: 'scene',
    trigger_params: { scenes: ['forum_post'] },
    body: '先列正面理由，再列反面理由，最后给出你的判断',
  },
  {
    id: 'welcome_newcomer',
    name: '新人欢迎',
    trigger_type: 'reply_to_new_member',
    trigger_params: null,
    body: '热情欢迎，介绍房间话题，问对方兴趣',
  },
  {
    id: 'controversy_cooldown',
    name: '争议冷静剂',
    trigger_type: 'high_controversy',
    trigger_params: { threshold: 0.7 },
    body: '先肯定对方合理处，再温和提出不同看法',
  },
]

export class InstructionEngine {
  constructor(private readonly prisma: PrismaClient | null) {}

  async matchInstructions(agentId: string, context: InstructionContext): Promise<MatchedInstruction[]> {
    if (!this.prisma) return []

    const instructions = await this.prisma.agentInstruction.findMany({
      where: { agentId, enabled: true },
      orderBy: { priority: 'desc' },
    })

    const matched: MatchedInstruction[] = []

    for (const inst of instructions) {
      if (this.matches(inst, context)) {
        matched.push({ id: inst.id, name: inst.name, body: inst.body, priority: inst.priority })

        this.prisma.agentInstruction.update({
          where: { id: inst.id },
          data: { timesTriggered: { increment: 1 }, lastTriggeredAt: new Date() },
        }).catch(() => {})
      }
    }

    return matched.slice(0, 3)
  }

  async createInstruction(agentId: string, data: {
    name: string
    trigger_type: string
    trigger_params?: unknown
    body: string
    priority?: number
  }): Promise<{ success: boolean; error?: string; id?: string }> {
    if (!this.prisma) return { success: false, error: 'no_db' }

    const growth = await this.prisma.agentGrowth.findUnique({ where: { agentId } })
    const level = growth?.level ?? 1
    const slots = growth?.instructionSlots ?? 0

    const existing = await this.prisma.agentInstruction.count({ where: { agentId } })
    if (existing >= slots) {
      return { success: false, error: 'no_instruction_slots' }
    }

    const minLevel = TRIGGER_LEVEL_GATES[data.trigger_type]
    if (minLevel && level < minLevel) {
      return { success: false, error: `trigger_requires_level_${minLevel}` }
    }

    if (data.body.length > 200) {
      return { success: false, error: 'body_too_long' }
    }

    const inst = await this.prisma.agentInstruction.create({
      data: {
        agentId,
        name: data.name,
        triggerType: data.trigger_type,
        triggerParams: data.trigger_params ? (data.trigger_params as object) : undefined,
        body: data.body,
        priority: data.priority ?? 0,
      },
    })

    return { success: true, id: inst.id }
  }

  async updateInstruction(instructionId: string, data: {
    name?: string
    trigger_type?: string
    trigger_params?: unknown
    body?: string
    priority?: number
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.prisma) return { success: false, error: 'no_db' }

    if (data.body && data.body.length > 200) {
      return { success: false, error: 'body_too_long' }
    }

    await this.prisma.agentInstruction.update({
      where: { id: instructionId },
      data: {
        name: data.name,
        triggerType: data.trigger_type,
        triggerParams: data.trigger_params ? (data.trigger_params as object) : undefined,
        body: data.body,
        priority: data.priority,
      },
    })

    return { success: true }
  }

  async deleteInstruction(instructionId: string): Promise<void> {
    if (!this.prisma) return
    await this.prisma.agentInstruction.delete({ where: { id: instructionId } })
  }

  async toggleInstruction(instructionId: string): Promise<boolean> {
    if (!this.prisma) return false
    const inst = await this.prisma.agentInstruction.findUnique({ where: { id: instructionId } })
    if (!inst) return false
    await this.prisma.agentInstruction.update({
      where: { id: instructionId },
      data: { enabled: !inst.enabled },
    })
    return !inst.enabled
  }

  async getInstructions(agentId: string) {
    if (!this.prisma) return []
    return this.prisma.agentInstruction.findMany({
      where: { agentId },
      orderBy: { priority: 'desc' },
    })
  }

  getTemplates() { return INSTRUCTION_TEMPLATES }

  getLevelGates() { return TRIGGER_LEVEL_GATES }

  private matches(instruction: { triggerType: string; triggerParams: unknown }, context: InstructionContext): boolean {
    const params = instruction.triggerParams as Record<string, unknown> | null

    switch (instruction.triggerType) {
      case 'always':
        return true

      case 'keyword': {
        const keywords = (params?.keywords as string[]) ?? []
        const text = context.conversation_text.toLowerCase()
        return keywords.some(kw => text.includes(kw.toLowerCase()))
      }

      case 'scene': {
        const scenes = (params?.scenes as string[]) ?? []
        return scenes.includes(context.scene)
      }

      case 'reply_to_new_member':
        return context.is_new_member_reply

      case 'first_message_in_room':
        return context.is_first_in_room

      case 'high_controversy': {
        const threshold = (params?.threshold as number) ?? 0.7
        return context.controversy_score > threshold
      }

      case 'custom_condition':
        return false

      default:
        return false
    }
  }
}
