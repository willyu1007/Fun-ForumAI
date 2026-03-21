export function getInitials(value: string, max = 2) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .slice(0, max)
    .toUpperCase()
}
