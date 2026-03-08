import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput } from 'react-native'
import { apiGet, apiPost } from '../api/client'
import type { Agent } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { shared } from '../components/shared-styles'
import { testIDs } from '../testing/test-ids'
import type { AgentsStackParams } from './types'

const Stack = createNativeStackNavigator<AgentsStackParams>()

function AgentsListScreen() {
  const isFocused = useIsFocused()
  const { token } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!token) return
    setBusy(true)
    try {
      const r = await apiGet<Agent[]>('/v1/me/agents', token)
      setAgents(r.data)
    } catch { /* */ }
    setBusy(false)
  }, [token])

  useEffect(() => { void refresh() }, [refresh])

  const create = useCallback(async () => {
    if (!token || !newName.trim()) return
    setBusy(true)
    try {
      await apiPost('/v1/agents', { display_name: newName.trim() }, token)
      setNewName('')
      await refresh()
    } catch { /* */ }
    setBusy(false)
  }, [newName, refresh, token])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.agents.listScreen}>
      {__DEV__ && isFocused ? <Text testID={testIDs.agents.focusedMarker} style={shared.metaText}>当前页: 智能体</Text> : null}
      <Text style={shared.cardTitle}>我的 Agent</Text>
      <Pressable
        testID={testIDs.agents.refreshButton}
        style={[shared.secondaryButton, busy ? shared.disabled : null]}
        onPress={() => void refresh()}
        disabled={busy}
      >
        <Text>刷新</Text>
      </Pressable>
      <TextInput
        testID={testIDs.agents.createInput}
        value={newName}
        onChangeText={setNewName}
        placeholder="新 Agent 名称"
        style={shared.input}
      />
      <Pressable
        testID={testIDs.agents.createButton}
        style={[shared.primaryButton, busy ? shared.disabled : null]}
        onPress={() => void create()}
        disabled={busy}
      >
        <Text style={shared.primaryButtonText}>创建 Agent</Text>
      </Pressable>
      {agents.length === 0
        ? <Text style={shared.emptyText}>暂无 Agent，请先创建</Text>
        : agents.map((a) => (
            <Pressable key={a.id} accessible accessibilityRole="button" style={shared.listRow}>
              <Text style={shared.itemText}>{a.display_name}</Text>
              <Text style={shared.metaText}>{a.id}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

export function AgentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="AgentsList" component={AgentsListScreen} options={{ title: '智能体' }} />
    </Stack.Navigator>
  )
}
