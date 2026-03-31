import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .regex(/[a-zA-Z]/, '密码需包含字母')
  .regex(/[0-9]/, '密码需包含数字')

const inviteCodeSchema = z.string().regex(/^\d{6}$/, '邀请码为 6 位数字')

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: passwordSchema,
  displayName: z.string().min(1, '请输入昵称').max(50, '昵称最多 50 个字符'),
  inviteCode: inviteCodeSchema,
}).strict()

export const registerVerifySchema = z.object({
  challengeId: z.string().min(1, 'challengeId 不能为空'),
  code: z.string().regex(/^\d{6}$/, '验证码为 6 位数字'),
}).strict()

export const registerResendSchema = z.object({
  challengeId: z.string().min(1, 'challengeId 不能为空'),
}).strict()

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
}).strict()

export const smsSendSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),
  inviteCode: inviteCodeSchema.optional(),
}).strict()

export const smsVerifySchema = z.object({
  challengeId: z.string().min(1, 'challengeId 不能为空'),
  code: z.string().length(6, '验证码为 6 位数字'),
  displayName: z.string().min(1, '请输入昵称').max(50, '昵称最多 50 个字符').optional(),
}).strict()

export const smsResendSchema = z.object({
  challengeId: z.string().min(1, 'challengeId 不能为空'),
}).strict()

const profileAvatarUrlSchema = z
  .string()
  .trim()
  .min(1, '请输入有效头像地址')
  .refine((value) => value.startsWith('https://') || value.startsWith('/'), {
    message: '头像地址必须为 https URL 或站内静态资源路径',
  })

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1, '请输入昵称').max(50, '昵称最多 50 个字符').optional(),
    avatarUrl: profileAvatarUrlSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => body.displayName !== undefined || body.avatarUrl !== undefined, {
    message: 'displayName 或 avatarUrl 至少需要提供一个',
  })
