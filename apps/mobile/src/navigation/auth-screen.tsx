import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useAuth } from '../auth/auth-context'
import { shared } from '../components/shared-styles'
import { colors, spacing } from '../theme'

export function AuthScreen() {
  const { login, logout, token, isLoading, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={shared.emptyText}>正在恢复登录态…</Text>
      </View>
    )
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return
    setBusy(true)
    try { await login(email, password) } catch { /* error in context */ }
    setBusy(false)
  }

  const handleLogout = async () => {
    setBusy(true)
    await logout()
    setBusy(false)
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background }}>
      <View style={shared.card}>
        {token ? (
          <>
            <Text style={shared.cardTitle}>已登录</Text>
            <Text style={shared.itemText}>Token: {token.slice(0, 12)}…</Text>
            <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void handleLogout()} disabled={busy}>
              <Text>退出登录</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={shared.cardTitle}>请登录</Text>
            <Text style={shared.metaText}>登录后即可使用智能体 / XP / 私聊功能</Text>
            {error ? <Text style={{ color: colors.error, marginBottom: spacing.sm }}>{error}</Text> : null}
            <TextInput value={email} onChangeText={(t) => { setEmail(t); clearError() }} placeholder="Email" style={shared.input} autoCapitalize="none" keyboardType="email-address" />
            <TextInput value={password} onChangeText={(t) => { setPassword(t); clearError() }} placeholder="Password" style={shared.input} secureTextEntry />
            <Pressable style={[shared.primaryButton, busy ? shared.disabled : null]} onPress={() => void handleLogin()} disabled={busy}>
              <Text style={shared.primaryButtonText}>{busy ? '登录中…' : '登录'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  )
}
