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
