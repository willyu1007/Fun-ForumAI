import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { apiGet, apiPost } from '../api/client'
import type { Agent, PrivateMessage, PrivateSession } from '../api/types'
import { useAuth } from '../auth/auth-context'
import { openSseStream } from '../realtime/sse'
import { isPrivateEvent } from '../events'
import { shared } from '../components/shared-styles'
import type { PrivateStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<PrivateStackParams>()

function SessionsListScreen({ navigation }: NativeStackScreenProps<PrivateStackParams, 'SessionsList'>) {
  const { token } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<PrivateSession[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    void apiGet<Agent[]>('/v1/me/agents', token).then((r) => {
      setAgents(r.data)
      if (r.data.length > 0 && !selectedAgentId) setSelectedAgentId(r.data[0].id)
    }).catch(() => {})
  }, [selectedAgentId, token])

  const refreshSessions = useCallback(async () => {
    if (!token || !selectedAgentId) return
    setBusy(true)
    try {
      const r = await apiGet<{ items: PrivateSession[] }>(`/v1/agents/${selectedAgentId}/chat/sessions`, token)
      setSessions(r.data.items)
    } catch { /* */ }
    setBusy(false)
  }, [selectedAgentId, token])

  useEffect(() => { void refreshSessions() }, [refreshSessions])

  const createSession = useCallback(async () => {
    if (!token || !selectedAgentId) return
    setBusy(true)
    try {
      const r = await apiPost<PrivateSession>(`/v1/agents/${selectedAgentId}/chat/sessions`, {}, token)
      navigation.navigate('Chat', { sessionId: r.data.id, agentId: selectedAgentId })
    } catch { /* */ }
    setBusy(false)
  }, [navigation, selectedAgentId, token])

  return (
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>私聊会话</Text>

      <Text style={shared.sectionTitle}>选择 Agent</Text>
      {agents.map((a) => (
        <Pressable
          key={a.id}
          style={[shared.listRow, a.id === selectedAgentId ? shared.listRowSelected : null]}
          onPress={() => setSelectedAgentId(a.id)}
        >
          <Text style={shared.itemText}>{a.display_name}</Text>
        </Pressable>
      ))}

      <View style={shared.buttonRow}>
        <Pressable style={[shared.primaryButton, busy ? shared.disabled : null]} onPress={() => void createSession()} disabled={busy}>
          <Text style={shared.primaryButtonText}>新建会话</Text>
        </Pressable>
        <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void refreshSessions()} disabled={busy}>
          <Text>刷新</Text>
        </Pressable>
      </View>

      {sessions.length === 0
        ? <Text style={shared.emptyText}>暂无会话</Text>
        : sessions.map((s) => (
            <Pressable
              key={s.id}
              style={shared.listRow}
              onPress={() => navigation.navigate('Chat', { sessionId: s.id, agentId: selectedAgentId ?? s.agent_id })}
            >
              <Text style={shared.itemText} numberOfLines={1}>{s.id}</Text>
              <Text style={shared.metaText}>{s.status}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

function ChatScreen({ route }: NativeStackScreenProps<PrivateStackParams, 'Chat'>) {
  const { sessionId, agentId } = route.params
  const { token } = useAuth()
  const [messages, setMessages] = useState<PrivateMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const sorted = useMemo(
    () => [...messages].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')),
    [messages],
  )

  const loadMessages = useCallback(async () => {
    if (!token) return
    try {
      const r = await apiGet<{ items: PrivateMessage[] }>(
        `/v1/agents/_/chat/sessions/${sessionId}/messages?limit=100`, token,
      )
      setMessages(r.data.items)
    } catch { /* */ }
  }, [sessionId, token])

  useEffect(() => { void loadMessages() }, [loadMessages])

  useEffect(() => {
    if (!token) return
    return openSseStream({
      sessions: [sessionId],
      token,
      onEvent: (e) => { if (isPrivateEvent(e)) void loadMessages() },
    })
  }, [loadMessages, sessionId, token])

  const send = useCallback(async () => {
    if (!token || !input.trim()) return
    const content = input.trim()
    setBusy(true)
    try {
      await apiPost(`/v1/agents/${agentId}/chat/sessions/${sessionId}/messages`, { content }, token)
      setInput('')
      Keyboard.dismiss()
      await loadMessages()
    } catch { /* */ }
    setBusy(false)
  }, [agentId, input, loadMessages, sessionId, token])

  const endSession = useCallback(async () => {
    if (!token) return
    setBusy(true)
    try {
      await apiPost(`/v1/agents/${agentId}/chat/sessions/${sessionId}/end`, {}, token)
      await loadMessages()
    } catch { /* */ }
    setBusy(false)
  }, [agentId, loadMessages, sessionId, token])

  return (
    <ScrollView contentContainerStyle={shared.card} keyboardShouldPersistTaps="handled">
      {sorted.length === 0
        ? <Text style={shared.emptyText}>暂无消息</Text>
        : sorted.map((msg) => (
            <View key={msg.id} style={shared.messageRow}>
              <Text style={shared.metaText}>{msg.author_type}</Text>
              <Text style={shared.itemText}>{msg.content}</Text>
            </View>
          ))}

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="输入私聊消息"
        style={shared.input}
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      <View style={shared.buttonRow}>
        <Pressable style={[shared.primaryButton, busy ? shared.disabled : null]} onPress={() => void send()} disabled={busy}>
          <Text style={shared.primaryButtonText}>发送</Text>
        </Pressable>
        <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void endSession()} disabled={busy}>
          <Text>结束会话</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

export function PrivateStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="SessionsList" component={SessionsListScreen} options={{ title: '私聊' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '对话' }} />
    </Stack.Navigator>
  )
}
