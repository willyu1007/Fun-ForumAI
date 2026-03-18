import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiGet } from '../api/client'
import type { Agent, AgentXpInfo } from '../api/types'
import { useAuth } from '../auth/use-auth'
import { shared } from '../components/shared-styles'
import { testIDs } from '../testing/test-ids'
import type { GrowthStackParams } from './types'

const Stack = createNativeStackNavigator<GrowthStackParams>()

function GrowthPickerScreen({ navigation }: NativeStackScreenProps<GrowthStackParams, 'GrowthPicker'>) {
  const isFocused = useIsFocused()
  const { token } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoadError(false)
    void apiGet<Agent[]>('/v1/me/agents', token)
      .then((r) => setAgents(r.data))
      .catch(() => setLoadError(true))
  }, [token])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.growth.pickerScreen}>
      {__DEV__ && isFocused ? <Text testID={testIDs.growth.focusedMarker} style={shared.metaText}>当前页: XP</Text> : null}
      <Text style={shared.cardTitle}>选择 Agent 查看 XP</Text>
      {loadError
        ? <Text style={shared.emptyText}>加载失败，请重试</Text>
        : agents.length === 0
        ? <Text style={shared.emptyText}>暂无 Agent</Text>
        : agents.map((a) => (
            <Pressable
              key={a.id}
              accessible
              accessibilityLabel={`查看 XP ${a.display_name}`}
              accessibilityRole="button"
              style={shared.listRow}
              onPress={() => navigation.navigate('GrowthView', { agentId: a.id })}
            >
              <Text style={shared.itemText}>{a.display_name}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

function GrowthViewScreen({ route }: NativeStackScreenProps<GrowthStackParams, 'GrowthView'>) {
  const { agentId } = route.params
  const { token } = useAuth()
  const [xp, setXp] = useState<AgentXpInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const r = await apiGet<AgentXpInfo>(`/v1/agents/${agentId}/xp`, token)
      setXp(r.data)
    } catch {
      setError('加载 XP 失败，请重试')
    }
    setBusy(false)
  }, [agentId, token])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.growth.viewScreen}>
      <Text style={shared.cardTitle}>XP 与成长点</Text>
      <Text style={shared.metaText}>XP 只负责累计成长点，不承担成就判定或任何门槛。</Text>
      <Pressable
        testID={testIDs.growth.refreshButton}
        style={[shared.secondaryButton, busy ? shared.disabled : null]}
        onPress={() => void refresh()}
        disabled={busy}
      >
        <Text>刷新</Text>
      </Pressable>
      {error ? (
        <Text style={shared.emptyText}>{error}</Text>
      ) : xp ? (
        <View style={shared.detailBox} testID={testIDs.growth.summaryCard}>
          <Text style={shared.itemText}>Agent: {agentId}</Text>
          <Text style={shared.itemText}>XP: {xp.xp}</Text>
          <Text style={shared.itemText}>每 1 点成长点所需 XP: {xp.xp_per_growth_point} XP</Text>
          <Text style={shared.itemText}>累计成长点: {xp.growth_points_total}</Text>
          <Text style={shared.itemText}>已分配成长点: {xp.growth_points_spent}</Text>
          <Text style={shared.itemText}>待分配成长点: {xp.growth_points_available}</Text>
        </View>
      ) : <Text style={shared.emptyText}>加载中…</Text>}
    </ScrollView>
  )
}

export function GrowthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="GrowthPicker" component={GrowthPickerScreen} options={{ title: 'XP' }} />
      <Stack.Screen name="GrowthView" component={GrowthViewScreen} options={{ title: 'XP 详情' }} />
    </Stack.Navigator>
  )
}
