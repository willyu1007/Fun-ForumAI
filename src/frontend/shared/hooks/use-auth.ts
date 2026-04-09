import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  authApi,
  type AuthChallengeResult,
  type SmsAuthResult,
  type UserProfile,
} from '@/api/auth'
import { setDevAuth } from '../utils/dev-token'

const AUTH_QUERY_KEY = ['auth', 'me'] as const

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<UserProfile | null> => {
      try {
        const res = await authApi.me()
        return res.data.user
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const emailRegisterStartMutation = useMutation({
    mutationFn: (data: { email: string; password: string; displayName: string; inviteCode: string }) =>
      authApi.startEmailRegistration(data),
  })

  const emailRegisterVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string }) => authApi.verifyEmailRegistration(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const emailRegisterResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendEmailRegistration(data),
  })

  const passwordResetStartMutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.startEmailPasswordReset(data),
  })

  const passwordResetVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string; password: string }) =>
      authApi.verifyEmailPasswordReset(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const passwordResetResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendEmailPasswordReset(data),
  })

  const smsSendMutation = useMutation({
    mutationFn: (data: { phone: string; inviteCode?: string }) => authApi.sendSmsCode(data),
  })

  const smsVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string; displayName?: string; inviteCode?: string }) =>
      authApi.verifySmsCode(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const smsResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendSmsCode(data),
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.invalidateQueries()
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: { displayName?: string; avatarUrl?: string | null; birthDate?: string | null }) =>
      authApi.updateProfile(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const emailChangeStartMutation = useMutation({
    mutationFn: (data: { newEmail: string }) => authApi.startEmailChange(data),
  })

  const emailChangeVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string }) => authApi.verifyEmailChange(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const phoneChangeStartMutation = useMutation({
    mutationFn: (data: { newPhone: string }) => authApi.startPhoneChange(data),
  })

  const phoneChangeVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string }) => authApi.verifyPhoneChange(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const contactChangeResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendContactChange(data),
  })

  const login = useCallback(
    (data: { email: string; password: string }) => loginMutation.mutateAsync(data),
    [loginMutation],
  )

  const startEmailRegistration = useCallback(
    async (data: { email: string; password: string; displayName: string; inviteCode: string }): Promise<AuthChallengeResult> => {
      const res = await emailRegisterStartMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterStartMutation],
  )

  const verifyEmailRegistration = useCallback(
    async (data: { challengeId: string; code: string }) => {
      const res = await emailRegisterVerifyMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterVerifyMutation],
  )

  const resendEmailRegistration = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await emailRegisterResendMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterResendMutation],
  )

  const startEmailPasswordReset = useCallback(
    async (data: { email: string }): Promise<AuthChallengeResult> => {
      const res = await passwordResetStartMutation.mutateAsync(data)
      return res.data
    },
    [passwordResetStartMutation],
  )

  const verifyEmailPasswordReset = useCallback(
    async (data: { challengeId: string; code: string; password: string }) => {
      const res = await passwordResetVerifyMutation.mutateAsync(data)
      return res.data
    },
    [passwordResetVerifyMutation],
  )

  const resendEmailPasswordReset = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await passwordResetResendMutation.mutateAsync(data)
      return res.data
    },
    [passwordResetResendMutation],
  )

  const sendSmsCode = useCallback(
    async (data: { phone: string; inviteCode?: string }): Promise<AuthChallengeResult> => {
      const res = await smsSendMutation.mutateAsync(data)
      return res.data
    },
    [smsSendMutation],
  )

  const verifySmsCode = useCallback(
    async (data: {
      challengeId: string
      code: string
      displayName?: string
      inviteCode?: string
    }): Promise<SmsAuthResult> => {
      const res = await smsVerifyMutation.mutateAsync(data)
      return res.data
    },
    [smsVerifyMutation],
  )

  const resendSmsCode = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await smsResendMutation.mutateAsync(data)
      return res.data
    },
    [smsResendMutation],
  )

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation])

  const updateProfile = useCallback(
    async (data: { displayName?: string; avatarUrl?: string | null; birthDate?: string | null }): Promise<UserProfile> => {
      const res = await updateProfileMutation.mutateAsync(data)
      return res.data.user
    },
    [updateProfileMutation],
  )

  const startEmailChange = useCallback(
    async (data: { newEmail: string }): Promise<AuthChallengeResult> => {
      const res = await emailChangeStartMutation.mutateAsync(data)
      return res.data
    },
    [emailChangeStartMutation],
  )

  const verifyEmailChange = useCallback(
    async (data: { challengeId: string; code: string }): Promise<UserProfile> => {
      const res = await emailChangeVerifyMutation.mutateAsync(data)
      return res.data.user
    },
    [emailChangeVerifyMutation],
  )

  const startPhoneChange = useCallback(
    async (data: { newPhone: string }): Promise<AuthChallengeResult> => {
      const res = await phoneChangeStartMutation.mutateAsync(data)
      return res.data
    },
    [phoneChangeStartMutation],
  )

  const verifyPhoneChange = useCallback(
    async (data: { challengeId: string; code: string }): Promise<UserProfile> => {
      const res = await phoneChangeVerifyMutation.mutateAsync(data)
      return res.data.user
    },
    [phoneChangeVerifyMutation],
  )

  const resendContactChange = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await contactChangeResendMutation.mutateAsync(data)
      return res.data
    },
    [contactChangeResendMutation],
  )

  const switchIdentity = useCallback(
    async (identity: 'anonymous' | 'user' | 'admin') => {
      await setDevAuth(identity)
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
    },
    [queryClient],
  )

  const currentIdentity: 'anonymous' | 'user' | 'admin' = !user
    ? 'anonymous'
    : user.role === 'admin'
      ? 'admin'
      : 'user'

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    currentIdentity,
    login,
    startEmailRegistration,
    verifyEmailRegistration,
    resendEmailRegistration,
    startEmailPasswordReset,
    verifyEmailPasswordReset,
    resendEmailPasswordReset,
    sendSmsCode,
    verifySmsCode,
    resendSmsCode,
    logout,
    updateProfile,
    startEmailChange,
    verifyEmailChange,
    startPhoneChange,
    verifyPhoneChange,
    resendContactChange,
    switchIdentity,
    isLoginPending: loginMutation.isPending,
    isEmailRegisterStartPending: emailRegisterStartMutation.isPending,
    isEmailRegisterVerifyPending: emailRegisterVerifyMutation.isPending,
    isEmailRegisterResendPending: emailRegisterResendMutation.isPending,
    isPasswordResetStartPending: passwordResetStartMutation.isPending,
    isPasswordResetVerifyPending: passwordResetVerifyMutation.isPending,
    isPasswordResetResendPending: passwordResetResendMutation.isPending,
    isSmsSendPending: smsSendMutation.isPending,
    isSmsVerifyPending: smsVerifyMutation.isPending,
    isSmsResendPending: smsResendMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isUpdateProfilePending: updateProfileMutation.isPending,
    isEmailChangeStartPending: emailChangeStartMutation.isPending,
    isEmailChangeVerifyPending: emailChangeVerifyMutation.isPending,
    isPhoneChangeStartPending: phoneChangeStartMutation.isPending,
    isPhoneChangeVerifyPending: phoneChangeVerifyMutation.isPending,
    isContactChangeResendPending: contactChangeResendMutation.isPending,
  }
}
