# Pitfalls

## Do Not Repeat Yet

- Symptom:
  - Live Qwen private-chat replies could still persist strings like `[微微点头]（双手交叉放在身前）...` even though prompt templates explicitly banned bracket actions and stage directions.
- Root cause:
  - `PrivateChannelService.generatePrivateReply()` and `ProactiveInteractionService.generateOpeningMessage()` passed raw `llmResponse.content` into policy evaluation and persistence. The visible-text sanitizer existed, but these two user-facing paths never called it.
- What was tried:
  - Reproduced on local-kind with real DashScope credentials and a verified seeded user.
  - Confirmed prompt constraints were present in `.ai/llm-config/registry/prompt_templates.yaml`, so the failure was in runtime wiring rather than prompt text.
- Fix:
  - Added `sanitizeChatOutput()` + readability formatting inside both services before policy evaluation and before final user-visible persistence.
  - Added service-level regressions that feed action-laden strings like `[挥手]（看向你）...` and assert the stored output is plain正文 only.
- Prevention note:
  - For any visible LLM surface, prompt bans are not enough. The output normalization step must live in the final persistence/delivery path, and every new visible text channel should get a regression that injects bracketed action text and verifies the saved result is sanitized.
