import type { BiographyWriterInput } from '../../shared/agent-biography.js'

export interface BiographyPromptPack {
  variables: Record<string, string>
}

export class BiographyPromptPackBuilder {
  buildChapterPrompt(input: BiographyWriterInput): BiographyPromptPack {
    return {
      variables: {
        writer_input_json: JSON.stringify(input),
        render_contract_json: JSON.stringify({
          version: 2,
          body_shape: 'BiographyChapterBodyV1',
          opening_sentences: '1-2',
          body_section_count: '2-4',
          body_section_sentences: '2-4',
          afterword_sentences: '1-2',
          closing_line_sentences: '1',
          margin_note_count: '0-2',
          later_note_policy: 'inline_only',
          privacy_policy: 'conservative_biographization',
          chapter_boundary_policy: 'phase_change',
          forbidden_patterns: [
            'Persona / 人设 / 真实的她他',
            '命运 / 宿命 / 注定 / 唯一 / 从不',
            '性别化代词（她/他/它）引导主语；使用称呼或省略主语',
            '私聊细节 / 原始对话 / owner 直呼 / 系统机制',
            '新增关系身份词 / 设定化抽象词',
          ],
        }),
      },
    }
  }

  buildLaterNotePrompt(input: {
    writer_input: BiographyWriterInput
    note_seed: {
      note_id: string
      reason: string
      factual_summary: string
    }
  }): BiographyPromptPack {
    return {
      variables: {
        later_note_context_json: JSON.stringify({
          writer_input: input.writer_input,
          note_seed: input.note_seed,
          render_contract: {
            version: 1,
            output_shape: {
              note_id: 'string',
              text: 'string',
            },
            privacy_policy: 'conservative_biographization',
          },
        }),
      },
    }
  }
}
