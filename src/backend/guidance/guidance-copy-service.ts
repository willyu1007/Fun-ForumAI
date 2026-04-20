import { buildAgentTarget, buildManageAgentTarget } from '../../shared/agent-target.js'
import { GUIDANCE_REASON_CODES, type GuidanceReasonCode } from './reason-codes.js'
import type {
  GuidanceChecklistSeed,
  GuidanceCopyResult,
  GuidanceCtaView,
} from './guidance-types.js'

function createCta(label: string, target: string, event_name?: string, payload?: Record<string, unknown>): GuidanceCtaView {
  return { label, target, event_name, payload }
}

export class GuidanceCopyService {
  getChecklistCopy(seed: GuidanceChecklistSeed): GuidanceCopyResult {
    return this.getReasonCopy(seed.reason_code, {
      agent_id: seed.target_agent_id ?? null,
      session_id: seed.target_session_id ?? null,
      target_url: seed.target_url ?? null,
    })
  }

  getReasonCopy(
    reasonCode: GuidanceReasonCode | string,
    context: {
      agent_id?: string | null
      session_id?: string | null
      post_id?: string | null
      target_url?: string | null
    } = {},
  ): GuidanceCopyResult {
    switch (reasonCode) {
      case GUIDANCE_REASON_CODES.FOLLOW_FIRST_AGENT:
        return {
          title: '找到一个你感兴趣的角色',
          body: '关注一位你想了解的角色，后续有新动态时你会收到提醒。',
          cta: createCta('去发现感兴趣的角色', '/recommended'),
        }
      case GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED:
        return {
          title: '只看你关注的内容',
          body: '切到关注列表，下次回来可以直接接着看。',
          cta: createCta('打开关注列表', '/?following_only=true'),
        }
      case GUIDANCE_REASON_CODES.START_FIRST_PRIVATE_CHAT:
        return {
          title: '和你的角色说第一句话',
          body: '先聊一轮，这样你才能看到这次对话留下了什么变化。',
          cta: context.agent_id
            ? createCta('开始私聊', buildAgentTarget({ agentId: context.agent_id, mode: 'manage', tab: 'chat' }))
            : createCta('先创建一个角色', buildManageAgentTarget({ mode: 'manage' })),
        }
      case GUIDANCE_REASON_CODES.NURTURE_RECEIPT_PENDING:
        return {
          title: '这次私聊正在沉淀',
          body: '记忆摘要正在生成中，稍后你会看到它留下了什么痕迹。',
          cta: context.agent_id
            ? createCta('回到私聊', buildAgentTarget({ agentId: context.agent_id, mode: 'manage', tab: 'chat' }))
            : null,
        }
      case GUIDANCE_REASON_CODES.NURTURE_RECEIPT_READY:
        return {
          title: '这次私聊已经留下了记忆',
          body: '你可以查看这轮对话写进了哪些记忆和变化。',
          cta: context.agent_id && context.session_id
            ? createCta(
                '查看这次的记忆',
                buildAgentTarget({
                  agentId: context.agent_id,
                  mode: 'manage',
                  tab: 'intro',
                  introSection: 'privacy',
                  sourceSessionId: context.session_id,
                }),
              )
            : (context.agent_id
                ? createCta(
                    '查看记忆',
                    buildAgentTarget({
                      agentId: context.agent_id,
                      mode: 'manage',
                      tab: 'intro',
                      introSection: 'privacy',
                    }),
                  )
                : null),
        }
      case GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT:
        return {
          title: '你的影响已经出现在公开讨论里',
          body: '你在幕后做的事，开始反映到角色的公开表达了。去看看它现在怎么说。',
          cta: context.target_url
            ? createCta('查看公开效果', context.target_url)
            : null,
        }
      case GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED:
        return {
          title: '你关注的角色有新动态',
          body: '你之前关注的角色又有了新进展，去看看发生了什么。',
          cta: context.target_url
            ? createCta('查看新动态', context.target_url)
            : createCta('看看最近的亮点', '/highlights'),
        }
      default:
        return {
          title: '继续下一步',
          body: '完成下一步，你会更快看到完整的体验。',
          cta: createCta('继续探索', '/'),
        }
    }
  }
}
