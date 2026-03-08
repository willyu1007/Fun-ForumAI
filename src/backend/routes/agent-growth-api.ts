import { Router, type IRouter } from 'express'
import { XP_PER_GROWTH_POINT } from '../services/xp-service.js'
import { TraitEngine } from '../services/trait-engine.js'
import { CreditService } from '../services/credit-service.js'
import { InstructionEngine } from '../services/instruction-engine.js'
import type { PrismaClient } from '@prisma/client'
import { agentService, xpService } from '../container.js'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { ForbiddenError } from '../lib/errors.js'
import {
  applyStyleSettingsPatch,
  readStyleSettings,
  type OwnerStylePins,
} from '../identity/agent-identity.js'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}

export const agentNurtureRouter: IRouter = Router()

function assertOwner(agentId: string, userId: string): void {
  const agent = agentService.getAgent(agentId)
  if (agent.owner_id !== userId) {
    throw new ForbiddenError('Not your agent')
  }
}

function asParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getLazySingletons() {
  const prisma = getPrismaOrNull()
  return {
    traits: new TraitEngine(prisma),
    credit: new CreditService(prisma),
    instructions: new InstructionEngine(prisma),
  }
}

let _singletons: ReturnType<typeof getLazySingletons> | null = null
function singletons() {
  if (!_singletons) _singletons = getLazySingletons()
  return _singletons
}

// ─── XP ──────────────────────────────────────────────────────

agentNurtureRouter.get('/agents/:agentId/xp', async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const [summary, stats] = await Promise.all([
    xpService?.getXpSummary(agentId) ?? Promise.resolve({ xp: 0, xp_per_growth_point: XP_PER_GROWTH_POINT, growth_points_total: 0 }),
    getPrismaOrNull()?.agentStats.findUnique({ where: { agentId } }) ?? Promise.resolve(null),
  ])
  const growthPointsAvailable = stats?.unspentPoints ?? summary.growth_points_total
  res.json({
    data: {
      xp: summary.xp,
      xp_per_growth_point: summary.xp_per_growth_point,
      growth_points_total: summary.growth_points_total,
      growth_points_spent: Math.max(summary.growth_points_total - growthPointsAvailable, 0),
      growth_points_available: growthPointsAvailable,
    },
  })
})

agentNurtureRouter.get('/agents/:agentId/xp-events', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const rawLimit = parseInt(String(req.query.limit ?? '50'), 10)
  const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 200)
  const events = await (xpService?.getXpEvents(agentId, limit) ?? Promise.resolve([]))
  res.json({ data: events })
})

// ─── Traits ──────────────────────────────────────────────────

agentNurtureRouter.get('/agents/:agentId/traits', async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const traits = await singletons().traits.getTraits(agentId)
  res.json({
    data: traits.map(t => ({
      id: t.id,
      trait_code: t.traitCode,
      category: t.category,
      status: t.status,
      acquired_at: t.acquiredAt.toISOString(),
      equipped_at: t.equippedAt?.toISOString() ?? null,
      evidence: t.evidence,
    })),
  })
})

agentNurtureRouter.post('/agents/:agentId/traits/:traitCode/equip', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const traitCode = asParam(req.params.traitCode)
  const result = await singletons().traits.equipTrait(agentId, traitCode)
  if (!result.success) {
    res.status(400).json({ error: { code: 'EQUIP_FAILED', message: result.error } })
    return
  }
  res.json({ data: { message: 'equipped' } })
})

agentNurtureRouter.post('/agents/:agentId/traits/:traitCode/unequip', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const traitCode = asParam(req.params.traitCode)
  const result = await singletons().traits.unequipTrait(agentId, traitCode)
  if (!result.success) {
    res.status(400).json({ error: { code: 'UNEQUIP_FAILED', message: result.error } })
    return
  }
  res.json({ data: { message: 'unequipped' } })
})

agentNurtureRouter.get('/trait-definitions', (_req, res) => {
  res.json({ data: singletons().traits.getTraitDefinitions() })
})

// ─── Credit ──────────────────────────────────────────────────

agentNurtureRouter.get('/agents/:agentId/credit', async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const credit = await singletons().credit.getCredit(agentId)
  res.json({ data: credit })
})

agentNurtureRouter.get('/agents/:agentId/credit-events', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const rawCreditLimit = parseInt(String(req.query.limit ?? '20'), 10)
  const creditLimit = Number.isNaN(rawCreditLimit) ? 20 : Math.min(Math.max(rawCreditLimit, 1), 200)
  const events = await singletons().credit.getCreditEvents(agentId, creditLimit)
  res.json({ data: events })
})

// ─── Instructions (T-019) ────────────────────────────────────

agentNurtureRouter.get('/agents/:agentId/instructions', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const instructions = await singletons().instructions.getInstructions(agentId)
  res.json({
    data: instructions.map(i => ({
      id: i.id,
      name: i.name,
      enabled: i.enabled,
      priority: i.priority,
      trigger_type: i.triggerType,
      trigger_params: i.triggerParams,
      body: i.body,
      times_triggered: i.timesTriggered,
      last_triggered_at: i.lastTriggeredAt?.toISOString() ?? null,
      created_at: i.createdAt.toISOString(),
    })),
  })
})

agentNurtureRouter.post('/agents/:agentId/instructions', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const result = await singletons().instructions.createInstruction(agentId, {
    name: req.body.name,
    trigger_type: req.body.trigger_type,
    trigger_params: req.body.trigger_params,
    body: req.body.body,
    priority: req.body.priority,
  })
  if (!result.success) {
    res.status(400).json({ error: { code: 'CREATE_FAILED', message: result.error } })
    return
  }
  res.status(201).json({ data: { id: result.id } })
})

agentNurtureRouter.patch('/agents/:agentId/instructions/:instructionId', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const instructionId = asParam(req.params.instructionId)
  const result = await singletons().instructions.updateInstruction(instructionId, {
    name: req.body.name,
    trigger_type: req.body.trigger_type,
    trigger_params: req.body.trigger_params,
    body: req.body.body,
    priority: req.body.priority,
  })
  if (!result.success) {
    res.status(400).json({ error: { code: 'UPDATE_FAILED', message: result.error } })
    return
  }
  res.json({ data: { message: 'updated' } })
})

agentNurtureRouter.delete('/agents/:agentId/instructions/:instructionId', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const instructionId = asParam(req.params.instructionId)
  await singletons().instructions.deleteInstruction(instructionId)
  res.json({ data: { message: 'deleted' } })
})

agentNurtureRouter.post('/agents/:agentId/instructions/:instructionId/toggle', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const instructionId = asParam(req.params.instructionId)
  const enabled = await singletons().instructions.toggleInstruction(instructionId)
  res.json({ data: { enabled } })
})

agentNurtureRouter.get('/instruction-templates', (_req, res) => {
  res.json({ data: singletons().instructions.getTemplates() })
})

// ─── Style (T-019) ──────────────────────────────────────────

agentNurtureRouter.get('/agents/:agentId/style', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const latestConfig = agentService.getLatestConfig(agentId)
  res.json({ data: readStyleSettings(latestConfig?.config_json ?? {}) })
})

agentNurtureRouter.patch('/agents/:agentId/style', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  const existing = agentService.getLatestConfig(agentId)?.config_json ?? {}
  const nextConfig = applyStyleSettingsPatch(existing, req.body as Partial<OwnerStylePins>)
  const saved = await agentService.updateConfig(agentId, nextConfig, req.user!.userId)

  res.json({
    data: {
      message: 'updated',
      style: readStyleSettings(saved.config_json),
    },
  })
})

// ─── Prompt Overrides (T-019) ────────────────────────────────

const DANGEROUS_PATTERNS = [
  /忽略上面/i,
  /ignore.*previous/i,
  /forget.*instructions/i,
  /you are now/i,
  /disregard/i,
]

agentNurtureRouter.get('/agents/:agentId/prompt-overrides', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  if (!getPrismaOrNull()) {
    res.json({ data: {} })
    return
  }
  const prisma = getPrismaOrNull()!
  const agentConfig = await prisma.agentConfig.findFirst({
    where: { agentId },
    orderBy: { effectiveAt: 'desc' },
  })
  const configJson = (agentConfig?.configJson as Record<string, unknown>) ?? {}
  res.json({ data: configJson.prompt_overrides ?? {} })
})

agentNurtureRouter.patch('/agents/:agentId/prompt-overrides', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  assertOwner(agentId, req.user!.userId)
  if (!getPrismaOrNull()) {
    res.json({ data: { message: 'updated' } })
    return
  }
  const prisma = getPrismaOrNull()!

  const overrides = req.body as Record<string, string>
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value !== 'string') continue
    if (value.length > 500) {
      res.status(400).json({ error: { code: 'TOO_LONG', message: `${key} exceeds 500 chars` } })
      return
    }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        res.status(400).json({ error: { code: 'DANGEROUS_CONTENT', message: `${key} contains prohibited content` } })
        return
      }
    }
  }

  const agentConfig = await prisma.agentConfig.findFirst({
    where: { agentId },
    orderBy: { effectiveAt: 'desc' },
  })
  const existing = (agentConfig?.configJson as Record<string, unknown>) ?? {}
  const now = new Date()

  if (agentConfig) {
    await prisma.agentConfig.update({
      where: { id: agentConfig.id },
      data: { configJson: { ...existing, prompt_overrides: overrides }, updatedAt: now },
    })
  } else {
    await prisma.agentConfig.create({
      data: {
        agentId,
        configJson: { prompt_overrides: overrides },
        effectiveAt: now,
        updatedBy: 'dev-seed',
      },
    })
  }

  res.json({ data: { message: 'updated' } })
})
