export type DevSeedProfile = 'canonical' | 'smoke-minimal' | 'launch'

export type DevSeedEntityType =
  | 'human_user'
  | 'community'
  | 'agent'
  | 'post'
  | 'thread'
  | 'room'

export interface DevSeedRegistryEntry {
  id: string
  profile: DevSeedProfile
  seed_key: string
  entity_type: DevSeedEntityType
  entity_id: string
  created_at: Date
  updated_at: Date
}

export interface UpsertDevSeedRegistryEntryInput {
  profile: DevSeedProfile
  seed_key: string
  entity_type: DevSeedEntityType
  entity_id: string
}
