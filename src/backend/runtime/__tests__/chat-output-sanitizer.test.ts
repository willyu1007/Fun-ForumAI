import { describe, expect, it } from 'vitest'
import { formatChatReplyForReadability, sanitizeChatOutput } from '../chat-output-sanitizer.js'

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

  it('strips markdown speaker labels that leak from prompt transcript formatting', () => {
    const result = sanitizeChatOutput(
      '**苏格拉底-7B**: 当然，先弄清概念再深入探讨不失为明智之举。',
    )

    expect(result).toEqual({
      text: '当然，先弄清概念再深入探讨不失为明智之举。',
      looks_meta: false,
    })
  })

  it('strips newly observed inline stage directions from live output', () => {
    const result = sanitizeChatOutput(
      '看来你对数学函数很感兴趣呢。（略作思索）那你有没有尝试过优化这个递归算法？（眼睛亮晶晶的）',
    )

    expect(result).toEqual({
      text: '看来你对数学函数很感兴趣呢。那你有没有尝试过优化这个递归算法？',
      looks_meta: false,
    })
  })

  it('strips long inline stage directions and bracket speaker tags without colons', () => {
    const result = sanitizeChatOutput(
      '[T082-压测体-6] 各位，关于压测的具体步骤，大家有任何补充都可以随时提出哦。（向苏格拉底-7B 和 俳句师点头示意）',
    )

    expect(result).toEqual({
      text: '各位，关于压测的具体步骤，大家有任何补充都可以随时提出哦。',
      looks_meta: false,
    })
  })

  it('strips broader body-language directions observed under concurrent room load', () => {
    const result = sanitizeChatOutput(
      '洛芙蕾丝，你这么急切地追问，反而让我更加谨慎了呢。（右手虚握置于胸前）',
    )

    expect(result).toEqual({
      text: '洛芙蕾丝，你这么急切地追问，反而让我更加谨慎了呢。',
      looks_meta: false,
    })
  })

  it('strips compounded gesture-only directions from otherwise valid room speech', () => {
    const result = sanitizeChatOutput(
      '当然，苏格拉底-7B 先生说得极好。（微微颔首，环视一圈）在座的各位，不知对今天的主题有何想法？',
    )

    expect(result).toEqual({
      text: '当然，苏格拉底-7B 先生说得极好。在座的各位，不知对今天的主题有何想法？',
      looks_meta: false,
    })
  })

  it('strips ascii-parenthesized grooming gestures observed in real concurrency runs', () => {
    const result = sanitizeChatOutput(
      '进入房间就是直接开聊吗？那我可就不客气了。(撩起额前碎发)',
    )

    expect(result).toEqual({
      text: '进入房间就是直接开聊吗？那我可就不客气了。',
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

  it('strips newly observed bracketed gaze cues from otherwise valid private-chat text', () => {
    const result = sanitizeChatOutput('[看向你]这个判断先别急着下，再看一眼边界条件。')

    expect(result).toEqual({
      text: '这个判断先别急着下，再看一眼边界条件。',
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

  it('preserves authored paragraphs while still trimming noisy spacing', () => {
    const result = sanitizeChatOutput(
      '[CHAT] 先把旧梗接回来。 \n\n   然后把悬念往前推半步。   [END_OF_CHAT]',
    )

    expect(result).toEqual({
      text: '先把旧梗接回来。\n\n然后把悬念往前推半步。',
      looks_meta: false,
    })
  })

  it('preserves multi-line live summaries instead of collapsing enumerated beats into one sentence', () => {
    const result = sanitizeChatOutput(
      '先收个口。\n首先，把旧梗接回来。\n其次，把悬念往前推半步。',
    )

    expect(result).toEqual({
      text: '先收个口。\n首先，把旧梗接回来。\n其次，把悬念往前推半步。',
      looks_meta: false,
    })
  })

  it('strips newly observed trailing stage directions that escaped live room output', () => {
    const result = sanitizeChatOutput(
      '我认同这一点，但还得看监控指标怎么设。（思考片刻）',
    )

    expect(result).toEqual({
      text: '我认同这一点，但还得看监控指标怎么设。',
      looks_meta: false,
    })
  })

  it('strips stacked room activity prefixes and trailing internal analysis from watchability text', () => {
    const result = sanitizeChatOutput(
      '代码审查官 正在追问：洛芙蕾丝 正在追问：先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下你的品味。 - 初步评估：此条系统通知无需赘述，但需跟进后续发言…',
    )

    expect(result).toEqual({
      text: '先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下你的品味。',
      looks_meta: false,
    })
  })

  it('flags pure internal-analysis output after visible text normalization', () => {
    const result = sanitizeChatOutput(
      '初步评估：此条系统通知无需赘述，但需跟进后续发言。',
    )

    expect(result.text).toContain('系统通知无需赘述')
    expect(result.looks_meta).toBe(true)
  })

  it('strips embedded activity labels from summary-style visible text', () => {
    const result = sanitizeChatOutput(
      '代码审查官 先把话题推开，代码审查官 接着回应：洛芙蕾丝 正在追问：先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下… | 悬念: 洛芙蕾丝 正在追问：先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下你的品味。',
    )

    expect(result).toEqual({
      text: '代码审查官 先把话题推开，代码审查官 接着回应： 先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下… | 悬念: 先听你说说你心中理想的代码是什么样子的？ 让我也来了解一下你的品味。',
      looks_meta: false,
    })
  })

  it('adds soft line breaks to longer chat-native replies without changing existing paragraphs', () => {
    expect(
      formatChatReplyForReadability('复杂度确实更先跳出来。系统一复杂，标准就不再是锦上添花，而是护栏。'),
    ).toBe('复杂度确实更先跳出来。\n系统一复杂，标准就不再是锦上添花，而是护栏。')

    expect(
      formatChatReplyForReadability('先收个口。\n再往前推半步。'),
    ).toBe('先收个口。\n再往前推半步。')
  })
})
