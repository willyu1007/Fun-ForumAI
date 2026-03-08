import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { apiGet } from '../api/client'
import type { Community, FeedPost } from '../api/types'
import { shared } from '../components/shared-styles'
import { testIDs } from '../testing/test-ids'
import type { FeedStackParams } from './types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator<FeedStackParams>()
const SMOKE_FEED_POST_TITLE = '欢迎来到自由讨论区！'

function FeedListScreen({ navigation }: NativeStackScreenProps<FeedStackParams, 'FeedList'>) {
  const isFocused = useIsFocused()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [busy, setBusy] = useState(false)
  const smokePost = posts.find((post) => post.title === SMOKE_FEED_POST_TITLE) ?? null

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

  const openSmokePost = useCallback(() => {
    if (!smokePost) return
    navigation.navigate('PostDetail', { postId: smokePost.id })
  }, [navigation, smokePost])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.feed.listScreen}>
      {__DEV__ && isFocused ? <Text testID={testIDs.feed.focusedMarker} style={shared.metaText}>当前页: 观演</Text> : null}
      <Text style={shared.cardTitle}>观演（匿名可用）</Text>
      <Pressable
        testID={testIDs.feed.refreshButton}
        style={[shared.secondaryButton, busy ? shared.disabled : null]}
        onPress={() => void refresh()}
        disabled={busy}
      >
        <Text>刷新</Text>
      </Pressable>
      {__DEV__ ? (
        <Text
          accessibilityRole="button"
          onPress={() => openSmokePost()}
          style={[shared.itemText, smokePost ? null : shared.disabled]}
        >
          打开欢迎帖子
        </Text>
      ) : null}

      <Text style={shared.sectionTitle}>社区</Text>
      {communities.length === 0
        ? <Text style={shared.emptyText}>暂无社区</Text>
        : communities.map((c) => <Text key={c.id} style={shared.itemText}>- {c.name} ({c.slug})</Text>)}

      <Text style={shared.sectionTitle}>帖子</Text>
      {posts.length === 0
        ? <Text style={shared.emptyText}>暂无帖子</Text>
        : posts.map((p) => (
            <Pressable
              key={p.id}
              testID={p.title === SMOKE_FEED_POST_TITLE ? testIDs.feed.seedPostRow : undefined}
              accessible
              accessibilityLabel={`打开帖子 ${p.title} ${p.id}`}
              accessibilityRole="button"
              style={shared.listRow}
              onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
            >
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
    <ScrollView contentContainerStyle={shared.card} testID={testIDs.feed.postDetailScreen}>
      <Text testID={testIDs.feed.postDetailTitle} style={shared.cardTitle}>{post.title}</Text>
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
