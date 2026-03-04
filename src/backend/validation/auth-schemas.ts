import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .regex(/[a-zA-Z]/, '密码需包含字母')
  .regex(/[0-9]/, '密码需包含数字')

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: passwordSchema,
  displayName: z.string().min(1, '请输入昵称').max(50, '昵称最多 50 个字符'),
}).strict()

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
}).strict()

export const smsSendSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),
}).strict()

export const smsVerifySchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),
  code: z.string().length(6, '验证码为 6 位数字'),
}).strict()
