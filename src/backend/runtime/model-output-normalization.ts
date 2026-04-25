export function normalizeModelOutputText(content: string): string {
  const withoutControlCharacters = stripDisallowedControlCharacters(content)
  return withoutControlCharacters
    .replace(/^\uFEFF/, '')
    .replace(/\p{Cf}/gu, '')
}

function stripDisallowedControlCharacters(content: string): string {
  let output = ''
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const code = content.charCodeAt(index)
    if (code <= 0x08 || code === 0x0B || code === 0x0C || (code >= 0x0E && code <= 0x1F) || (code >= 0x7F && code <= 0x9F)) {
      continue
    }
    output += char
  }
  return output
}

export function isBlankModelOutputText(content: string): boolean {
  return content.trim().length === 0
}
