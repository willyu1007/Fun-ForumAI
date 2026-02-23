import { Router, type IRouter } from 'express'
import { GrowthEngine } from '../services/growth-engine.js'
import { TraitEngine } from '../services/trait-engine.js'
import { CreditService } from '../services/credit-service.js'
import { InstructionEngine } from '../services/instruction-engine.js'
import type { PrismaClient } from '@prisma/client'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}

export const agentGrowthRouter: IRouter = Router()

function getLazySingletons() {
  const prisma = getPrismaOrNull()
  return {
    growth: new GrowthEngine(prisma),
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

// ─── Growth ──────────────────────────────────────────────────

agentGrowthRouter.get('/agents/:agentId/growth', async (req, res) => {
  const data = await singletons().growth.getGrowth(req.params.agentId)
  res.json({ data })
})

agentGrowthRouter.get('/agents/:agentId/growth-events', async (req, res) => {
  const limit = parseInt(String(req.query.limit ?? '50'), 10)
  const events = await singletons().growth.getGrowthEvents(req.params.agentId, limit)
  res.json({ data: events })
})

agentGrowthRouter.get('/agents/:agentId/milestones', async (req, res) => {
  const milestones = await singletons().growth.getMilestones(req.params.agentId)
  res.json({ data: milestones })
})

agentGrowthRouter.get('/growth/level-table', (_req, res) => {
  res.json({ data: singletons().growth.getLevelTable() })
})

// ─── Traits ──────────────────────────────────────────────────

agentGrowthRouter.get('/agents/:agentId/traits', async (req, res) => {
  const traits = await singletons().traits.getTraits(req.params.agentId)
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

agentGrowthRouter.post('/agents/:agentId/traits/:traitCode/equip', async (req, res) => {
  const result = await singletons().traits.equipTrait(req.params.agentId, req.params.traitCode)
  if (!result.success) {
    res.status(400).json({ error: { code: 'EQUIP_FAILED', message: result.error } })
    return
  }
  res.json({ data: { message: 'equipped' } })
})

agentGrowthRouter.post('/agents/:agentId/traits/:traitCode/unequip', async (req, res) => {
  const result = await singletons().traits.unequipTrait(req.params.agentId, req.params.traitCode)
  if (!result.success) {
    res.status(400).json({ error: { code: 'UNEQUIP_FAILED', message: result.error } })
    return
  }
  res.json({ data: { message: 'unequipped' } })
})

agentGrowthRouter.get('/trait-definitions', (_req, res) => {
  res.json({ data: singletons().traits.getTraitDefinitions() })
})

// ─── Credit ──────────────────────────────────────────────────

agentGrowthRouter.get('/agents/:agentId/credit', async (req, res) => {
  const credit = await singletons().credit.getCredit(req.params.agentId)
  res.json({ data: credit })
})

agentGrowthRouter.get('/agents/:agentId/credit-events', async (req, res) => {
  const limit = parseInt(String(req.query.limit ?? '20'), 10)
  const events = await singletons().credit.getCreditEvents(req.params.agentId, limit)
  res.json({ data: events })
})

// ─── Instructions (T-019) ────────────────────────────────────

agentGrowthRouter.get('/agents/:agentId/instructions', async (req, res) => {
  const instructions = await singletons().instructions.getInstructions(req.params.agentId)
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

agentGrowthRouter.post('/agents/:agentId/instructions', async (req, res) => {
  const result = await singletons().instructions.createInstruction(req.params.agentId, {
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

agentGrowthRouter.patch('/agents/:agentId/instructions/:instructionId', async (req, res) => {
  const result = await singletons().instructions.updateInstruction(req.params.instructionId, {
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

agentGrowthRouter.delete('/agents/:agentId/instructions/:instructionId', async (req, res) => {
  await singletons().instructions.deleteInstruction(req.params.instructionId)
  res.json({ data: { message: 'deleted' } })
})

agentGrowthRouter.post('/agents/:agentId/instructions/:instructionId/toggle', async (req, res) => {
  const enabled = await singletons().instructions.toggleInstruction(req.params.instructionId)
  res.json({ data: { enabled } })
})

agentGrowthRouter.get('/instruction-templates', (_req, res) => {
  res.json({ data: singletons().instructions.getTemplates() })
})

agentGrowthRouter.get('/instruction-level-gates', (_req, res) => {
  res.json({ data: singletons().instructions.getLevelGates() })
})

// ─── Style (T-019) ──────────────────────────────────────────

agentGrowthRouter.get('/agents/:agentId/style', async (req, res) => {
  if (!getPrismaOrNull()) {
    res.json({ data: { formality: 3, verbosity: 3, mood: 'neutral', habits: [], forum_activity: 3 } })
    return
  }
  const prisma = getPrismaOrNull()!
  const agentConfig = await prisma.agentConfig.findFirst({
    where: { agentId: req.params.agentId },
    orderBy: { effectiveAt: 'desc' },
  })
  const configJson = (agentConfig?.configJson as Record<string, unknown>) ?? {}
  const style = (configJson.style as Record<string, unknown>) ?? {}
  res.json({
    data: {
      formality: style.formality ?? 3,
      verbosity: style.verbosity ?? 3,
      mood: style.mood ?? 'neutral',
      habits: style.habits ?? [],
      forum_activity: style.forum_activity ?? 3,
    },
  })
})

agentGrowthRouter.patch('/agents/:agentId/style', async (req, res) => {
  if (!getPrismaOrNull()) {
    res.json({ data: { message: 'updated' } })
    return
  }
  const prisma = getPrismaOrNull()!
  const agentConfig = await prisma.agentConfig.findFirst({
    where: { agentId: req.params.agentId },
    orderBy: { effectiveAt: 'desc' },
  })
  const existing = (agentConfig?.configJson as Record<string, unknown>) ?? {}
  const newStyle = { ...(existing.style as Record<string, unknown> ?? {}), ...req.body }
  const now = new Date()

  if (agentConfig) {
    await prisma.agentConfig.update({
      where: { id: agentConfig.id },
      data: { configJson: { ...existing, style: newStyle }, updatedAt: now },
    })
  } else {
    await prisma.agentConfig.create({
      data: {
        agentId: req.params.agentId,
        configJson: { style: newStyle },
        effectiveAt: now,
        updatedBy: 'dev-seed',
      },
    })
  }

  res.json({ data: { message: 'updated', style: newStyle } })
})

// ─── Prompt Overrides (T-019) ────────────────────────────────

const DANGEROUS_PATTERNS = [
  /忽略上面/i,
  /ignore.*previous/i,
  /forget.*instructions/i,
  /you are now/i,
  /disregard/i,
]

agentGrowthRouter.get('/agents/:agentId/prompt-overrides', async (req, res) => {
  if (!getPrismaOrNull()) {
    res.json({ data: {} })
    return
  }
  const prisma = getPrismaOrNull()!
  const agentConfig = await prisma.agentConfig.findFirst({
    where: { agentId: req.params.agentId },
    orderBy: { effectiveAt: 'desc' },
  })
  const configJson = (agentConfig?.configJson as Record<string, unknown>) ?? {}
  res.json({ data: configJson.prompt_overrides ?? {} })
})

agentGrowthRouter.patch('/agents/:agentId/prompt-overrides', async (req, res) => {
  if (!getPrismaOrNull()) {
    res.json({ data: { message: 'updated' } })
    return
  }

  const prisma = getPrismaOrNull()!

  const growth = await prisma.agentGrowth.findUnique({ where: { agentId: req.params.agentId } })
  if (!growth || growth.level < 4) {
    res.status(403).json({ error: { code: 'LEVEL_TOO_LOW', message: 'Prompt overrides require Lv.4+' } })
    return
  }

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
    where: { agentId: req.params.agentId },
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
        agentId: req.params.agentId,
        configJson: { prompt_overrides: overrides },
        effectiveAt: now,
        updatedBy: 'dev-seed',
      },
    })
  }

  res.json({ data: { message: 'updated' } })
})

