import type { ComponentType } from 'react'

interface DevKickoffPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const devKickoffPanelModulePath =
  '../../../../.ai/.tmp/kickoff-local/src/frontend/widgets/dev/DevKickoffPanel.js'

const { DevKickoffPanel } = await import(devKickoffPanelModulePath) as {
  DevKickoffPanel: ComponentType<DevKickoffPanelProps>
}

export { DevKickoffPanel }
