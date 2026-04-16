import type Mail from 'nodemailer/lib/mailer/index.js'
import type { EmailVerificationPurpose } from './auth-delivery.js'

const AUTH_PRODUCT_NAME = 'AI Talkshow'

export interface AuthEmailMessage {
  from: Mail.Address
  sender: Mail.Address
  envelope: {
    from: string
    to: string
  }
  headers: Record<string, string>
  to: string
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildMailbox(input: {
  address: string
  name?: string
}): Mail.Address {
  const address = input.address.trim()
  const name = input.name?.trim() || AUTH_PRODUCT_NAME
  return { address, name }
}

// Keep auth email composition isolated from transport wiring so future
// invitation emails can reuse the same sender/header policy.
export function buildEmailVerificationMessage(input: {
  to: string
  code: string
  expiresInSec: number
  purpose: EmailVerificationPurpose
  fromEmail: string
  fromName?: string
}): AuthEmailMessage {
  const minutes = Math.max(1, Math.ceil(input.expiresInSec / 60))
  const mailbox = buildMailbox({
    address: input.fromEmail,
    name: input.fromName || AUTH_PRODUCT_NAME,
  })
  const content = readEmailVerificationCopy(input.purpose)
  const previewText = `${content.previewLead}${input.code}，${minutes} 分钟内有效。`
  const text = [
    content.intro,
    '',
    `验证码：${input.code}`,
    `有效期：${minutes} 分钟`,
    '',
    content.ignoreHint,
    content.securityHint,
  ].join('\n')
  const html = [
    '<div style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;">',
    escapeHtml(previewText),
    '</div>',
    '<div style="margin:0;padding:24px;background:#f3f4f6;color:#111827;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">',
    '<div style="padding:28px 28px 20px;">',
    `<p style="margin:0 0 8px;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">${escapeHtml(AUTH_PRODUCT_NAME)}</p>`,
    `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.35;color:#111827;">${escapeHtml(content.headline)}</h1>`,
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">${escapeHtml(content.body)}</p>`,
    `<div style="margin:0 0 18px;padding:18px 20px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;font-size:32px;line-height:1;font-weight:800;letter-spacing:0.22em;color:#1d4ed8;">${escapeHtml(input.code)}</div>`,
    `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#4b5563;">验证码将在 <strong>${minutes} 分钟</strong> 后失效。</p>`,
    `<p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">${escapeHtml(`${content.ignoreHint}${content.securityHint}`)}</p>`,
    '</div>',
    '<div style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.7;color:#6b7280;">',
    escapeHtml(content.footer),
    '</div>',
    '</div>',
    '</div>',
  ].join('')

  return {
    from: mailbox,
    sender: mailbox,
    envelope: {
      from: mailbox.address,
      to: input.to,
    },
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    },
    to: input.to,
    subject: content.subject,
    text,
    html,
  }
}

function readEmailVerificationCopy(purpose: EmailVerificationPurpose): {
  subject: string
  previewLead: string
  intro: string
  headline: string
  body: string
  ignoreHint: string
  securityHint: string
  footer: string
} {
  switch (purpose) {
    case 'EMAIL_PASSWORD_RESET':
      return {
        subject: `${AUTH_PRODUCT_NAME} 重置密码验证码`,
        previewLead: `你正在重置 ${AUTH_PRODUCT_NAME} 的登录密码。验证码 `,
        intro: `你正在重置 ${AUTH_PRODUCT_NAME} 的登录密码。`,
        headline: '验证邮箱，重置登录密码',
        body: '输入下面的 6 位验证码，即可继续设置新密码。',
        ignoreHint: '如果这不是你本人操作，可以直接忽略这封邮件。',
        securityHint: '为保障账号安全，请不要把验证码转发给他人。',
        footer: `这是一封用于完成 ${AUTH_PRODUCT_NAME} 密码重置验证的事务邮件。`,
      }
    case 'EMAIL_CHANGE':
      return {
        subject: `${AUTH_PRODUCT_NAME} 邮箱变更验证码`,
        previewLead: `你正在验证 ${AUTH_PRODUCT_NAME} 的新邮箱地址。验证码 `,
        intro: `你正在验证 ${AUTH_PRODUCT_NAME} 的新邮箱地址。`,
        headline: '验证新邮箱地址',
        body: '输入下面的 6 位验证码，即可完成邮箱修改。',
        ignoreHint: '如果这不是你本人操作，可以直接忽略这封邮件。',
        securityHint: '为保障账号安全，请不要把验证码转发给他人。',
        footer: `这是一封用于完成 ${AUTH_PRODUCT_NAME} 邮箱变更验证的事务邮件。`,
      }
    case 'EMAIL_SIGNUP':
    default:
      return {
        subject: `${AUTH_PRODUCT_NAME} 注册验证码`,
        previewLead: `你正在完成 ${AUTH_PRODUCT_NAME} 的邮箱注册。验证码 `,
        intro: `你正在完成 ${AUTH_PRODUCT_NAME} 的邮箱注册。`,
        headline: `完成注册，进入 ${AUTH_PRODUCT_NAME}`,
        body: '你正在完成邮箱验证。输入下面的 6 位验证码，即可继续注册。',
        ignoreHint: '如果这不是你本人操作，可以直接忽略这封邮件。',
        securityHint: '为保障账号安全，请不要把验证码转发给他人。',
        footer: `这是一封用于完成 ${AUTH_PRODUCT_NAME} 注册验证的事务邮件。`,
      }
  }
}
