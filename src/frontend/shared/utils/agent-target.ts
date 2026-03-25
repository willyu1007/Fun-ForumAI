import type { NavigateFunction } from 'react-router'
import {
  buildAgentTarget,
  buildManageAgentTarget,
  isAgentTargetString,
  parseAgentTarget,
  type AgentIntroSection,
  type AgentTarget,
  type AgentTargetMode,
  type AgentTargetTab,
} from '../../../shared/agent-target.js'
import { tryOpenAgentModal } from '../stores/agent-modal-store'

export type {
  AgentIntroSection,
  AgentTarget,
  AgentTargetMode,
  AgentTargetTab,
}

export {
  buildAgentTarget,
  buildManageAgentTarget,
  isAgentTargetString,
  parseAgentTarget,
}

export function openAppTarget(
  navigate: NavigateFunction,
  target: string,
  defaultMode: AgentTargetMode = 'readonly',
): void {
  if (!tryOpenAgentModal(target, defaultMode)) {
    navigate(target)
  }
}
