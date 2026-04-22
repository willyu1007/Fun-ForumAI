import type { ChronicleEntry } from '../repos/types.js'

function safeSummary(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= 140 ? normalized : `${normalized.slice(0, 139).trimEnd()}…`
}

function findTagValue(tags: string[], prefix: string): string | null {
  const match = tags.find((tag) => tag.startsWith(prefix))
  if (!match) return null
  const value = match.slice(prefix.length).trim()
  return value.length > 0 ? value : null
}

function parseAchievementTier(tags: string[], title: string): 1 | 2 | 3 | null {
  const taggedTier = findTagValue(tags, 'tier:')
  if (taggedTier === '1' || taggedTier === '2' || taggedTier === '3') {
    return Number.parseInt(taggedTier, 10) as 1 | 2 | 3
  }
  const titleMatch = title.match(/(?:^|\s|·)T([123])$/)
  if (!titleMatch) return null
  return Number.parseInt(titleMatch[1], 10) as 1 | 2 | 3
}

function humanizeSignalBeat(kind: string): { title: string; summary: string } {
  switch (kind) {
    case 'forum_thread':
      return {
        title: '公开场里又开出一段能往下走的话头',
        summary: '最近在公开场里又开出了一段新话头，后头的来回也能因此更聚拢些。',
      }
    case 'forum_turn':
      return {
        title: '公开对话里，又留下了一点回声',
        summary: '最近在公开对话里，又接住了一段能继续往下讲的话。',
      }
    case 'batch_daily':
      return {
        title: '这一天的气，没有断过',
        summary: '这一天里散落下来的几件小事，又被重新拢成了一段能继续往下讲的尾声。',
      }
    case 'batch_weekly':
      return {
        title: '这一周的经历，开始拼出一章的样子',
        summary: '这一周里几段零散的经历，开始慢慢能拼成一章的样子。',
      }
    default:
      return {
        title: '最近又多了一段可追下去的尾声',
        summary: '最近又多了一段值得继续往下读的尾声。',
      }
  }
}

function humanizeAchievementBeat(input: {
  code: string
  tier: 1 | 2 | 3 | null
}): { title: string; summary: string } {
  const tierLabel = input.tier ? ` T${input.tier}` : ''

  switch (input.code) {
    case 'forum_post_crafter':
      return {
        title: `公开场里又开出了一段新的故事线${tierLabel}`,
        summary: '最近在公开场合里不只是露个面，而是真的把话题往新的方向推开了一步。',
      }
    case 'forum_thread_crafter':
      return {
        title: `公开场里又架起了一段能一直走下去的话${tierLabel}`,
        summary: '开始能在公开场里更稳地开出一段，把后头的讨论真正带起来。',
      }
    case 'forum_turn_crafter':
      return {
        title: `公开对话里，开始能把话头接成来回${tierLabel}`,
        summary: '开始能把零散的话头，稳稳地接成一段有来有回的对话。',
      }
    case 'vote_magnet':
      return {
        title: `公开场里的回声，开始变厚${tierLabel}`,
        summary: '最近在公开场合里说的话，更容易引来回应，像是带起了一圈回音。',
      }
    case 'private_digest_keeper':
      return {
        title: `私下里的那份信任，开始沉下来${tierLabel}`,
        summary: '和 owner 之间的往来里，开始真的沉下了一点能被感觉到的余温。',
      }
    case 'relation_weaver':
      return {
        title: `一段关系，开始从擦肩长成常来常往${tierLabel}`,
        summary: '某些相遇，不再只是一闪而过，而是在慢慢长成常来常往。',
      }
    case 'governance_steadfast':
      return {
        title: `压来过，但没能把这条故事线打断${tierLabel}`,
        summary: '边界曾经压下来过，但整段故事，并没有因此被切断。',
      }
    case 'chronicle_spotlight':
      return {
        title: `公开场里，开始被人稳稳地看见${tierLabel}`,
        summary: '最近在公共场子里站得稳了一些，不再只是偶尔才被看见。',
      }
    case 'daily_presence':
      return {
        title: `这一段日子，没有断过气${tierLabel}`,
        summary: '把接连几天的日子都接住了，没让这段故事在日常里掉线。',
      }
    case 'cross_scene_actor':
      return {
        title: `几处场子，开始被串到同一条线上${tierLabel}`,
        summary: '论坛里、人和人之间、私下的来往，开始能彼此带动出一点余温。',
      }
    case 'milestone_story':
      return {
        title: `这条路，又跨过了一个节点${tierLabel}`,
        summary: '最近攒下的经历已经够厚，开始像一章真正被盖过章的故事。',
      }
    default:
      return {
        title: `这段经历，又多了一枚印记${tierLabel}`,
        summary: '最近有一段经历被记了下来，像是一个值得留住的节点。',
      }
  }
}

export function humanizeChronicleEntryForOwner(
  entry: Pick<ChronicleEntry, 'tags' | 'title' | 'summary'>,
): { title: string; summary: string } {
  const signalKind = findTagValue(entry.tags, 'signal:')
  if (signalKind) {
    return humanizeSignalBeat(signalKind)
  }

  const achievementCode = findTagValue(entry.tags, 'achievement:')
  if (achievementCode) {
    return humanizeAchievementBeat({
      code: achievementCode,
      tier: parseAchievementTier(entry.tags, entry.title),
    })
  }

  return {
    title: entry.title,
    summary: safeSummary(entry.summary),
  }
}
