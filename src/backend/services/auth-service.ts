import bcrypt from 'bcryptjs'
import { createHmac, randomInt } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config.js'
import { AppError, UnauthorizedError } from '../lib/errors.js'
import type { InviteCodeRepository } from '../repos/invite-code-repository.js'
import type { AuthVerificationChallengeRepository } from '../repos/auth-verification-challenge-repository.js'
import type { UserRepository } from '../repos/user-repository.js'
import type {
  AuthVerificationChallenge,
  AuthVerificationChannel,
  AuthVerificationPurpose,
  HumanUser,
  InviteCode,
} from '../repos/types.js'
import type { EmailVerificationSender, SmsVerificationSender } from './auth-delivery.js'
import type { AdminUserAccessService } from './admin-user-access-service.js'

const BCRYPT_ROUNDS = 12

interface JwtPayload {
  userId: string
  email: string | null
  phone: string | null
  role: 'user' | 'admin'
}

interface EmailSignupChallengePayload extends Record<string, unknown> {
  kind: 'signup'
  displayName: string
  passwordHash: string
  inviteCodeId: string
}

interface EmailPasswordResetChallengePayload extends Record<string, unknown> {
  kind: 'password_reset'
  userId?: string
  bootstrapEmail?: string
}

interface InviteChallengePayload extends Record<string, unknown> {
  inviteCodeId: string
}

interface ContactChangeChallengePayload extends Record<string, unknown> {
  kind: 'email_change' | 'phone_change'
  userId: string
  newContact: string
}

export interface AuthResult {
  user: UserProfile
  token: string
}

export interface SmsAuthResult extends AuthResult {
  isNewUser: boolean
}

export interface AuthChallengeResult {
  challengeId: string
  maskedTarget: string
  expiresInSec: number
  resendAfterSec: number
  debugCode?: string
}

export interface UserProfile {
  id: string
  email: string | null
  phone: string | null
  displayName: string
  avatarUrl: string | null
  birthDate: string | null
  planTier: string
  role: 'user' | 'admin'
}

function toProfile(user: HumanUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    birthDate: user.birth_date ? user.birth_date.toISOString().slice(0, 10) : null,
    planTier: user.plan_tier,
    role: user.plan_tier === 'ADMIN' ? 'admin' : 'user',
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('86') && digits.length === 13) {
    return digits.slice(2)
  }
  return digits
}

function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim()
}

function parseBirthDateInput(birthDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) {
    throw new AppError(400, '出生日期格式无效', 'INVALID_BIRTH_DATE')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new AppError(400, '出生日期格式无效', 'INVALID_BIRTH_DATE')
  }

  return parsed
}

function maskEmail(email: string): string {
  const [localPart, domain = ''] = email.split('@')
  const visible = localPart.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 1))}@${domain}`
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function createVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

function hashVerificationCode(input: {
  channel: AuthVerificationChannel
  purpose: AuthVerificationPurpose
  target: string
  code: string
}): string {
  return createHmac('sha256', config.auth.verificationSecret)
    .update(`${input.channel}:${input.purpose}:${input.target}:${input.code}`)
    .digest('hex')
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return 'code' in error && (error as { code?: string }).code === 'P2002'
}

function parseEmailSignupPayload(challenge: AuthVerificationChallenge): EmailSignupChallengePayload {
  const payload = challenge.payload_json
  if (!payload) {
    throw new Error('Missing email signup payload')
  }

  const kind = payload.kind
  const displayName = payload.displayName
  const passwordHash = payload.passwordHash
  const inviteCodeId = payload.inviteCodeId
  if (
    (kind !== undefined && kind !== 'signup')
    || typeof displayName !== 'string'
    || typeof passwordHash !== 'string'
    || typeof inviteCodeId !== 'string'
  ) {
    throw new Error('Invalid email signup payload')
  }

  return { kind: 'signup', displayName, passwordHash, inviteCodeId }
}

function parseEmailPasswordResetPayload(
  challenge: AuthVerificationChallenge,
): EmailPasswordResetChallengePayload {
  const payload = challenge.payload_json
  if (!payload) {
    throw new Error('Missing email password reset payload')
  }

  const kind = payload.kind
  const userId = payload.userId
  const bootstrapEmail = payload.bootstrapEmail
  const hasUserId = typeof userId === 'string' && userId.length > 0
  const hasBootstrapEmail = typeof bootstrapEmail === 'string' && bootstrapEmail.length > 0
  if (kind !== 'password_reset' || (!hasUserId && !hasBootstrapEmail)) {
    throw new Error('Invalid email password reset payload')
  }

  return {
    kind: 'password_reset',
    ...(hasUserId ? { userId } : {}),
    ...(hasBootstrapEmail ? { bootstrapEmail } : {}),
  }
}

function createEmailSignupPayload(input: {
  displayName: string
  passwordHash: string
  inviteCodeId: string
}): EmailSignupChallengePayload {
  return {
    kind: 'signup',
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    inviteCodeId: input.inviteCodeId,
  }
}

function createEmailPasswordResetPayload(input: {
  userId?: string
  bootstrapEmail?: string
}): EmailPasswordResetChallengePayload {
  return {
    kind: 'password_reset',
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.bootstrapEmail ? { bootstrapEmail: input.bootstrapEmail } : {}),
  }
}

function isBootstrapAdminEmail(email: string): boolean {
  return config.auth.bootstrapAdmins.emails.includes(normalizeEmail(email))
}

function isBootstrapAdminPhone(phone: string): boolean {
  return config.auth.bootstrapAdmins.phones.includes(normalizePhone(phone))
}

function parseInviteChallengePayload(
  challenge: AuthVerificationChallenge,
): InviteChallengePayload | null {
  const payload = challenge.payload_json
  if (!payload) {
    return null
  }
  const inviteCodeId = payload.inviteCodeId
  if (typeof inviteCodeId !== 'string' || inviteCodeId.length === 0) {
    return null
  }
  return { inviteCodeId }
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly inviteCodeRepo: InviteCodeRepository,
    private readonly challengeRepo: AuthVerificationChallengeRepository,
    private readonly emailSender: EmailVerificationSender,
    private readonly smsSender: SmsVerificationSender,
    private readonly adminUserAccessService?: AdminUserAccessService | null,
  ) {}

  async startEmailRegistration(input: {
    email: string
    password: string
    displayName: string
    inviteCode: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const email = normalizeEmail(input.email)
    const existing = await this.userRepo.findByEmail(email)
    if (existing) {
      throw new AppError(409, '该邮箱已被注册', 'EMAIL_ALREADY_REGISTERED')
    }
    const inviteCode = await this.requireUsableInviteCodeByCode(input.inviteCode)

    const now = new Date()
    await this.ensureChallengeRateLimit({
      channel: 'EMAIL',
      purpose: 'EMAIL_SIGNUP',
      target: email,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'EMAIL',
      purpose: 'EMAIL_SIGNUP',
      target: email,
      code_hash: hashVerificationCode({
        channel: 'EMAIL',
        purpose: 'EMAIL_SIGNUP',
        target: email,
        code,
      }),
      payload_json: createEmailSignupPayload({
        displayName: input.displayName.trim(),
        passwordHash,
        inviteCodeId: inviteCode.id,
      }),
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: 0,
    })

    await this.emailSender.sendVerificationCode({
      to: email,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
      purpose: 'EMAIL_SIGNUP',
    })

    return this.toChallengeResult(challenge, maskEmail(email), code)
  }

  async startEmailPasswordReset(input: {
    email: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const email = normalizeEmail(input.email)
    const user = await this.userRepo.findByEmail(email)
    if (!user && !isBootstrapAdminEmail(email)) {
      throw new AppError(404, '该邮箱尚未注册', 'USER_NOT_FOUND')
    }
    if (user?.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    const now = new Date()
    await this.ensureChallengeRateLimit({
      channel: 'EMAIL',
      purpose: 'EMAIL_PASSWORD_RESET',
      target: email,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'EMAIL',
      purpose: 'EMAIL_PASSWORD_RESET',
      target: email,
      code_hash: hashVerificationCode({
        channel: 'EMAIL',
        purpose: 'EMAIL_PASSWORD_RESET',
        target: email,
        code,
      }),
      payload_json: createEmailPasswordResetPayload(user ? { userId: user.id } : { bootstrapEmail: email }),
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: 0,
    })

    await this.emailSender.sendVerificationCode({
      to: email,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
      purpose: 'EMAIL_PASSWORD_RESET',
    })

    return this.toChallengeResult(challenge, maskEmail(email), code)
  }

  async resendEmailRegistration(input: {
    challengeId: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const existingChallenge = await this.challengeRepo.findById(input.challengeId)
    if (!existingChallenge || existingChallenge.purpose !== 'EMAIL_SIGNUP') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    if (existingChallenge.consumed_at) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const email = normalizeEmail(existingChallenge.target)
    if (await this.userRepo.findByEmail(email)) {
      throw new AppError(409, '该邮箱已被注册', 'EMAIL_ALREADY_REGISTERED')
    }
    let payload: EmailSignupChallengePayload
    try {
      payload = parseEmailSignupPayload(existingChallenge)
    } catch {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    await this.requireUsableInviteCodeById(payload.inviteCodeId)

    const now = new Date()
    this.assertResendCooldown(existingChallenge, now)
    await this.ensureChallengeRateLimit({
      channel: 'EMAIL',
      purpose: 'EMAIL_SIGNUP',
      target: email,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'EMAIL',
      purpose: 'EMAIL_SIGNUP',
      target: email,
      code_hash: hashVerificationCode({
        channel: 'EMAIL',
        purpose: 'EMAIL_SIGNUP',
        target: email,
        code,
      }),
      payload_json: existingChallenge.payload_json,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: existingChallenge.resend_count + 1,
    })

    await this.emailSender.sendVerificationCode({
      to: email,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
      purpose: 'EMAIL_SIGNUP',
    })

    return this.toChallengeResult(challenge, maskEmail(email), code)
  }

  async resendEmailPasswordReset(input: {
    challengeId: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const existingChallenge = await this.challengeRepo.findById(input.challengeId)
    if (!existingChallenge || existingChallenge.purpose !== 'EMAIL_PASSWORD_RESET') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    if (existingChallenge.consumed_at) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    let payload: EmailPasswordResetChallengePayload
    try {
      payload = parseEmailPasswordResetPayload(existingChallenge)
    } catch {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    const user = payload.userId ? await this.userRepo.findById(payload.userId) : null
    if (!user && !payload.bootstrapEmail) {
      throw new AppError(404, '该邮箱尚未注册', 'USER_NOT_FOUND')
    }
    if (user?.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    const email = normalizeEmail(user?.email ?? payload.bootstrapEmail!)
    const now = new Date()
    this.assertResendCooldown(existingChallenge, now)
    await this.ensureChallengeRateLimit({
      channel: 'EMAIL',
      purpose: 'EMAIL_PASSWORD_RESET',
      target: email,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'EMAIL',
      purpose: 'EMAIL_PASSWORD_RESET',
      target: email,
      code_hash: hashVerificationCode({
        channel: 'EMAIL',
        purpose: 'EMAIL_PASSWORD_RESET',
        target: email,
        code,
      }),
      payload_json: createEmailPasswordResetPayload(user ? { userId: user.id } : { bootstrapEmail: email }),
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: existingChallenge.resend_count + 1,
    })

    await this.emailSender.sendVerificationCode({
      to: email,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
      purpose: 'EMAIL_PASSWORD_RESET',
    })

    return this.toChallengeResult(challenge, maskEmail(email), code)
  }

  async verifyEmailRegistration(input: {
    challengeId: string
    code: string
  }): Promise<AuthResult> {
    const challenge = await this.challengeRepo.findById(input.challengeId)
    if (!challenge || challenge.purpose !== 'EMAIL_SIGNUP') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    let payload: EmailSignupChallengePayload
    try {
      payload = parseEmailSignupPayload(challenge)
    } catch {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    const email = normalizeEmail(challenge.target)
    if (await this.userRepo.findByEmail(email)) {
      throw new AppError(409, '该邮箱已被注册', 'EMAIL_ALREADY_REGISTERED')
    }
    await this.requireUsableInviteCodeById(payload.inviteCodeId)

    const consumed = await this.challengeRepo.consume({
      id: challenge.id,
      code_hash: hashVerificationCode({
        channel: challenge.channel,
        purpose: challenge.purpose,
        target: challenge.target,
        code: input.code.trim(),
      }),
      now: new Date(),
      max_attempts: config.auth.otp.maxAttempts,
    })

    this.assertConsumeResult(consumed)

    try {
      const result = await this.inviteCodeRepo.createInvitedUser({
        invite_code_id: payload.inviteCodeId,
        user: {
          email,
          password_hash: payload.passwordHash,
          display_name: payload.displayName,
          email_verified: true,
        },
        now: new Date(),
      })

      if (result.kind === 'invite_unavailable') {
        throw new AppError(409, '邀请码已失效或已达上限，请更换邀请码后重试', 'INVITE_CODE_EXHAUSTED')
      }

      const user = await this.finalizeAuthUser(result.user)
      return this.issueAuthResult(user)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(409, '该邮箱已被注册', 'EMAIL_ALREADY_REGISTERED')
      }
      throw error
    }
  }

  async verifyEmailPasswordReset(input: {
    challengeId: string
    code: string
    password: string
  }): Promise<AuthResult> {
    const challenge = await this.challengeRepo.findById(input.challengeId)
    if (!challenge || challenge.purpose !== 'EMAIL_PASSWORD_RESET') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    let payload: EmailPasswordResetChallengePayload
    try {
      payload = parseEmailPasswordResetPayload(challenge)
    } catch {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    const user = payload.userId ? await this.userRepo.findById(payload.userId) : null
    if (!user && !payload.bootstrapEmail) {
      throw new AppError(404, '该邮箱尚未注册', 'USER_NOT_FOUND')
    }
    if (user?.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    const consumed = await this.challengeRepo.consume({
      id: challenge.id,
      code_hash: hashVerificationCode({
        channel: challenge.channel,
        purpose: challenge.purpose,
        target: challenge.target,
        code: input.code.trim(),
      }),
      now: new Date(),
      max_attempts: config.auth.otp.maxAttempts,
    })

    this.assertConsumeResult(consumed)

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const ensuredUser = user ?? await this.ensureBootstrapAdminEmailAccount(payload.bootstrapEmail!)
    const updated = await this.userRepo.updatePassword(ensuredUser.id, passwordHash)
    if (!updated) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }

    const authenticatedUser = await this.finalizeAuthUser(updated)
    return this.issueAuthResult(authenticatedUser)
  }

  async startSmsAuth(input: {
    phone: string
    inviteCode?: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const phone = normalizePhone(input.phone)
    const now = new Date()
    const existing = await this.userRepo.findByPhone(phone)
    if (existing?.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    await this.ensureChallengeRateLimit({
      channel: 'SMS',
      purpose: 'SMS_AUTH',
      target: phone,
      ipAddress: input.ipAddress ?? null,
      now,
    })
    const invitePayload = existing || !input.inviteCode?.trim()
      ? null
      : {
          inviteCodeId: (await this.requireUsableInviteCodeByCode(input.inviteCode)).id,
        }

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'SMS',
      purpose: 'SMS_AUTH',
      target: phone,
      code_hash: hashVerificationCode({
        channel: 'SMS',
        purpose: 'SMS_AUTH',
        target: phone,
        code,
      }),
      payload_json: invitePayload,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: 0,
    })

    await this.smsSender.sendVerificationCode({
      phone,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
    })

    return this.toChallengeResult(challenge, maskPhone(phone), code)
  }

  async resendSmsAuth(input: {
    challengeId: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const existingChallenge = await this.challengeRepo.findById(input.challengeId)
    if (!existingChallenge || existingChallenge.purpose !== 'SMS_AUTH') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    if (existingChallenge.consumed_at) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const invitePayload = parseInviteChallengePayload(existingChallenge)
    if (invitePayload) {
      await this.requireUsableInviteCodeById(invitePayload.inviteCodeId)
    }

    const now = new Date()
    this.assertResendCooldown(existingChallenge, now)
    await this.ensureChallengeRateLimit({
      channel: 'SMS',
      purpose: 'SMS_AUTH',
      target: existingChallenge.target,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'SMS',
      purpose: 'SMS_AUTH',
      target: existingChallenge.target,
      code_hash: hashVerificationCode({
        channel: 'SMS',
        purpose: 'SMS_AUTH',
        target: existingChallenge.target,
        code,
      }),
      payload_json: existingChallenge.payload_json,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: existingChallenge.resend_count + 1,
    })

    await this.smsSender.sendVerificationCode({
      phone: existingChallenge.target,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
    })

    return this.toChallengeResult(challenge, maskPhone(existingChallenge.target), code)
  }

  async verifySmsAuth(input: {
    challengeId: string
    code: string
    displayName?: string
    inviteCode?: string
  }): Promise<SmsAuthResult> {
    const challenge = await this.challengeRepo.findById(input.challengeId)
    if (!challenge || challenge.purpose !== 'SMS_AUTH') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const phone = normalizePhone(challenge.target)
    const existingBeforeConsume = await this.userRepo.findByPhone(phone)
    const displayName = input.displayName?.trim()
    const invitePayload = parseInviteChallengePayload(challenge)
    const bootstrapPhone = !existingBeforeConsume && isBootstrapAdminPhone(phone)

    if (!existingBeforeConsume && !displayName) {
      throw new AppError(400, '首次使用手机号注册时需要填写昵称', 'DISPLAY_NAME_REQUIRED')
    }
    let inviteCodeId: string | null = invitePayload?.inviteCodeId ?? null
    if (!existingBeforeConsume && !bootstrapPhone) {
      if (!inviteCodeId && input.inviteCode?.trim()) {
        inviteCodeId = (await this.requireUsableInviteCodeByCode(input.inviteCode)).id
      }
      if (!inviteCodeId) {
        throw new AppError(400, '请输入邀请码', 'INVITE_CODE_REQUIRED')
      }
      await this.requireUsableInviteCodeById(inviteCodeId)
    }

    const consumed = await this.challengeRepo.consume({
      id: challenge.id,
      code_hash: hashVerificationCode({
        channel: challenge.channel,
        purpose: challenge.purpose,
        target: challenge.target,
        code: input.code.trim(),
      }),
      now: new Date(),
      max_attempts: config.auth.otp.maxAttempts,
    })

    this.assertConsumeResult(consumed)

    const existing = existingBeforeConsume ?? await this.userRepo.findByPhone(phone)
    if (existing) {
      if (existing.status === 'SUSPENDED') {
        throw new UnauthorizedError('账号已被停用')
      }
      const user = await this.finalizeAuthUser(existing)
      const result = this.issueAuthResult(user)
      return { ...result, isNewUser: false }
    }

    if (!displayName) {
      throw new AppError(400, '首次使用手机号注册时需要填写昵称', 'DISPLAY_NAME_REQUIRED')
    }

    try {
      const result = bootstrapPhone
        ? {
            kind: 'created' as const,
            user: await this.userRepo.create({
              display_name: displayName,
              phone,
              phone_verified: true,
            }),
          }
        : await this.inviteCodeRepo.createInvitedUser({
        invite_code_id: inviteCodeId!,
        user: {
          display_name: displayName,
          phone,
          phone_verified: true,
        },
        now: new Date(),
      })

      if (result.kind === 'invite_unavailable') {
        throw new AppError(409, '邀请码已失效或已达上限，请更换邀请码后重试', 'INVITE_CODE_EXHAUSTED')
      }

      const user = await this.finalizeAuthUser(result.user)
      const authResult = this.issueAuthResult(user)
      return { ...authResult, isNewUser: true }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrentUser = await this.userRepo.findByPhone(phone)
        if (concurrentUser) {
          const user = await this.finalizeAuthUser(concurrentUser)
          const result = this.issueAuthResult(user)
          return { ...result, isNewUser: false }
        }
      }
      throw error
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email)
    const user = await this.userRepo.findByEmail(normalizedEmail)
    if (!user) {
      throw new AppError(404, '该邮箱尚未注册', 'USER_NOT_FOUND')
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    if (!user.password_hash) {
      throw new AppError(400, '该账号不支持密码登录，请使用短信验证码', 'PASSWORD_LOGIN_UNAVAILABLE')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new UnauthorizedError('邮箱或密码错误')
    }

    const authenticatedUser = await this.finalizeAuthUser(user)
    return this.issueAuthResult(authenticatedUser)
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepo.findById(userId)
    return user ? toProfile(user) : null
  }

  async updateProfile(input: {
    userId: string
    displayName?: string
    avatarUrl?: string | null
    birthDate?: string | null
  }): Promise<UserProfile> {
    const user = await this.userRepo.updateProfile(input.userId, {
      ...(input.displayName !== undefined ? { display_name: input.displayName.trim() } : {}),
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
      ...(input.birthDate !== undefined
        ? { birth_date: input.birthDate ? parseBirthDateInput(input.birthDate) : null }
        : {}),
    })
    if (!user) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    return toProfile(user)
  }

  async startEmailChange(input: {
    userId: string
    newEmail: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const newEmail = normalizeEmail(input.newEmail)
    const user = await this.userRepo.findById(input.userId)
    if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    if (user.status === 'SUSPENDED') throw new UnauthorizedError('账号已被停用')
    if (user.email === newEmail) throw new AppError(400, '新邮箱与当前邮箱相同', 'SAME_EMAIL')

    const conflict = await this.userRepo.findByEmail(newEmail)
    if (conflict) throw new AppError(409, '该邮箱已被其他账号使用', 'EMAIL_ALREADY_REGISTERED')

    const now = new Date()
    await this.ensureChallengeRateLimit({
      channel: 'EMAIL',
      purpose: 'EMAIL_CHANGE',
      target: newEmail,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'EMAIL',
      purpose: 'EMAIL_CHANGE',
      target: newEmail,
      code_hash: hashVerificationCode({ channel: 'EMAIL', purpose: 'EMAIL_CHANGE', target: newEmail, code }),
      payload_json: { kind: 'email_change', userId: user.id, newContact: newEmail } satisfies ContactChangeChallengePayload,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: 0,
    })

    await this.emailSender.sendVerificationCode({
      to: newEmail,
      code,
      expiresInSec: config.auth.otp.ttlSeconds,
      purpose: 'EMAIL_CHANGE',
    })
    return this.toChallengeResult(challenge, maskEmail(newEmail), code)
  }

  async verifyEmailChange(input: {
    userId: string
    challengeId: string
    code: string
  }): Promise<UserProfile> {
    const challenge = await this.challengeRepo.findById(input.challengeId)
    if (!challenge || challenge.purpose !== 'EMAIL_CHANGE') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const payload = challenge.payload_json as ContactChangeChallengePayload | null
    if (!payload || payload.kind !== 'email_change' || payload.userId !== input.userId) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const consumed = await this.challengeRepo.consume({
      id: challenge.id,
      code_hash: hashVerificationCode({ channel: challenge.channel, purpose: challenge.purpose, target: challenge.target, code: input.code.trim() }),
      now: new Date(),
      max_attempts: config.auth.otp.maxAttempts,
    })
    this.assertConsumeResult(consumed)

    const conflict = await this.userRepo.findByEmail(normalizeEmail(payload.newContact))
    if (conflict) throw new AppError(409, '该邮箱已被其他账号使用', 'EMAIL_ALREADY_REGISTERED')

    let updated: HumanUser | null
    try {
      updated = await this.userRepo.updateEmail(input.userId, payload.newContact)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(409, '该邮箱已被其他账号使用', 'EMAIL_ALREADY_REGISTERED')
      }
      throw error
    }
    if (!updated) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    return toProfile(updated)
  }

  async startPhoneChange(input: {
    userId: string
    newPhone: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const newPhone = normalizePhone(input.newPhone)
    const user = await this.userRepo.findById(input.userId)
    if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    if (user.status === 'SUSPENDED') throw new UnauthorizedError('账号已被停用')
    if (user.phone === newPhone) throw new AppError(400, '新手机号与当前手机号相同', 'SAME_PHONE')

    const conflict = await this.userRepo.findByPhone(newPhone)
    if (conflict) throw new AppError(409, '该手机号已被其他账号使用', 'PHONE_ALREADY_REGISTERED')

    const now = new Date()
    await this.ensureChallengeRateLimit({
      channel: 'SMS',
      purpose: 'PHONE_CHANGE',
      target: newPhone,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: 'SMS',
      purpose: 'PHONE_CHANGE',
      target: newPhone,
      code_hash: hashVerificationCode({ channel: 'SMS', purpose: 'PHONE_CHANGE', target: newPhone, code }),
      payload_json: { kind: 'phone_change', userId: user.id, newContact: newPhone } satisfies ContactChangeChallengePayload,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: 0,
    })

    await this.smsSender.sendVerificationCode({ phone: newPhone, code, expiresInSec: config.auth.otp.ttlSeconds })
    return this.toChallengeResult(challenge, maskPhone(newPhone), code)
  }

  async verifyPhoneChange(input: {
    userId: string
    challengeId: string
    code: string
  }): Promise<UserProfile> {
    const challenge = await this.challengeRepo.findById(input.challengeId)
    if (!challenge || challenge.purpose !== 'PHONE_CHANGE') {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const payload = challenge.payload_json as ContactChangeChallengePayload | null
    if (!payload || payload.kind !== 'phone_change' || payload.userId !== input.userId) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const consumed = await this.challengeRepo.consume({
      id: challenge.id,
      code_hash: hashVerificationCode({ channel: challenge.channel, purpose: challenge.purpose, target: challenge.target, code: input.code.trim() }),
      now: new Date(),
      max_attempts: config.auth.otp.maxAttempts,
    })
    this.assertConsumeResult(consumed)

    const conflict = await this.userRepo.findByPhone(normalizePhone(payload.newContact))
    if (conflict) throw new AppError(409, '该手机号已被其他账号使用', 'PHONE_ALREADY_REGISTERED')

    let updated: HumanUser | null
    try {
      updated = await this.userRepo.updatePhone(input.userId, payload.newContact)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(409, '该手机号已被其他账号使用', 'PHONE_ALREADY_REGISTERED')
      }
      throw error
    }
    if (!updated) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    return toProfile(updated)
  }

  async resendContactChange(input: {
    userId: string
    challengeId: string
    ipAddress?: string | null
  }): Promise<AuthChallengeResult> {
    const existing = await this.challengeRepo.findById(input.challengeId)
    if (!existing || (existing.purpose !== 'EMAIL_CHANGE' && existing.purpose !== 'PHONE_CHANGE')) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }
    if (existing.consumed_at) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const payload = existing.payload_json as ContactChangeChallengePayload | null
    if (!payload || payload.userId !== input.userId) {
      throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
    }

    const now = new Date()
    this.assertResendCooldown(existing, now)
    await this.ensureChallengeRateLimit({
      channel: existing.channel,
      purpose: existing.purpose,
      target: existing.target,
      ipAddress: input.ipAddress ?? null,
      now,
    })

    const code = createVerificationCode()
    const challenge = await this.challengeRepo.createReplacingActive({
      channel: existing.channel,
      purpose: existing.purpose,
      target: existing.target,
      code_hash: hashVerificationCode({ channel: existing.channel, purpose: existing.purpose, target: existing.target, code }),
      payload_json: existing.payload_json,
      requested_from_ip: input.ipAddress ?? null,
      expires_at: this.getExpiry(now),
      last_sent_at: now,
      resend_count: existing.resend_count + 1,
    })

    const masked = existing.channel === 'EMAIL' ? maskEmail(existing.target) : maskPhone(existing.target)
    if (existing.channel === 'EMAIL') {
      await this.emailSender.sendVerificationCode({
        to: existing.target,
        code,
        expiresInSec: config.auth.otp.ttlSeconds,
        purpose: 'EMAIL_CHANGE',
      })
    } else {
      await this.smsSender.sendVerificationCode({ phone: existing.target, code, expiresInSec: config.auth.otp.ttlSeconds })
    }

    return this.toChallengeResult(challenge, masked, code)
  }

  async ensureDevIdentity(input: {
    userId: string
    email: string
    role: 'user' | 'admin'
  }): Promise<void> {
    await this.userRepo.upsertDevIdentity({
      id: input.userId,
      email: input.email,
      role: input.role,
    })
  }

  private async finalizeAuthUser(user: HumanUser): Promise<HumanUser> {
    const resolvedUser = this.adminUserAccessService
      ? await this.adminUserAccessService.promoteBootstrapAdmin(user)
      : user
    await this.userRepo.updateLastLogin(resolvedUser.id)
    return resolvedUser
  }

  private async ensureBootstrapAdminEmailAccount(email: string): Promise<HumanUser> {
    const normalizedEmail = normalizeEmail(email)
    if (!isBootstrapAdminEmail(normalizedEmail)) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const existing = await this.userRepo.findByEmail(normalizedEmail)
    if (existing) {
      return existing
    }

    return this.userRepo.create({
      email: normalizedEmail,
      display_name: 'Bootstrap Admin',
      email_verified: true,
    })
  }

  private assertConsumeResult(
    result: Awaited<ReturnType<AuthVerificationChallengeRepository['consume']>>,
  ): void {
    if (result.kind === 'consumed') {
      return
    }
    if (result.kind === 'invalid_code') {
      throw new AppError(400, '验证码错误', 'INVALID_CODE')
    }
    throw new AppError(400, '验证码已失效，请重新获取', 'CODE_EXPIRED')
  }

  private async requireUsableInviteCodeByCode(rawInviteCode: string): Promise<InviteCode> {
    const inviteCode = await this.inviteCodeRepo.findByCode(normalizeInviteCode(rawInviteCode))
    return this.assertUsableInviteCode(inviteCode)
  }

  private async requireUsableInviteCodeById(inviteCodeId: string): Promise<InviteCode> {
    const inviteCode = await this.inviteCodeRepo.findById(inviteCodeId)
    return this.assertUsableInviteCode(inviteCode)
  }

  private assertUsableInviteCode(inviteCode: InviteCode | null): InviteCode {
    if (!inviteCode) {
      throw new AppError(400, '邀请码不存在', 'INVALID_INVITE_CODE')
    }
    if (inviteCode.status !== 'ACTIVE' || inviteCode.used_count >= inviteCode.max_uses) {
      throw new AppError(409, '邀请码已失效或已达上限，请更换邀请码后重试', 'INVITE_CODE_EXHAUSTED')
    }
    return inviteCode
  }

  private async ensureChallengeRateLimit(input: {
    channel: AuthVerificationChannel
    purpose: AuthVerificationPurpose
    target: string
    ipAddress: string | null
    now: Date
  }): Promise<void> {
    const since = new Date(input.now.getTime() - 60 * 60 * 1000)
    const targetCount = await this.challengeRepo.countRecent({
      channel: input.channel,
      purpose: input.purpose,
      target: input.target,
      since,
    })
    if (targetCount >= config.auth.otp.sendLimitPerTargetHour) {
      throw new AppError(429, '验证码发送过于频繁，请稍后再试', 'CODE_RATE_LIMITED')
    }

    if (input.ipAddress) {
      const ipCount = await this.challengeRepo.countRecent({
        channel: input.channel,
        purpose: input.purpose,
        requested_from_ip: input.ipAddress,
        since,
      })
      if (ipCount >= config.auth.otp.sendLimitPerIpHour) {
        throw new AppError(429, '验证码发送过于频繁，请稍后再试', 'CODE_RATE_LIMITED')
      }
    }
  }

  private assertResendCooldown(challenge: AuthVerificationChallenge, now: Date): void {
    const retryAfterMs = challenge.last_sent_at.getTime() + config.auth.otp.resendCooldownSeconds * 1000 - now.getTime()
    if (retryAfterMs > 0) {
      throw new AppError(429, '验证码发送过于频繁，请稍后再试', 'CODE_RATE_LIMITED', {
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
      })
    }
  }

  private getExpiry(now: Date): Date {
    return new Date(now.getTime() + config.auth.otp.ttlSeconds * 1000)
  }

  private issueAuthResult(user: HumanUser): AuthResult {
    const profile = toProfile(user)
    const token = this.generateToken(profile)
    return { user: profile, token }
  }

  private toChallengeResult(
    challenge: AuthVerificationChallenge,
    maskedTarget: string,
    code: string,
  ): AuthChallengeResult {
    return {
      challengeId: challenge.id,
      maskedTarget,
      expiresInSec: config.auth.otp.ttlSeconds,
      resendAfterSec: config.auth.otp.resendCooldownSeconds,
      ...(config.auth.otp.exposeDebugCode ? { debugCode: code } : {}),
    }
  }

  private generateToken(profile: UserProfile): string {
    const payload: JwtPayload = {
      userId: profile.id,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
    }
    const secret: jwt.Secret = config.auth.jwtSecret
    const options: jwt.SignOptions = {
      expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    }
    return jwt.sign(payload, secret, options)
  }
}
