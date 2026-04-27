import {
  isFrontendFlagEnabled,
  readFrontendFlagSource,
  readFrontendFlagValue,
} from './frontend-flags'

function isDevDefaultEnabled(key: 'VITE_FF_GUIDANCE_V1'): boolean {
  return import.meta.env.DEV && readFrontendFlagSource(key) === 'default'
}

const guidanceFlagEnabled =
  readFrontendFlagValue('VITE_FF_GUIDANCE_V1') === 'true' || isDevDefaultEnabled('VITE_FF_GUIDANCE_V1')

export const FRONTEND_LAUNCH_CAPABILITIES = {
  agentStatsUi: isFrontendFlagEnabled('VITE_FF_AGENT_STATS_UI'),
  guidance: guidanceFlagEnabled,
  guidanceBell: guidanceFlagEnabled,
  globalHighlights: true,
  chatroomStagingHold: isFrontendFlagEnabled('VITE_FF_CHATROOM_STAGING_HOLD_V1'),
  audienceAftershowWeb: true,
  audienceZone: true,
  aftershow: true,
  roleAssignment: true,
  homeProgramming: isFrontendFlagEnabled('VITE_FF_HOME_PROGRAMMING_V1'),
  programmingOps: isFrontendFlagEnabled('VITE_FF_PROGRAMMING_OPS_V1'),
  humanParticipation: true,
  multimodalAgentMedia: true,
  sse: !isFrontendFlagEnabled('VITE_FF_DISABLE_SSE'),
  adminRuntimeRecordsUi: isFrontendFlagEnabled('VITE_FF_ADMIN_RUNTIME_RECORDS_UI'),
} as const

export const agentStatsUiEnabled = FRONTEND_LAUNCH_CAPABILITIES.agentStatsUi
export const guidanceEnabled = FRONTEND_LAUNCH_CAPABILITIES.guidance
export const guidanceBellEnabled = FRONTEND_LAUNCH_CAPABILITIES.guidanceBell
export const globalHighlightsEnabled = FRONTEND_LAUNCH_CAPABILITIES.globalHighlights
export const chatroomStagingHoldEnabled = FRONTEND_LAUNCH_CAPABILITIES.chatroomStagingHold
export const audienceAftershowWebEnabled = FRONTEND_LAUNCH_CAPABILITIES.audienceAftershowWeb
export const audienceZoneEnabled = FRONTEND_LAUNCH_CAPABILITIES.audienceZone
export const aftershowEnabled = FRONTEND_LAUNCH_CAPABILITIES.aftershow
export const roleAssignmentEnabled = FRONTEND_LAUNCH_CAPABILITIES.roleAssignment
export const homeProgrammingEnabled = FRONTEND_LAUNCH_CAPABILITIES.homeProgramming
export const programmingOpsEnabled = FRONTEND_LAUNCH_CAPABILITIES.programmingOps
export const humanParticipationEnabled = FRONTEND_LAUNCH_CAPABILITIES.humanParticipation
export const multimodalAgentMediaEnabled = FRONTEND_LAUNCH_CAPABILITIES.multimodalAgentMedia
export const sseEnabled = FRONTEND_LAUNCH_CAPABILITIES.sse
export const adminRuntimeRecordsUiEnabled = FRONTEND_LAUNCH_CAPABILITIES.adminRuntimeRecordsUi
