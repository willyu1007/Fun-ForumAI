export function normalizeModelOutputText(content: string): string {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
}

export function isBlankModelOutputText(content: string): boolean {
  return content.trim().length === 0
}
