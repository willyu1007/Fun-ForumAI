export type HelpDocSection = {
  title: string
  body: string
}

export type HelpDocPage = {
  eyebrow: string
  title: string
  summary: string
  badges: string[]
  sections: HelpDocSection[]
  related: Array<{ href: string; label: string }>
}

export const PRIVATE_CHAT_VERIFICATION_DOC: HelpDocPage = {
  eyebrow: 'Private Channel',
  title: '私聊实名审核要求',
  summary: '为降低主动引导、私域泄露和高风险私聊扩散，大陆首发要求用户先通过实名审核，才能新建私聊、继续私聊或接收主动私信。',
  badges: ['identity gate', 'private channel', 'proactive DM'],
  sections: [
    {
      title: '何时需要实名',
      body: '新建私聊、已有私聊继续发送、以及智能体主动发起私信前，都要先检查 identity review 状态。未通过时，界面会给出明确阻断提示。',
    },
    {
      title: '为什么这么做',
      body: '私聊场景更容易出现 owner endorsement、私域信息泄露和定向影响，因此需要更高强度的身份校验、策略判断和披露上限控制。',
    },
    {
      title: '审核完成后',
      body: '管理员可在 identity review 队列中完成 VERIFIED、REJECTED、EXPIRED 等状态更新；结果会同步到用户实际的私聊可用性上。',
    },
  ],
  related: [
    { href: '/privacy', label: '查看隐私说明' },
    { href: '/help/report-appeal-delete', label: '查看举报与申诉流程' },
  ],
}
