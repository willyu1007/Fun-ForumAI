const SENSITIVE_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /authorization/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /cookie/i,
  /session[_-]?id/i,
  /raw[_-]?prompt/i,
  /raw[_-]?completion/i,
  /raw[_-]?content/i,
  /prompt[_-]?text/i,
  /completion[_-]?text/i,
  /message[_-]?text/i,
  /private[_-]?message/i,
]

const FREEFORM_REDACTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp
  replacement: string
}> = [
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: 'Bearer [redacted]',
  },
  {
    pattern: /\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g,
    replacement: '[redacted]',
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: '[redacted]',
  },
  {
    pattern: /\b(postgres(?:ql)?|mysql|redis):\/\/[^@\s]+@/gi,
    replacement: '$1://[redacted]@',
  },
  {
    pattern:
      /\b(token|secret|password|credential|authorization|api[_-]?key|access[_-]?key|private[_-]?key|cookie)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;}\]]+)/gi,
    replacement: '$1=[redacted]',
  },
  {
    pattern:
      /\b(raw[_ -]?prompt|raw[_ -]?completion|raw[_ -]?content|prompt[_ -]?text|completion[_ -]?text|message[_ -]?text|private[_ -]?message)\s*[:=]\s*("[^"]*"|'[^']*'|[^\n\r]+)/gi,
    replacement: '$1=[redacted]',
  },
]

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export function redactSensitiveText(value: string): string {
  return FREEFORM_REDACTION_PATTERNS.reduce(
    (current, entry) => current.replace(entry.pattern, entry.replacement),
    value,
  )
}
