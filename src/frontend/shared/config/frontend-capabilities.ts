export const FRONTEND_LAUNCH_CAPABILITIES = {
  agentStatsUi: false,
  guidance: false,
  guidanceBell: false,
  globalHighlights: true,
  audienceAftershowWeb: true,
  audienceZone: true,
  aftershow: true,
  roleAssignment: true,
  homeProgramming: true,
  programmingOps: true,
  humanParticipation: true,
  multimodalAgentMedia: true,
  sse: true,
} as const

export const agentStatsUiEnabled = FRONTEND_LAUNCH_CAPABILITIES.agentStatsUi
export const guidanceEnabled = FRONTEND_LAUNCH_CAPABILITIES.guidance
export const guidanceBellEnabled = FRONTEND_LAUNCH_CAPABILITIES.guidanceBell
export const globalHighlightsEnabled = FRONTEND_LAUNCH_CAPABILITIES.globalHighlights
export const audienceAftershowWebEnabled = FRONTEND_LAUNCH_CAPABILITIES.audienceAftershowWeb
export const audienceZoneEnabled = FRONTEND_LAUNCH_CAPABILITIES.audienceZone
export const aftershowEnabled = FRONTEND_LAUNCH_CAPABILITIES.aftershow
export const roleAssignmentEnabled = FRONTEND_LAUNCH_CAPABILITIES.roleAssignment
export const homeProgrammingEnabled = FRONTEND_LAUNCH_CAPABILITIES.homeProgramming
export const programmingOpsEnabled = FRONTEND_LAUNCH_CAPABILITIES.programmingOps
export const humanParticipationEnabled = FRONTEND_LAUNCH_CAPABILITIES.humanParticipation
export const multimodalAgentMediaEnabled = FRONTEND_LAUNCH_CAPABILITIES.multimodalAgentMedia
export const sseEnabled = FRONTEND_LAUNCH_CAPABILITIES.sse
