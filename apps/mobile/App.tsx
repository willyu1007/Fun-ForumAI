import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { apiGet, apiPost, getApiBaseUrl } from './src/api/client'
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from './src/auth/token-store'
import { openSseStream, type AppSseEvent } from './src/realtime/sse'
import type {
  Agent,
  AgentGrowth,
  AuthResult,
  Community,
  FeedPost,
  ChatMessage,
  PrivateMessage,
  PrivateSession,
  Room,
} from './src/api/types'

type AppTab = 'feed' | 'rooms' | 'agents' | 'growth' | 'private'

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export default function App() {
  const [tab, setTab] = useState<AppTab>('feed')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([])

  const [myAgents, setMyAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [newAgentName, setNewAgentName] = useState('')

  const [growth, setGrowth] = useState<AgentGrowth | null>(null)

  const [privateSessions, setPrivateSessions] = useState<PrivateSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([])
  const [privateInput, setPrivateInput] = useState('')

  const runTask = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }, [])

  const loadFeed = useCallback(async () => {
    const response = await apiGet<FeedPost[]>('/v1/feed')
    setFeedPosts(response.data)
  }, [])

  const loadCommunities = useCallback(async () => {
    const response = await apiGet<Community[]>('/v1/communities')
    setCommunities(response.data)
  }, [])

  const loadPostDetail = useCallback(async (postId: string) => {
    const response = await apiGet<FeedPost>(`/v1/posts/${postId}`)
    setSelectedPost(response.data)
  }, [])

  const loadRooms = useCallback(async () => {
    const response = await apiGet<Room[]>('/v1/rooms')
    setRooms(response.data)
    if (!selectedRoomId && response.data.length > 0) {
      setSelectedRoomId(response.data[0].id)
    }
  }, [selectedRoomId])

  const loadRoomMessages = useCallback(async (roomId: string) => {
    const response = await apiGet<ChatMessage[]>(`/v1/rooms/${roomId}/messages?limit=100`)
    setRoomMessages(response.data)
  }, [])

  const loadMyAgents = useCallback(async (authToken: string) => {
    const response = await apiGet<Agent[]>('/v1/me/agents', authToken)
    setMyAgents(response.data)
    if (!selectedAgentId && response.data.length > 0) {
      setSelectedAgentId(response.data[0].id)
    }
  }, [selectedAgentId])

  const loadGrowth = useCallback(async (agentId: string) => {
    const response = await apiGet<AgentGrowth>(`/v1/agents/${agentId}/growth`)
    setGrowth(response.data)
  }, [])

  const loadPrivateSessions = useCallback(async (agentId: string, authToken: string) => {
    const response = await apiGet<{ items: PrivateSession[] }>(`/v1/agents/${agentId}/chat/sessions`, authToken)
    const sessions = response.data.items
    setPrivateSessions(sessions)
    if (!selectedSessionId && sessions.length > 0) {
      const active = sessions.find((item) => item.status === 'ACTIVE')
      setSelectedSessionId((active ?? sessions[0]).id)
    }
  }, [selectedSessionId])

  const loadPrivateMessages = useCallback(async (sessionId: string, authToken: string) => {
    const response = await apiGet<{ items: PrivateMessage[] }>(
      `/v1/agents/_/chat/sessions/${sessionId}/messages?limit=100`,
      authToken,
    )
    setPrivateMessages(response.data.items)
  }, [])

  const refreshInitialData = useCallback(async () => {
    await Promise.all([loadFeed(), loadCommunities(), loadRooms()])
  }, [loadCommunities, loadFeed, loadRooms])

  useEffect(() => {
    void runTask('加载初始数据', refreshInitialData)
  }, [refreshInitialData, runTask])

  useEffect(() => {
    if (!selectedRoomId) return
    void runTask('加载房间消息', async () => {
      await loadRoomMessages(selectedRoomId)
    })
  }, [loadRoomMessages, runTask, selectedRoomId])

  useEffect(() => {
    void (async () => {
      const saved = await getStoredAuthToken()
      if (!saved) return
      setToken(saved)
      await runTask('恢复登录态', async () => {
        await loadMyAgents(saved)
      })
    })()
  }, [loadMyAgents, runTask])

  useEffect(() => {
    if (!selectedRoomId) return
    const close = openSseStream({
      rooms: [selectedRoomId],
      onEvent: (event: AppSseEvent) => {
        if (
          event.type === 'MESSAGE_CREATED'
          || event.type === 'ROOM_MEMBER_JOINED'
          || event.type === 'ROOM_MEMBER_LEFT'
        ) {
          void loadRoomMessages(selectedRoomId)
        }
      },
      onError: (message) => setError(`room_sse: ${message}`),
    })
    return close
  }, [loadRoomMessages, selectedRoomId])

  useEffect(() => {
    if (!token || !selectedSessionId || !selectedAgentId) return
    const close = openSseStream({
      sessions: [selectedSessionId],
      token,
      onEvent: (event: AppSseEvent) => {
        if (event.type === 'PRIVATE_MESSAGE_CREATED') {
          void loadPrivateMessages(selectedSessionId, token)
        }
        if (event.type === 'PRIVATE_SESSION_ENDED') {
          void loadPrivateMessages(selectedSessionId, token)
          void loadPrivateSessions(selectedAgentId, token)
        }
      },
      onError: (message) => setError(`private_sse: ${message}`),
    })
    return close
  }, [loadPrivateMessages, loadPrivateSessions, selectedAgentId, selectedSessionId, token])

  useEffect(() => {
    if (!token || !selectedAgentId) return
    void runTask('加载私聊会话', async () => {
      await loadPrivateSessions(selectedAgentId, token)
    })
  }, [loadPrivateSessions, runTask, selectedAgentId, token])

  useEffect(() => {
    if (!token || !selectedSessionId) return
    void runTask('加载私聊消息', async () => {
      await loadPrivateMessages(selectedSessionId, token)
    })
  }, [loadPrivateMessages, runTask, selectedSessionId, token])

  useEffect(() => {
    if (!selectedAgentId) return
    void runTask('加载成长数据', async () => {
      await loadGrowth(selectedAgentId)
    })
  }, [loadGrowth, runTask, selectedAgentId])

  const authSummary = useMemo(() => {
    if (!token) return '未登录（可匿名观演）'
    return `已登录（token ${token.slice(0, 8)}...）`
  }, [token])

  const handleLogin = useCallback(() => {
    void runTask('登录', async () => {
      const response = await apiPost<AuthResult>('/v1/auth/login', { email, password })
      const nextToken = response.data.token
      setToken(nextToken)
      await setStoredAuthToken(nextToken)
      await loadMyAgents(nextToken)
    })
  }, [email, loadMyAgents, password, runTask])

  const handleLogout = useCallback(() => {
    void runTask('退出登录', async () => {
      setToken(null)
      setMyAgents([])
      setSelectedAgentId(null)
      setPrivateSessions([])
      setSelectedSessionId(null)
      setPrivateMessages([])
      await clearStoredAuthToken()
    })
  }, [runTask])

  const handleCreateAgent = useCallback(() => {
    if (!token || !newAgentName.trim()) return
    void runTask('创建 Agent', async () => {
      await apiPost('/v1/agents', { display_name: newAgentName.trim() }, token)
      setNewAgentName('')
      await loadMyAgents(token)
    })
  }, [loadMyAgents, newAgentName, runTask, token])

  const handleCreateSession = useCallback(() => {
    if (!token || !selectedAgentId) return
    void runTask('创建私聊会话', async () => {
      const response = await apiPost<PrivateSession>(
        `/v1/agents/${selectedAgentId}/chat/sessions`,
        {},
        token,
      )
      setSelectedSessionId(response.data.id)
      await loadPrivateSessions(selectedAgentId, token)
      await loadPrivateMessages(response.data.id, token)
    })
  }, [loadPrivateMessages, loadPrivateSessions, runTask, selectedAgentId, token])

  const handleSendPrivateMessage = useCallback(() => {
    if (!token || !selectedAgentId || !selectedSessionId || !privateInput.trim()) return
    const content = privateInput.trim()
    void runTask('发送私聊消息', async () => {
      await apiPost(
        `/v1/agents/${selectedAgentId}/chat/sessions/${selectedSessionId}/messages`,
        { content },
        token,
      )
      setPrivateInput('')
      await loadPrivateMessages(selectedSessionId, token)
    })
  }, [loadPrivateMessages, privateInput, runTask, selectedAgentId, selectedSessionId, token])

  const handleEndSession = useCallback(() => {
    if (!token || !selectedAgentId || !selectedSessionId) return
    void runTask('结束私聊会话', async () => {
      await apiPost(`/v1/agents/${selectedAgentId}/chat/sessions/${selectedSessionId}/end`, {}, token)
      await loadPrivateSessions(selectedAgentId, token)
      await loadPrivateMessages(selectedSessionId, token)
    })
  }, [loadPrivateMessages, loadPrivateSessions, runTask, selectedAgentId, selectedSessionId, token])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Fun Forum AI App (P1 Baseline)</Text>
        <Text style={styles.subTitle}>API: {getApiBaseUrl()}</Text>
        <Text style={styles.subTitle}>认证: {authSummary}</Text>
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.tabRow}>
        {(['feed', 'rooms', 'agents', 'growth', 'private'] as AppTab[]).map((item) => (
          <Pressable
            key={item}
            style={[styles.tabButton, tab === item ? styles.tabButtonActive : null]}
            onPress={() => setTab(item)}
          >
            <Text style={styles.tabText}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!token ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>登录（用于养成与私聊）</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholder="email"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="password"
              style={styles.input}
            />
            <Pressable style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>登录并写入 SecureStore</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>已登录</Text>
            <Pressable style={styles.secondaryButton} onPress={handleLogout}>
              <Text>退出登录</Text>
            </Pressable>
          </View>
        )}

        {tab === 'feed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>观演（匿名可用）</Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={() => void runTask('刷新 feed', loadFeed)}>
                <Text>刷新 Feed</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void runTask('刷新社区', loadCommunities)}
              >
                <Text>刷新社区</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>社区</Text>
            {communities.map((community) => (
              <Text key={community.id} style={styles.itemText}>- {community.name} ({community.slug})</Text>
            ))}

            <Text style={styles.sectionTitle}>帖子</Text>
            {feedPosts.map((post) => (
              <Pressable
                key={post.id}
                style={styles.listRow}
                onPress={() => void runTask('加载帖子详情', async () => loadPostDetail(post.id))}
              >
                <Text style={styles.itemText}>{post.title}</Text>
                <Text style={styles.metaText}>{post.id}</Text>
              </Pressable>
            ))}

            {selectedPost ? (
              <View style={styles.detailBox}>
                <Text style={styles.sectionTitle}>帖子详情</Text>
                <Text style={styles.itemText}>{selectedPost.title}</Text>
                <Text style={styles.metaText}>{selectedPost.body}</Text>
              </View>
            ) : null}
          </View>
        )}

        {tab === 'rooms' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>聊天室（SSE，匿名可用）</Text>
            <Pressable style={styles.secondaryButton} onPress={() => void runTask('刷新房间', loadRooms)}>
              <Text>刷新房间</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>房间列表</Text>
            <FlatList
              data={rooms}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listRow}
                  onPress={() => {
                    setSelectedRoomId(item.id)
                    void runTask('加载房间消息', async () => {
                      await loadRoomMessages(item.id)
                    })
                  }}
                >
                  <Text style={styles.itemText}>{item.name}</Text>
                  <Text style={styles.metaText}>{item.status}</Text>
                </Pressable>
              )}
              scrollEnabled={false}
            />

            <Text style={styles.sectionTitle}>房间详情 / 消息</Text>
            {roomMessages.map((message) => (
              <View key={message.id} style={styles.messageRow}>
                <Text style={styles.metaText}>{message.author_id}</Text>
                <Text style={styles.itemText}>{message.body}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'agents' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>养成入口（登录后）</Text>
            {!token ? (
              <Text style={styles.metaText}>请先登录</Text>
            ) : (
              <>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void runTask('刷新我的 Agent', async () => {
                      await loadMyAgents(token)
                    })}
                  >
                    <Text>刷新我的 Agent</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={newAgentName}
                  onChangeText={setNewAgentName}
                  placeholder="新 Agent 名称"
                  style={styles.input}
                />
                <Pressable style={styles.primaryButton} onPress={handleCreateAgent}>
                  <Text style={styles.primaryButtonText}>创建 Agent</Text>
                </Pressable>

                {myAgents.map((agent) => (
                  <Pressable
                    key={agent.id}
                    style={styles.listRow}
                    onPress={() => setSelectedAgentId(agent.id)}
                  >
                    <Text style={styles.itemText}>{agent.display_name}</Text>
                    <Text style={styles.metaText}>{agent.status}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {tab === 'growth' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>基础成长视图</Text>
            {!selectedAgentId ? (
              <Text style={styles.metaText}>请先在 AGENTS 页选择一个 Agent</Text>
            ) : (
              <>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => void runTask('刷新成长', async () => {
                    await loadGrowth(selectedAgentId)
                  })}
                >
                  <Text>刷新成长</Text>
                </Pressable>

                {growth ? (
                  <View style={styles.detailBox}>
                    <Text style={styles.itemText}>Agent: {selectedAgentId}</Text>
                    <Text style={styles.itemText}>Level: {growth.level}</Text>
                    <Text style={styles.itemText}>XP: {growth.xp}</Text>
                    <Text style={styles.itemText}>Trait Slots: {growth.trait_slots}</Text>
                    <Text style={styles.itemText}>Instruction Slots: {growth.instruction_slots}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}

        {tab === 'private' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>私聊（SSE，强鉴权）</Text>
            {!token ? (
              <Text style={styles.metaText}>请先登录</Text>
            ) : !selectedAgentId ? (
              <Text style={styles.metaText}>请先在 AGENTS 页选择一个 Agent</Text>
            ) : (
              <>
                <View style={styles.buttonRow}>
                  <Pressable style={styles.secondaryButton} onPress={handleCreateSession}>
                    <Text>创建/复用会话</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void runTask('刷新会话', async () => {
                      await loadPrivateSessions(selectedAgentId, token)
                    })}
                  >
                    <Text>刷新会话</Text>
                  </Pressable>
                </View>

                {privateSessions.map((session) => (
                  <Pressable
                    key={session.id}
                    style={styles.listRow}
                    onPress={() => setSelectedSessionId(session.id)}
                  >
                    <Text style={styles.itemText}>{session.id}</Text>
                    <Text style={styles.metaText}>{session.status}</Text>
                  </Pressable>
                ))}

                <View style={styles.detailBox}>
                  <Text style={styles.sectionTitle}>消息</Text>
                  {privateMessages.map((message) => (
                    <View key={message.id} style={styles.messageRow}>
                      <Text style={styles.metaText}>{message.author_type}</Text>
                      <Text style={styles.itemText}>{message.content}</Text>
                    </View>
                  ))}
                </View>

                <TextInput
                  value={privateInput}
                  onChangeText={setPrivateInput}
                  placeholder="输入私聊消息"
                  style={styles.input}
                />
                <View style={styles.buttonRow}>
                  <Pressable style={styles.primaryButton} onPress={handleSendPrivateMessage}>
                    <Text style={styles.primaryButtonText}>发送</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handleEndSession}>
                    <Text>结束会话</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#111827',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subTitle: {
    color: '#d1d5db',
    fontSize: 12,
    marginTop: 2,
  },
  busyRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busyText: {
    color: '#c7d2fe',
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: '#fecaca',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  tabButtonActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  listRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  itemText: {
    color: '#111827',
    fontSize: 13,
  },
  metaText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  detailBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  messageRow: {
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 6,
  },
})
