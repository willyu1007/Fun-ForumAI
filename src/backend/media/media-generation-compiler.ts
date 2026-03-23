import type {
  AspectRatioHint,
  CompiledMediaPrompt,
  MediaGenerationSpec,
} from '../repos/types.js'

function cleanLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function nonEmpty(values: Array<string | null | undefined>): string[] {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(cleanLine)
}

export function compileMediaGenerationSpec(input: {
  spec: MediaGenerationSpec
  style_hint?: string | null
}): CompiledMediaPrompt {
  const renderedSections = [
    `intent: ${input.spec.intent}`,
    input.spec.subject_anchors.length > 0
      ? `subject_anchors: ${input.spec.subject_anchors.join(' | ')}`
      : null,
    input.spec.scene_constraints.length > 0
      ? `scene_constraints: ${input.spec.scene_constraints.join(' | ')}`
      : null,
    input.spec.style_constraints.length > 0
      ? `style_constraints: ${input.spec.style_constraints.join(' | ')}`
      : null,
    input.style_hint?.trim()
      ? `style_hint: ${cleanLine(input.style_hint)}`
      : null,
    input.spec.negative_constraints.length > 0
      ? `negative_constraints: ${input.spec.negative_constraints.join(' | ')}`
      : null,
    `output_policy: aspect_ratio=${input.spec.output_policy.aspect_ratio_hint ?? '4:5'}; public_safe_only=${input.spec.output_policy.public_safe_only ? 'true' : 'false'}; derivative_display_only=${input.spec.output_policy.derivative_display_only ? 'true' : 'false'}`,
  ]

  return {
    schema_version: 'compiled-media-prompt.v1',
    template_id: 'media-generation-compiler',
    rendered_prompt: nonEmpty(renderedSections).join('\n'),
    sections: {
      intent: cleanLine(input.spec.intent),
      subject: [...input.spec.subject_anchors],
      scene: [...input.spec.scene_constraints],
      style: nonEmpty([
        ...input.spec.style_constraints,
        input.style_hint ?? null,
      ]),
      negative: [...input.spec.negative_constraints],
    },
    style_hint: input.style_hint?.trim() ? cleanLine(input.style_hint) : null,
    aspect_ratio_hint: input.spec.output_policy.aspect_ratio_hint,
  }
}

export function buildLegacyGenerationSpec(input: {
  prompt_brief?: string | null
  input_mode?: 'reference' | 'scratch'
  aspect_ratio_hint?: AspectRatioHint | null
  based_on_projection_ids?: string[]
}): MediaGenerationSpec {
  const lines = (input.prompt_brief ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const sceneConstraints = lines
    .filter((line) => line.startsWith('scene=') || line.startsWith('caption=') || line.startsWith('objective='))
    .map((line) => line.replace(/^[^=]+=/, '').trim())

  const styleConstraints = lines
    .filter((line) => line.startsWith('style_hint=') || line.startsWith('tone='))
    .map((line) => line.replace(/^[^=]+=/, '').trim())

  const negativeConstraints = lines
    .filter((line) => line.startsWith('privacy_guard=') || line.startsWith('forbidden_elements='))
    .map((line) => line.replace(/^[^=]+=/, '').trim())

  const subjectAnchors = lines
    .filter((line) =>
      line.startsWith('visual_role=')
      || line.startsWith('human_goal=')
      || line.startsWith('hook=')
      || line.startsWith('theme=')
      || line.startsWith('salient_entities='),
    )
    .map((line) => line.replace(/^[^=]+=/, '').trim())

  return {
    intent: input.input_mode === 'scratch' ? 'scratch_scene' : 'reference_derive',
    subject_anchors: nonEmpty(subjectAnchors),
    scene_constraints: nonEmpty(sceneConstraints),
    style_constraints: nonEmpty(styleConstraints),
    negative_constraints: nonEmpty(negativeConstraints),
    source_projections: [...(input.based_on_projection_ids ?? [])],
    output_policy: {
      aspect_ratio_hint: input.aspect_ratio_hint ?? null,
      public_safe_only: true,
      derivative_display_only: input.input_mode !== 'scratch',
    },
  }
}
