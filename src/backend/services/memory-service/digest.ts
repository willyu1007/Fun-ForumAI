export function buildTranscript(
  messages: Array<{ author_type: 'HUMAN' | 'AGENT'; content: string }>,
): string {
  return messages
    .map((message) => `${message.author_type === 'HUMAN' ? 'Owner' : 'Agent'}: ${message.content}`)
    .join('\n\n')
}

export function parseDigestResponse(content: string): {
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string
  importance_score: number
  parse_success: boolean
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return {
        summary_text: String(parsed.summary_text || content),
        topic_tags: Array.isArray(parsed.topic_tags)
          ? parsed.topic_tags.filter((item): item is string => typeof item === 'string')
          : [],
        key_facts: Array.isArray(parsed.key_facts)
          ? parsed.key_facts.filter((item): item is string => typeof item === 'string')
          : [],
        sentiment: String(parsed.sentiment || 'neutral'),
        importance_score:
          typeof parsed.importance_score === 'number'
            ? Math.min(1, Math.max(0, parsed.importance_score))
            : 0.5,
        parse_success: true,
      }
    }
  } catch {
    // JSON parse failed, fall back to plain text.
  }

  return {
    summary_text: content,
    topic_tags: [],
    key_facts: [],
    sentiment: 'neutral',
    importance_score: 0.5,
    parse_success: false,
  }
}
