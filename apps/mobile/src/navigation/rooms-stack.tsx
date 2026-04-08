import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '@fun-forum/ui-mobile/theme'
import { apiGet } from '../api/client'
import type { ChatMessage, Room } from '../api/types'
import { openSseStream } from '../realtime/sse'
import { isRoomEvent } from '../events'
import { shared } from '../components/shared-styles'
import { isMobileChatroomStagingHoldEnabled } from '../config/mobile-flags'
import { testIDs } from '../testing/test-ids'
import type { RoomsStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<RoomsStackParams>()
const CHATROOM_HIGHLIGHTS = [
  '流式实时感',
  '稳定组局密度',
  '直播型 UI/UX',
  '可验证的模型时延',
] as const

function ChatroomHoldScreen() {
  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.rooms.holdScreen}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radius.md,
          padding: spacing[4],
          backgroundColor: colors.surfaceElevated,
          gap: spacing[3],
        }}
      >
        <Text
          style={{
            fontSize: typography.size.caption,
            color: colors.primary,
            fontWeight: '700',
            letterSpacing: 0.4,
          }}
        >
          STAGING · 敬请期待
        </Text>
        <Text style={shared.cardTitle}>聊天室正在做重开前打磨</Text>
        <Text style={[shared.metaText, { marginTop: 0, lineHeight: 20 }]}>
          当前 staging 暂不开放 Mobile 聊天室主功能。我们会先补齐实时感、组局密度、围观体验和模型时延验证，再重新开放灰度。
        </Text>
      </View>

      <View style={{ gap: spacing[2] }}>
        {CHATROOM_HIGHLIGHTS.map((item) => (
          <View
            key={item}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              backgroundColor: colors.surface,
            }}
          >
            <Text style={[shared.itemText, { fontWeight: '600' }]}>{item}</Text>
          </View>
        ))}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: radius.sm,
          padding: spacing[3],
          gap: spacing[2],
        }}
      >
        <Text style={[shared.itemText, { fontWeight: '600' }]}>当前阶段只保留内部验证链路</Text>
        <Text style={[shared.metaText, { marginTop: 0, lineHeight: 20 }]}>
          等聊天室体验达到重开标准后，会再次开放给 staging 用户预览。
        </Text>
      </View>
    </ScrollView>
  )
}

function RoomsListLiveScreen({ navigation }: NativeStackScreenProps<RoomsStackParams, 'RoomsList'>) {
  const isFocused = useIsFocused()
  const [rooms, setRooms] = useState<Room[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const r = await apiGet<Room[]>('/v1/rooms')
      setRooms(r.data)
    } catch { /* */ }
    setBusy(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.rooms.listScreen}>
      {__DEV__ && isFocused ? <Text testID={testIDs.rooms.focusedMarker} style={shared.metaText}>当前页: 聊天室</Text> : null}
      <Text style={shared.cardTitle}>聊天室</Text>
      <Pressable
        testID={testIDs.rooms.refreshButton}
        style={[shared.secondaryButton, busy ? shared.disabled : null]}
        onPress={() => void refresh()}
        disabled={busy}
      >
        <Text>刷新</Text>
      </Pressable>
      {rooms.length === 0
        ? <Text style={shared.emptyText}>暂无房间</Text>
        : rooms.map((room) => (
            <Pressable
              key={room.id}
              accessible
              accessibilityLabel={`打开房间 ${room.name} ${room.status}`}
              accessibilityRole="button"
              style={shared.listRow}
              onPress={() => navigation.navigate('RoomDetail', { roomId: room.id, roomName: room.name })}
            >
              <Text style={shared.itemText}>{room.name}</Text>
              <Text style={shared.metaText}>{room.status}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

function RoomDetailLiveScreen({ route }: NativeStackScreenProps<RoomsStackParams, 'RoomDetail'>) {
  const { roomId } = route.params
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const loadMessages = useCallback(async () => {
    try {
      const r = await apiGet<ChatMessage[]>(`/v1/rooms/${roomId}/messages?limit=100`)
      setMessages(r.data)
    } catch { /* */ }
  }, [roomId])

  useEffect(() => { void loadMessages() }, [loadMessages])

  useEffect(() => {
    return openSseStream({
      rooms: [roomId],
      onEvent: (e) => { if (isRoomEvent(e)) void loadMessages() },
    })
  }, [loadMessages, roomId])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.rooms.detailScreen}>
      {messages.length === 0
        ? <Text style={shared.emptyText}>暂无消息</Text>
        : messages.map((msg) => (
            <View key={msg.id} style={shared.messageRow}>
              <Text style={shared.metaText}>{msg.author_id}</Text>
              <Text style={shared.itemText}>{msg.body}</Text>
            </View>
          ))}
    </ScrollView>
  )
}

export function RoomsStack() {
  const chatroomHoldEnabled = isMobileChatroomStagingHoldEnabled()
  const roomsListComponent = chatroomHoldEnabled ? ChatroomHoldScreen : RoomsListLiveScreen
  const roomDetailComponent = chatroomHoldEnabled ? ChatroomHoldScreen : RoomDetailLiveScreen

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="RoomsList" component={roomsListComponent} options={{ title: '聊天室' }} />
      <Stack.Screen
        name="RoomDetail"
        component={roomDetailComponent}
        options={({ route }) => ({ title: chatroomHoldEnabled ? '聊天室' : route.params.roomName })}
      />
    </Stack.Navigator>
  )
}
