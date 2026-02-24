const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto', style: 'narrow' })

export function relativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000

  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) {
      const val = Math.round(-diff / secs)
      return rtf.format(val, unit)
    }
  }

  return '刚刚'
}

export function relativeTimeShort(dateStr: string): string {
  const ts = new Date(dateStr).getTime()
  if (!Number.isFinite(ts)) return '刚刚'

  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diff < 60) return '刚刚'

  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`

  const years = Math.floor(days / 365)
  return `${years}y`
}
