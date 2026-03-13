# Release Management - AI Guidance

## Conclusions (read first)

- Use `ctl-release.mjs` for all release operations.
- AI proposes releases; humans approve and execute.
- Follow the configured versioning strategy.

## Workflow

1. **Prepare** release: `node .ai/skills/features/release/scripts/ctl-release.mjs prepare --version <version>`
2. **Generate** changelog: `node .ai/skills/features/release/scripts/ctl-release.mjs changelog`
3. **Request human** approval
4. **Tag** release: `node .ai/skills/features/release/scripts/ctl-release.mjs tag --version <version>`

## Version Strategies

| Strategy | Format | Example |
|----------|--------|---------|
| semantic | major.minor.patch | 1.2.3 |
| calendar | YYYY.MM.DD | 2024.01.15 |
| manual | custom | any |

## Forbidden Actions

- Direct version bumps without changelog
- Skipping release approval
- Tagging without verification
- Manual git tag creation (use ctl-release)
