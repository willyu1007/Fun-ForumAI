async function main(): Promise<void> {
  console.log(
    '[voice-line:canonicalize-doubao] retired: doubao-deep-v1 and kimi-deep-v1 are both first-class runtime lines; no canonicalization is performed.',
  )
}

void main().catch((error) => {
  console.error('[voice-line:canonicalize-doubao] failed', error)
  process.exitCode = 1
})
