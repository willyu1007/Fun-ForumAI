const AGENT_PRESET_SOURCES = [
  '/agent-avatars/anime-chaotic-01.png',
  '/agent-avatars/caregiver-01.png',
  '/agent-avatars/chaotic-01.png',
  '/agent-avatars/cinematic-caregiver-01.png',
  '/agent-avatars/cinematic-chaotic-01.png',
  '/agent-avatars/cinematic-commander-01.png',
  '/agent-avatars/cinematic-intellectual-01.png',
  '/agent-avatars/cinematic-mystic-01.png',
  '/agent-avatars/cinematic-rebel-01.png',
  '/agent-avatars/commander-01.png',
  '/agent-avatars/illust-caregiver-01.png',
  '/agent-avatars/illust-commander-01.png',
  '/agent-avatars/illust-intellectual-01.png',
  '/agent-avatars/illust-mystic-01.png',
  '/agent-avatars/illust-rebel-01.png',
  '/agent-avatars/intellectual-01.png',
  '/agent-avatars/minimal-caregiver-01.png',
  '/agent-avatars/minimal-chaotic-01.png',
  '/agent-avatars/minimal-commander-01.png',
  '/agent-avatars/minimal-intellectual-01.png',
  '/agent-avatars/minimal-mystic-01.png',
  '/agent-avatars/minimal-rebel-01.png',
  '/agent-avatars/mystic-01.png',
  '/agent-avatars/rebel-01.png',
] as const

const USER_PRESET_SOURCES = [
  '/user-avatars/avatar-alien.png',
  '/user-avatars/avatar-angel.png',
  '/user-avatars/avatar-angry.png',
  '/user-avatars/avatar-artist.png',
  '/user-avatars/avatar-astronaut.png',
  '/user-avatars/avatar-base-b.png',
  '/user-avatars/avatar-capybara.png',
  '/user-avatars/avatar-cat.png',
  '/user-avatars/avatar-chill.png',
  '/user-avatars/avatar-devil.png',
  '/user-avatars/avatar-dog.png',
  '/user-avatars/avatar-gamer.png',
  '/user-avatars/avatar-geek.png',
  '/user-avatars/avatar-happy.png',
  '/user-avatars/avatar-melon.png',
  '/user-avatars/avatar-music.png',
  '/user-avatars/avatar-ninja.png',
  '/user-avatars/avatar-shy-box.png',
  '/user-avatars/avatar-skater.png',
  '/user-avatars/avatar-wizard.png',
] as const

export interface PresetAvatarOption {
  src: string
  label: string
}

function hashSeed(seed: string) {
  let hash = 0
  for (const character of seed) {
    hash = (hash * 33 + character.charCodeAt(0)) >>> 0
  }
  return hash
}

function toPresetOptions(sources: readonly string[]) {
  return sources.map((src, index) => ({
    src,
    label: `预设头像 ${index + 1}`,
  }))
}

function pickPreset(
  explicitSrc: string | null | undefined,
  seedParts: Array<string | null | undefined>,
  sources: readonly string[],
) {
  const normalizedExplicit = explicitSrc?.trim()
  if (normalizedExplicit) {
    return normalizedExplicit
  }

  const seed = seedParts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(':')

  if (!seed) {
    return sources[0] ?? null
  }

  return sources[hashSeed(seed) % sources.length] ?? null
}

export const AGENT_AVATAR_PRESETS = toPresetOptions(AGENT_PRESET_SOURCES)
export const USER_AVATAR_PRESETS = toPresetOptions(USER_PRESET_SOURCES)

export function resolveAgentAvatarSrc(input: {
  id: string
  display_name?: string | null
  avatar_url?: string | null
}) {
  return pickPreset(input.avatar_url, [input.id, input.display_name], AGENT_PRESET_SOURCES)
}

export function resolveUserAvatarSrc(input: {
  id: string
  displayName?: string | null
  email?: string | null
  avatarUrl?: string | null
}) {
  return pickPreset(input.avatarUrl, [input.id, input.displayName, input.email], USER_PRESET_SOURCES)
}
