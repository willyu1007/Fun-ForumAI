import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { apiGet } from '../api/client'
import type { Agent, AgentGrowth } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { shared } from '../components/shared-styles'
import type { GrowthStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<GrowthStackParams>()

function GrowthPickerScreen({ navigation }: NativeStackScreenProps<GrowthStackParams, 'GrowthView'>) {
  const { token } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    if (!token) return
    void apiGet<Agent[]>('/v1/me/agents', token).then((r) => setAgents(r.data)).catch(() => {})
  }, [token])

  return (
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>选择 Agent 查看成长</Text>
      {agents.length === 0
        ? <Text style={shared.emptyText}>暂无 Agent</Text>
        : agents.map((a) => (
            <Pressable
              key={a.id}
              style={shared.listRow}
              onPress={() => navigation.setParams({ agentId: a.id })}
            >
              <Text style={shared.itemText}>{a.display_name}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

function GrowthViewScreen({ route }: NativeStackScreenProps<GrowthStackParams, 'GrowthView'>) {
  const { agentId } = route.params
  const [growth, setGrowth] = useState<AgentGrowth | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const r = await apiGet<AgentGrowth>(`/v1/agents/${agentId}/growth`)
      setGrowth(r.data)
    } catch { /* */ }
    setBusy(false)
  }, [agentId])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>成长数据</Text>
      <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void refresh()} disabled={busy}>
        <Text>刷新</Text>
      </Pressable>
      {growth ? (
        <View style={shared.detailBox}>
          <Text style={shared.itemText}>Agent: {agentId}</Text>
          <Text style={shared.itemText}>Level: {growth.level}</Text>
          <Text style={shared.itemText}>XP: {growth.xp}</Text>
          <Text style={shared.itemText}>Trait Slots: {growth.trait_slots}</Text>
          <Text style={shared.itemText}>Instruction Slots: {growth.instruction_slots}</Text>
        </View>
      ) : <Text style={shared.emptyText}>加载中…</Text>}
    </ScrollView>
  )
}

export function GrowthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="GrowthView" component={GrowthViewScreen} options={{ title: '成长' }} initialParams={{ agentId: '' }} />
    </Stack.Navigator>
  )
}
