import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  CreateAgentMemoryInput,
  UpsertPrivacySettingsInput,
  PaginatedResult,
  PaginationOpts,
  MemorySource,
} from './types.js'

export interface MemoryRepository {
  createMemory(input: CreateAgentMemoryInput): Promise<AgentMemory>
  findMemoryById(id: string): Promise<AgentMemory | null>
  listMemories(
    agentId: string,
    opts: PaginationOpts & {
      source_type?: MemorySource
      forgotten?: boolean
    },
  ): Promise<PaginatedResult<AgentMemory>>
  findActiveMemories(
    agentId: string,
    opts: { maxImportance?: number },
  ): Promise<AgentMemory[]>
  updateImportanceScore(id: string, score: number): Promise<void>
  markForgotten(id: string): Promise<void>
  incrementAccessCount(ids: string[]): Promise<void>
  batchDecay(agentId: string, factor: number): Promise<number>

  getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity | null>
  upsertPrivacySettings(
    input: UpsertPrivacySettingsInput,
  ): Promise<AgentPrivacySettingsEntity>
}
