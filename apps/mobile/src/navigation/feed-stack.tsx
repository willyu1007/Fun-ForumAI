import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { apiGet } from '../api/client'
import type { Community, FeedPost } from '../api/types'
import { shared } from '../components/shared-styles'
import type { FeedStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<FeedStackParams>()

function FeedListScreen({ navigation }: NativeStackScreenProps<FeedStackParams, 'FeedList'>) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [feedR, commR] = await Promise.all([
        apiGet<FeedPost[]>('/v1/feed'),
        apiGet<Community[]>('/v1/communities'),
      ])
      setPosts(feedR.data)
      setCommunities(commR.data)
    } catch { /* handled at screen level */ }
    setBusy(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>观演（匿名可用）</Text>
      <Pressable style={[shared.secondaryButton, busy ? shared.disabled : null]} onPress={() => void refresh()} disabled={busy}>
        <Text>刷新</Text>
      </Pressable>

      <Text style={shared.sectionTitle}>社区</Text>
      {communities.length === 0
        ? <Text style={shared.emptyText}>暂无社区</Text>
        : communities.map((c) => <Text key={c.id} style={shared.itemText}>- {c.name} ({c.slug})</Text>)}

      <Text style={shared.sectionTitle}>帖子</Text>
      {posts.length === 0
        ? <Text style={shared.emptyText}>暂无帖子</Text>
        : posts.map((p) => (
            <Pressable key={p.id} style={shared.listRow} onPress={() => navigation.navigate('PostDetail', { postId: p.id })}>
              <Text style={shared.itemText}>{p.title}</Text>
              <Text style={shared.metaText}>{p.id}</Text>
            </Pressable>
          ))}
    </ScrollView>
  )
}

function PostDetailScreen({ route }: NativeStackScreenProps<FeedStackParams, 'PostDetail'>) {
  const [post, setPost] = useState<FeedPost | null>(null)
  useEffect(() => {
    void apiGet<FeedPost>(`/v1/posts/${route.params.postId}`).then((r) => setPost(r.data))
  }, [route.params.postId])

  if (!post) return <View style={shared.card}><Text style={shared.emptyText}>加载中…</Text></View>

  return (
    <ScrollView contentContainerStyle={shared.card}>
      <Text style={shared.cardTitle}>{post.title}</Text>
      <Text style={shared.itemText}>{post.body}</Text>
      <Text style={shared.metaText}>{post.created_at}</Text>
    </ScrollView>
  )
}

export function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="FeedList" component={FeedListScreen} options={{ title: '观演' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '帖子详情' }} />
    </Stack.Navigator>
  )
}
