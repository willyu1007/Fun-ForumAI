const AGENT_PRESET_SOURCES = [
  '/agent-avatars/anime-chaotic-01.webp',
  '/agent-avatars/caregiver-01.webp',
  '/agent-avatars/chaotic-01.webp',
  '/agent-avatars/cinematic-caregiver-01.webp',
  '/agent-avatars/cinematic-chaotic-01.webp',
  '/agent-avatars/cinematic-commander-01.webp',
  '/agent-avatars/cinematic-intellectual-01.webp',
  '/agent-avatars/cinematic-mystic-01.webp',
  '/agent-avatars/cinematic-rebel-01.webp',
  '/agent-avatars/commander-01.webp',
  '/agent-avatars/illust-caregiver-01.webp',
  '/agent-avatars/illust-commander-01.webp',
  '/agent-avatars/illust-intellectual-01.webp',
  '/agent-avatars/illust-mystic-01.webp',
  '/agent-avatars/illust-rebel-01.webp',
  '/agent-avatars/intellectual-01.webp',
  '/agent-avatars/minimal-caregiver-01.webp',
  '/agent-avatars/minimal-chaotic-01.webp',
  '/agent-avatars/minimal-commander-01.webp',
  '/agent-avatars/minimal-intellectual-01.webp',
  '/agent-avatars/minimal-mystic-01.webp',
  '/agent-avatars/minimal-rebel-01.webp',
  '/agent-avatars/mystic-01.webp',
  '/agent-avatars/rebel-01.webp',
] as const

const USER_PRESET_SOURCES = [
  '/user-avatars/avatar-alien.webp',
  '/user-avatars/avatar-angel.webp',
  '/user-avatars/avatar-angry.webp',
  '/user-avatars/avatar-artist.webp',
  '/user-avatars/avatar-astronaut.webp',
  '/user-avatars/avatar-base-b.webp',
  '/user-avatars/avatar-capybara.webp',
  '/user-avatars/avatar-cat.webp',
  '/user-avatars/avatar-chill.webp',
  '/user-avatars/avatar-devil.webp',
  '/user-avatars/avatar-dog.webp',
  '/user-avatars/avatar-gamer.webp',
  '/user-avatars/avatar-geek.webp',
  '/user-avatars/avatar-happy.webp',
  '/user-avatars/avatar-melon.webp',
  '/user-avatars/avatar-music.webp',
  '/user-avatars/avatar-ninja.webp',
  '/user-avatars/avatar-shy-box.webp',
  '/user-avatars/avatar-skater.webp',
  '/user-avatars/avatar-wizard.webp',
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
