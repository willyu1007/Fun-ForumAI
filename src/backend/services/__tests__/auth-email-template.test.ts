import { describe, expect, it } from 'vitest'
import { buildEmailVerificationMessage } from '../auth-email-template.js'

describe('buildEmailVerificationMessage', () => {
  it('builds a branded transactional verification email with stable sender metadata', () => {
    const message = buildEmailVerificationMessage({
      to: 'listener@example.com',
      code: '123456',
      expiresInSec: 600,
      purpose: 'EMAIL_SIGNUP',
      fromEmail: 'no-reply@example.com',
      fromName: 'Morthan 系统通知',
    })

    expect(message.subject).toBe('AI Talkshow 注册验证码')
    expect(message.from).toEqual({
      address: 'no-reply@example.com',
      name: 'Morthan 系统通知',
    })
    expect(message.sender).toEqual({
      address: 'no-reply@example.com',
      name: 'Morthan 系统通知',
    })
    expect(message.envelope).toEqual({
      from: 'no-reply@example.com',
      to: 'listener@example.com',
    })
    expect(message.headers).toMatchObject({
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    })
    expect(message.text).toContain('你正在完成 AI Talkshow 的邮箱注册。')
    expect(message.text).toContain('验证码：123456')
    expect(message.text).toContain('请不要把验证码转发给他人')
    expect(message.html).toContain('完成注册，进入 AI Talkshow')
    expect(message.html).toContain('123456')
  })

  it('falls back to the product name when a sender display name is not provided', () => {
    const message = buildEmailVerificationMessage({
      to: 'listener@example.com',
      code: '654321',
      expiresInSec: 300,
      purpose: 'EMAIL_SIGNUP',
      fromEmail: 'no-reply@example.com',
    })

    expect(message.from).toEqual({
      address: 'no-reply@example.com',
      name: 'AI Talkshow',
    })
    expect(message.subject).toBe('AI Talkshow 注册验证码')
    expect(message.text).toContain('有效期：5 分钟')
  })

  it('renders password reset copy when the purpose is EMAIL_PASSWORD_RESET', () => {
    const message = buildEmailVerificationMessage({
      to: 'listener@example.com',
      code: '112233',
      expiresInSec: 600,
      purpose: 'EMAIL_PASSWORD_RESET',
      fromEmail: 'no-reply@example.com',
    })

    expect(message.subject).toBe('AI Talkshow 重置密码验证码')
    expect(message.text).toContain('你正在重置 AI Talkshow 的登录密码。')
    expect(message.html).toContain('验证邮箱，重置登录密码')
  })
})
