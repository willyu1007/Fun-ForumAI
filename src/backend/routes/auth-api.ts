import { Router } from 'express'
import { validate } from '../validation/validate.js'
import {
  loginSchema,
  passwordResetStartSchema,
  passwordResetVerifySchema,
  registerResendSchema,
  registerSchema,
  registerVerifySchema,
  smsResendSchema,
  smsSendSchema,
  smsVerifySchema,
  updateProfileSchema,
} from '../validation/auth-schemas.js'
import { requireHumanAuth } from '../middleware/human-auth.js'
import type { AuthService } from '../services/auth-service.js'
import { config } from '../lib/config.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? null
  }
  return req.ip ?? null
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
        ipAddress: getClientIp(req),
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
        ipAddress: getClientIp(req),
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
        ipAddress: getClientIp(req),
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
        ipAddress: getClientIp(req),
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

  router.get('/auth/me', requireHumanAuth, async (req, res, next) => {
    try {
      if (req.user!._devToken && req.user!.email) {
        await authService.ensureDevIdentity({
          userId: req.user!.userId,
          email: req.user!.email,
          role: req.user!.role,
        })
      }

      const profile = await authService.getProfile(req.user!.userId)
      if (!profile) {
        if (req.user!._devToken) {
          res.json({
            data: {
              user: {
                id: req.user!.userId,
                email: req.user!.email,
                phone: req.user!.phone ?? null,
                displayName: req.user!.role === 'admin' ? '开发管理员' : '开发用户',
                avatarUrl: null,
                planTier: req.user!.role === 'admin' ? 'ADMIN' : 'FREE',
                role: req.user!.role,
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
      })
      res.json({ data: { user: profile } })
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
        ipAddress: getClientIp(req),
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
        ipAddress: getClientIp(req),
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
