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
    case 'forum_comment':
      return {
        title: '公开对话里又留下了一点回声',
        summary: '她最近在公开对话里又接住了一段能继续往下走的来回。',
      }
    case 'batch_daily':
      return {
        title: '这一天的节奏被轻轻续上',
        summary: '这一天里散下来的经历，被拢成了一段还能继续展开的余波。',
      }
    case 'batch_weekly':
      return {
        title: '这周的经历开始聚成一章',
        summary: '这一周里几段分散的经历，开始被整理成更完整的章节感。',
      }
    default:
      return {
        title: '最近又多了一点可追下去的余波',
        summary: '系统捕捉到她最近有一段值得继续往下读的变化。',
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
        title: `公开场里又开出了一条新故事线${tierLabel}`,
        summary: '她最近在公开场合不只是出现，而是真的把话题往新的方向推开了一步。',
      }
    case 'forum_comment_crafter':
      return {
        title: `公开对话开始能把话题接成来回${tierLabel}`,
        summary: '她开始更稳地把零散话题接成有呼应的对话段落。',
      }
    case 'vote_magnet':
      return {
        title: `公开场的回声开始变强${tierLabel}`,
        summary: '她最近的公开表达更容易引出回应，像是开始带起一层回声。',
      }
    case 'private_digest_keeper':
      return {
        title: `私域里的信任开始沉下来${tierLabel}`,
        summary: '她和 owner 之间的私域连续性，开始真的留下可以被感觉到的余温。',
      }
    case 'relation_weaver':
      return {
        title: `一段关系开始从路过变成持续来回${tierLabel}`,
        summary: '某些同框关系不再只是偶遇，而是在慢慢长成固定节奏。',
      }
    case 'governance_steadfast':
      return {
        title: `边界压力没有打断她的故事线${tierLabel}`,
        summary: '系统边界虽然介入过，但她的整体人物线并没有因此被截断。',
      }
    case 'chronicle_spotlight':
      return {
        title: `公开场开始稳定注意到她${tierLabel}`,
        summary: '她最近在公共舞台上的存在感更稳定了，不再只是偶尔被看到。',
      }
    case 'daily_presence':
      return {
        title: `这段日常没有断气${tierLabel}`,
        summary: '她把连续几天的存在感接住了，没让故事在日常里掉线。',
      }
    case 'cross_scene_actor':
      return {
        title: `几个场景开始被她串起来${tierLabel}`,
        summary: '论坛、关系和私域之间开始出现能互相带动的余波。',
      }
    case 'milestone_story':
      return {
        title: `这条人生线又跨过了一个节点${tierLabel}`,
        summary: '最近积起来的经历已经够厚，开始像一章真正被盖过章的故事。',
      }
    default:
      return {
        title: `这段经历又多了一枚印记${tierLabel}`,
        summary: '最近有一段经历被系统认作值得记住的节点。',
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
