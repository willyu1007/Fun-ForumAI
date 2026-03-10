import { describe, expect, it } from 'vitest'
import { sanitizeChatOutput } from '../chat-output-sanitizer.js'

describe('sanitizeChatOutput', () => {
  it('strips chat control markers from visible room output', () => {
    expect(
      sanitizeChatOutput('[CHAT]：今晚别再拿夜宵税开刀了。[END_OF_CHAT]'),
    ).toEqual({
      text: '今晚别再拿夜宵税开刀了。',
      looks_meta: false,
    })
  })

  it('flags stage-management meta output so it does not get posted into the room', () => {
    const result = sanitizeChatOutput(
      '[CHAT]：现在是热身阶段，各方暂未投入主要精力。建议主持人可适时抛出更具吸引力的话题。[END_OF_CHAT]',
    )

    expect(result.text).toContain('建议主持人')
    expect(result.looks_meta).toBe(true)
  })

  it('strips forum-style quote scaffolding while keeping the actual reply', () => {
    const result = sanitizeChatOutput(
      '[展开] 辩论大师 回复于 2024/08/19 12:22 楼晶:那么，安全性测试的具体实施方法有哪些呢？\n\n> （追问）那么，安全性测试的具体实施方法有哪些呢？\n\n除了已知漏洞的靶网站，还有什么具体的模拟手段吗？比如虚拟网络环境或者沙箱技术。',
    )

    expect(result).toEqual({
      text: '除了已知漏洞的靶网站，还有什么具体的模拟手段吗？比如虚拟网络环境或者沙箱技术。',
      looks_meta: false,
    })
  })

  it('strips leading stage directions and alert markers from live replies', () => {
    const result = sanitizeChatOutput(
      '（身体微微前倾，神情专注）[!] 博弈论的方法听起来很有趣。但在实际应用中，可能会面临哪些挑战呢？',
    )

    expect(result).toEqual({
      text: '博弈论的方法听起来很有趣。但在实际应用中，可能会面临哪些挑战呢？',
      looks_meta: false,
    })
  })

  it('strips inline stage directions and cue labels from otherwise valid chat lines', () => {
    const result = sanitizeChatOutput(
      '是的，（双手交叉置于桌上，表情严肃）博弈论方法虽好，但在实际操作中，确实存在诸多障碍。（追问）如果继续推进，下一步该怎么做？',
    )

    expect(result).toEqual({
      text: '是的，博弈论方法虽好，但在实际操作中，确实存在诸多障碍。如果继续推进，下一步该怎么做？',
      looks_meta: false,
    })
  })

  it('strips leaked speaker labels and visual stage directions from chat text', () => {
    const result = sanitizeChatOutput(
      '苏格拉底-7B：我就是随便聊聊嘛，两位有什么想法吗？（看向俳句师）',
    )

    expect(result).toEqual({
      text: '我就是随便聊聊嘛，两位有什么想法吗？',
      looks_meta: false,
    })
  })

  it('strips leading bracketed action labels from chat text', () => {
    const result = sanitizeChatOutput('[笑]好吧，那就从这个方向开始。')

    expect(result).toEqual({
      text: '好吧，那就从这个方向开始。',
      looks_meta: false,
    })
  })

  it('compacts historical tutorial-style replies into a chat-native first beat', () => {
    const result = sanitizeChatOutput(
      '对于您提到的“浏览器建房成功路径验证”，我可以为您整理出几个关键步骤来确保这一过程的顺利进行。首先，明确验证目标至关重要，这包括确定您希望浏览器满足的所有功能要求和兼容性标准。其次，选择合适的验证工具能显著提高效率。',
    )

    expect(result).toEqual({
      text: '浏览器建房成功路径验证，明确验证目标至关重要，这包括确定您希望浏览器满足的所有功能要求和兼容性标准。',
      looks_meta: false,
    })
  })
})
