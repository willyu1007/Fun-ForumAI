import { Router } from 'express'
import { validate } from '../validation/validate.js'
import {
  contactChangeResendSchema,
  emailChangeStartSchema,
  emailChangeVerifySchema,
  loginSchema,
  passwordResetStartSchema,
  passwordResetVerifySchema,
  phoneChangeStartSchema,
  phoneChangeVerifySchema,
  registerResendSchema,
  registerSchema,
  registerVerifySchema,
  smsResendSchema,
  smsSendSchema,
  smsVerifySchema,
  updateProfileSchema,
} from '../validation/auth-schemas.js'
import { requireHumanAuth, tryAuthenticateHuman } from '../middleware/human-auth.js'
import type { AuthService } from '../services/auth-service.js'
import { config } from '../lib/config.js'
import { getTrustedClientIp } from '../lib/request-client-ip.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router()

  router.post('/auth/register', validate(registerSchema), async (req, res, next) => {
    try {
      const { email, password, displayName, inviteCode } = req.body
      const result = await authService.startEmailRegistration({
        email,
        password,
        displayName,
        inviteCode,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/register/verify', validate(registerVerifySchema), async (req, res, next) => {
    try {
      const { challengeId, code } = req.body
      const result = await authService.verifyEmailRegistration({ challengeId, code })
      res.cookie('auth_token', result.token, COOKIE_OPTIONS)
      res.status(201).json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/register/resend', validate(registerResendSchema), async (req, res, next) => {
    try {
      const { challengeId } = req.body
      const result = await authService.resendEmailRegistration({
        challengeId,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/login', validate(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.body
      const result = await authService.login(email, password)
      res.cookie('auth_token', result.token, COOKIE_OPTIONS)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/password/reset', validate(passwordResetStartSchema), async (req, res, next) => {
    try {
      const { email } = req.body
      const result = await authService.startEmailPasswordReset({
        email,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/password/reset/resend', validate(registerResendSchema), async (req, res, next) => {
    try {
      const { challengeId } = req.body
      const result = await authService.resendEmailPasswordReset({
        challengeId,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/password/reset/verify', validate(passwordResetVerifySchema), async (req, res, next) => {
    try {
      const { challengeId, code, password } = req.body
      const result = await authService.verifyEmailPasswordReset({ challengeId, code, password })
      res.cookie('auth_token', result.token, COOKIE_OPTIONS)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie('auth_token', { path: '/' })
    res.json({ data: { message: '已退出登录' } })
  })

  router.get('/auth/me', async (req, res, next) => {
    try {
      const user = tryAuthenticateHuman(req)
      if (!user) {
        res.json({ data: { user: null } })
        return
      }

      if (user._devToken && user.email) {
        await authService.ensureDevIdentity({
          userId: user.userId,
          email: user.email,
          role: user.role,
        })
      }

      const profile = await authService.getProfile(user.userId)
      if (!profile) {
        if (user._devToken) {
          res.json({
            data: {
              user: {
                id: user.userId,
                email: user.email,
                phone: user.phone ?? null,
                displayName: user.role === 'admin' ? '开发管理员' : '开发用户',
                avatarUrl: null,
                birthDate: null,
                planTier: user.role === 'admin' ? 'ADMIN' : 'FREE',
                role: user.role,
              },
            },
          })
          return
        }
        res.status(404).json({ error: { code: 'NOT_FOUND', message: '用户不存在' } })
        return
      }
      res.json({ data: { user: profile } })
    } catch (err) {
      next(err)
    }
  })

  router.patch('/auth/profile', requireHumanAuth, validate(updateProfileSchema), async (req, res, next) => {
    try {
      if (req.user!._devToken && req.user!.email) {
        await authService.ensureDevIdentity({
          userId: req.user!.userId,
          email: req.user!.email,
          role: req.user!.role,
        })
      }

      const profile = await authService.updateProfile({
        userId: req.user!.userId,
        displayName: req.body.displayName,
        avatarUrl: req.body.avatarUrl,
        birthDate: req.body.birthDate,
      })
      res.json({ data: { user: profile } })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/email/change', requireHumanAuth, validate(emailChangeStartSchema), async (req, res, next) => {
    try {
      const result = await authService.startEmailChange({
        userId: req.user!.userId,
        newEmail: req.body.newEmail,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/email/change/verify', requireHumanAuth, validate(emailChangeVerifySchema), async (req, res, next) => {
    try {
      const user = await authService.verifyEmailChange({
        userId: req.user!.userId,
        challengeId: req.body.challengeId,
        code: req.body.code,
      })
      res.json({ data: { user } })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/phone/change', requireHumanAuth, validate(phoneChangeStartSchema), async (req, res, next) => {
    try {
      const result = await authService.startPhoneChange({
        userId: req.user!.userId,
        newPhone: req.body.newPhone,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/phone/change/verify', requireHumanAuth, validate(phoneChangeVerifySchema), async (req, res, next) => {
    try {
      const user = await authService.verifyPhoneChange({
        userId: req.user!.userId,
        challengeId: req.body.challengeId,
        code: req.body.code,
      })
      res.json({ data: { user } })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/contact/change/resend', requireHumanAuth, validate(contactChangeResendSchema), async (req, res, next) => {
    try {
      const result = await authService.resendContactChange({
        userId: req.user!.userId,
        challengeId: req.body.challengeId,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/sms/send', validate(smsSendSchema), async (req, res, next) => {
    try {
      const { phone, inviteCode } = req.body
      const result = await authService.startSmsAuth({
        phone,
        inviteCode,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/sms/verify', validate(smsVerifySchema), async (req, res, next) => {
    try {
      const { challengeId, code, displayName, inviteCode } = req.body
      const result = await authService.verifySmsAuth({ challengeId, code, displayName, inviteCode })
      res.cookie('auth_token', result.token, COOKIE_OPTIONS)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.post('/auth/sms/resend', validate(smsResendSchema), async (req, res, next) => {
    try {
      const { challengeId } = req.body
      const result = await authService.resendSmsAuth({
        challengeId,
        ipAddress: getTrustedClientIp(req),
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  router.get('/auth/wechat/qr', (_req, res) => {
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: '微信登录即将开放' },
    })
  })

  router.post('/auth/wechat/callback', (_req, res) => {
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: '微信登录即将开放' },
    })
  })

  return router
}
