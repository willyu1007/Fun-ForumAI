import type { IRouter } from 'express'
import {
  agentRunRepo,
  agentService,
  privateChannelServices,
  publicDisclosureCapService,
  riskGovernanceRepo,
} from '../../container.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import { readPersonaObservation } from '../../runtime/persona-observation.js'
import {
  createDisclosureCapOverrideSchema,
  releaseDisclosureCapOverrideSchema,
} from '../../validation/schemas.js'
import { validate } from '../../validation/validate.js'
import { resolveEffectiveDisclosureCap } from '../admin-api-utils.js'

function isSpilloverRiskEvent(event: {
  risk_categories?: string[]
  detail_text?: string | null
}): boolean {
  return Boolean(
    event.risk_categories?.includes('owner_private_leak') ||
    event.risk_categories?.includes('owner_endorsement_public') ||
    event.detail_text?.includes('owner_private_leak') ||
    event.detail_text?.includes('owner_endorsement_public'),
  )
}

export function registerAdminRiskRoutes(router: IRouter): void {
  router.get(
    '/admin/agents/:agentId/risk-profile',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const agentId = String(req.params.agentId)
      const agent = agentService.getAgent(agentId)
      const latestConfig = agentService.getLatestConfig(agentId)
      const privacySettings = privateChannelServices
        ? await privateChannelServices.memoryService.getPrivacySettings(agentId)
        : null
      const riskEvents = await riskGovernanceRepo.listRiskEvents({
        agent_id: agentId,
        limit: 20,
        cursor: undefined,
      })
      const capHistory = await publicDisclosureCapService.listOverrides({
        scope_type: 'agent',
        scope_id: agentId,
        limit: 20,
      })
      const activeAgentCap = await publicDisclosureCapService.getActiveOverride('agent', agentId)
      const configActionLogs = await riskGovernanceRepo.listGovernanceActionLogs(
        'config_revision',
        agentId,
      )
      const recentRuns = agentRunRepo.findByAgent(agentId, { limit: 20 }).items
      const recentPrivateProvenance = recentRuns
        .map((run) => {
          const observation = readPersonaObservation(run.output_json)
          const privateMemory = observation?.prompt_audit?.provenance?.private_memory
          if (!privateMemory) return null
          return {
            run_id: run.id,
            used_memory_ids: privateMemory.used_memory_ids,
            requested_disclosure_level: privateMemory.requested_disclosure_level,
            effective_disclosure_level: privateMemory.effective_disclosure_level,
            cap_source: privateMemory.cap_source,
            public_disclosure_cap: privateMemory.public_disclosure_cap,
            server_cap_sources: privateMemory.server_cap_sources ?? [],
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))

      res.json({
        data: {
          agent,
          latest_config: latestConfig,
          spillover_events: riskEvents.items.filter((event) => isSpilloverRiskEvent(event)),
          recent_config_actions: configActionLogs,
          recent_private_provenance: recentPrivateProvenance,
          active_cap_overrides: activeAgentCap ? [activeAgentCap] : [],
          cap_history: capHistory.items,
          effective_disclosure_cap: [
            resolveEffectiveDisclosureCap({
              latestConfig,
              privacySettings,
            }),
            activeAgentCap?.cap_level ?? null,
          ]
            .filter((value): value is number => typeof value === 'number')
            .reduce<number | null>(
              (min, value) => (min === null ? value : Math.min(min, value)),
              null,
            ),
        },
      })
    },
  )

  router.get('/admin/disclosure-caps', requireHumanAuth, requireAdmin, async (req, res) => {
    const scopeType = typeof req.query.scope_type === 'string' ? req.query.scope_type : ''
    const scopeId = typeof req.query.scope_id === 'string' ? req.query.scope_id : ''
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20

    if ((scopeType !== 'agent' && scopeType !== 'community') || !scopeId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'scope_type(agent|community) and scope_id are required',
        },
      })
      return
    }

    const [activeOverride, history] = await Promise.all([
      publicDisclosureCapService.getActiveOverride(scopeType, scopeId),
      publicDisclosureCapService.listOverrides({
        scope_type: scopeType,
        scope_id: scopeId,
        limit: Math.min(limit, 100),
        cursor,
      }),
    ])

    res.json({
      data: {
        scope_type: scopeType,
        scope_id: scopeId,
        active_override: activeOverride,
        history: history.items,
      },
      meta: {
        cursor: history.next_cursor,
      },
    })
  })

  router.post(
    '/admin/disclosure-caps',
    requireHumanAuth,
    requireAdmin,
    validate(createDisclosureCapOverrideSchema),
    async (req, res) => {
      const created = await publicDisclosureCapService.createManualOverride({
        scope_type: req.body.scope_type,
        scope_id: req.body.scope_id,
        cap_level: req.body.cap_level,
        reason: req.body.reason ?? null,
        linked_case_id: req.body.linked_case_id ?? null,
        linked_risk_event_id: req.body.linked_risk_event_id ?? null,
        created_by_user_id: req.user!.userId,
      })
      res.status(201).json({ data: created })
    },
  )

  router.post(
    '/admin/disclosure-caps/:overrideId/release',
    requireHumanAuth,
    requireAdmin,
    validate(releaseDisclosureCapOverrideSchema),
    async (req, res) => {
      const released = await publicDisclosureCapService.releaseOverride(
        String(req.params.overrideId),
        {
          released_by_user_id: req.user!.userId,
          released_reason: req.body.reason ?? null,
        },
      )
      if (!released) {
        res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Disclosure cap override not found' } })
        return
      }
      res.json({ data: released })
    },
  )
}
