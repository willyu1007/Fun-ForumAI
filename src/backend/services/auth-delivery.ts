import { createRequire } from 'node:module'
import type { Transporter } from 'nodemailer'
import { config } from '../lib/config.js'
import { AppError } from '../lib/errors.js'
import { buildEmailVerificationMessage } from './auth-email-template.js'

const require = createRequire(import.meta.url)
const nodemailer = require('nodemailer') as typeof import('nodemailer')
const OpenApiClient = require('@alicloud/openapi-client') as typeof import('@alicloud/openapi-client')
const DysmsApi = require('@alicloud/dysmsapi20170525') as typeof import('@alicloud/dysmsapi20170525')

export type EmailVerificationPurpose = 'EMAIL_SIGNUP' | 'EMAIL_PASSWORD_RESET' | 'EMAIL_CHANGE'

export interface EmailVerificationSender {
  sendVerificationCode(input: {
    to: string
    code: string
    expiresInSec: number
    purpose: EmailVerificationPurpose
  }): Promise<void>
}

export interface SmsVerificationSender {
  sendVerificationCode(input: {
    phone: string
    code: string
    expiresInSec: number
  }): Promise<void>
}

class LogEmailVerificationSender implements EmailVerificationSender {
  async sendVerificationCode(input: {
    to: string
    code: string
    expiresInSec: number
    purpose: EmailVerificationPurpose
  }): Promise<void> {
    console.info(
      `[auth][email] verification code for ${input.to}: ${input.code} (purpose=${input.purpose} ttl=${input.expiresInSec}s)`,
    )
  }
}

class LogSmsVerificationSender implements SmsVerificationSender {
  async sendVerificationCode(input: { phone: string; code: string; expiresInSec: number }): Promise<void> {
    console.info(`[auth][sms] verification code for ${input.phone}: ${input.code} (ttl=${input.expiresInSec}s)`)
  }
}

class DisabledEmailVerificationSender implements EmailVerificationSender {
  async sendVerificationCode(): Promise<void> {
    throw new AppError(503, '当前环境未配置邮箱验证码服务', 'EMAIL_PROVIDER_UNAVAILABLE')
  }
}

class DisabledSmsVerificationSender implements SmsVerificationSender {
  async sendVerificationCode(): Promise<void> {
    throw new AppError(503, '当前环境未配置短信验证码服务', 'SMS_PROVIDER_UNAVAILABLE')
  }
}

class SmtpEmailVerificationSender implements EmailVerificationSender {
  private readonly transport: Transporter = nodemailer.createTransport({
    host: config.authDelivery.smtp.host,
    port: config.authDelivery.smtp.port,
    secure: config.authDelivery.smtp.secure,
    auth: {
      user: config.authDelivery.smtp.user,
      pass: config.authDelivery.smtp.pass,
    },
  })

  async sendVerificationCode(input: {
    to: string
    code: string
    expiresInSec: number
    purpose: EmailVerificationPurpose
  }): Promise<void> {
    try {
      await this.transport.sendMail(buildEmailVerificationMessage({
        to: input.to,
        code: input.code,
        expiresInSec: input.expiresInSec,
        purpose: input.purpose,
        fromEmail: config.authDelivery.smtp.fromEmail,
        fromName: config.authDelivery.smtp.fromName,
      }))
    } catch (error) {
      console.error('[auth][email] failed to send verification email', error)
      throw new AppError(502, '邮箱验证码发送失败，请稍后重试', 'EMAIL_PROVIDER_ERROR')
    }
  }
}

class AliyunSmsVerificationSender implements SmsVerificationSender {
  private readonly client = new DysmsApi.default(new OpenApiClient.Config({
    accessKeyId: config.authDelivery.sms.accessKeyId,
    accessKeySecret: config.authDelivery.sms.accessKeySecret,
    endpoint: config.authDelivery.sms.endpoint,
  }))

  async sendVerificationCode(input: { phone: string; code: string; expiresInSec: number }): Promise<void> {
    try {
      const response = await this.client.sendSms(new DysmsApi.SendSmsRequest({
        phoneNumbers: input.phone,
        signName: config.authDelivery.sms.signName,
        templateCode: config.authDelivery.sms.templateCode,
        templateParam: JSON.stringify({
          code: input.code,
          minutes: Math.ceil(input.expiresInSec / 60),
        }),
      }))

      if (response.body?.code !== 'OK') {
        console.error('[auth][sms] aliyun send failed', response.body)
        throw new AppError(502, '短信验证码发送失败，请稍后重试', 'SMS_PROVIDER_ERROR')
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      console.error('[auth][sms] failed to send verification sms', error)
      throw new AppError(502, '短信验证码发送失败，请稍后重试', 'SMS_PROVIDER_ERROR')
    }
  }
}

function hasSmtpConfig(): boolean {
  const smtp = config.authDelivery.smtp
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.fromEmail)
}

function hasAliyunSmsConfig(): boolean {
  const sms = config.authDelivery.sms
  return Boolean(sms.accessKeyId && sms.accessKeySecret && sms.signName && sms.templateCode)
}

export function createEmailVerificationSender(): EmailVerificationSender {
  if (hasSmtpConfig()) {
    return new SmtpEmailVerificationSender()
  }
  if (config.allowDevTools || config.nodeEnv === 'test') {
    return new LogEmailVerificationSender()
  }
  return new DisabledEmailVerificationSender()
}

export function createSmsVerificationSender(): SmsVerificationSender {
  if (hasAliyunSmsConfig()) {
    return new AliyunSmsVerificationSender()
  }
  if (config.allowDevTools || config.nodeEnv === 'test') {
    return new LogSmsVerificationSender()
  }
  return new DisabledSmsVerificationSender()
}
