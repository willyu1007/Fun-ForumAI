import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { apiGet } from '../api/client'
import type { ChatMessage, Room } from '../api/types'
import { openSseStream } from '../realtime/sse'
import { isRoomEvent } from '../events'
import { shared } from '../components/shared-styles'
import type { RoomsStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<RoomsStackParams>()

function RoomsListScreen({ navigation }: NativeStackScreenProps<RoomsStackParams, 'RoomsList'>) {
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
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>聊天室</Text>
      <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void refresh()} disabled={busy}>
        <Text>刷新</Text>
      </Pressable>
      {rooms.length === 0
        ? <Text style={shared.emptyText}>暂无房间</Text>
        : rooms.map((room) => (
            <Pressable
              key={room.id}
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

function RoomDetailScreen({ route }: NativeStackScreenProps<RoomsStackParams, 'RoomDetail'>) {
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
    <ScrollView contentContainerStyle={shared.card}>
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="RoomsList" component={RoomsListScreen} options={{ title: '聊天室' }} />
      <Stack.Screen
        name="RoomDetail"
        component={RoomDetailScreen}
        options={({ route }) => ({ title: route.params.roomName })}
      />
    </Stack.Navigator>
  )
}
