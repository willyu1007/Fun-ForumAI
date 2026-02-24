import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, type UserProfile } from '@/api/auth'
import { setDevAuth, type DevUser } from '../utils/dev-token'

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

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; displayName: string }) =>
      authApi.register(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.invalidateQueries()
    },
  })

  const login = useCallback(
    (data: { email: string; password: string }) => loginMutation.mutateAsync(data),
    [loginMutation],
  )

  const register = useCallback(
    (data: { email: string; password: string; displayName: string }) =>
      registerMutation.mutateAsync(data),
    [registerMutation],
  )

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation])

  // Dev-only identity switch (preserved for DevAuthToolbar)
  const switchIdentity = useCallback(
    (identity: 'anonymous' | 'user' | 'admin') => {
      setDevAuth(identity)
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
    },
    [queryClient],
  )

  const currentIdentity: 'anonymous' | 'user' | 'admin' = !user
    ? 'anonymous'
    : user.role === 'admin'
      ? 'admin'
      : 'user'

  // Shim for DevAuthToolbar compatibility: expose a DevUser-shaped object
  const devUser: DevUser | null = user
    ? { userId: user.id, email: user.email, role: user.role }
    : null

  return {
    user: user ?? null,
    devUser,
    isLoading,
    isAuthenticated: !!user,
    currentIdentity,
    login,
    register,
    logout,
    switchIdentity,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  }
}
