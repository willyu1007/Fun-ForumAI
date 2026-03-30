import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCreateReport, useFollowAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type { PostWithMeta } from '@/api/types'

type FeedbackTone = 'default' | 'success' | 'error'

interface PostActionFeedback {
  message: string
  tone: FeedbackTone
}

interface PostSurfaceActionsResult {
  feedback: PostActionFeedback | null
  followAgentPending: boolean
  reportPending: boolean
  isFollowedAgent: boolean
  isFollowedPost: boolean
  isHidden: boolean
  isReported: boolean
  followAgentLabel: string
  followPostLabel: string
  reportLabel: string
  handleFollowAgent: () => Promise<void>
  handleFollowPost: () => void
  handleHidePost: () => void
  handleReportPost: () => Promise<void>
  handleUndoHide: () => void
}

const STORAGE_NAMESPACE = 'forum-post-actions'

function readStoredSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeStoredSet(key: string, values: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify([...values]))
}

function appendStoredValue(key: string, value: string) {
  const next = readStoredSet(key)
  next.add(value)
  writeStoredSet(key, next)
}

function removeStoredValue(key: string, value: string) {
  const next = readStoredSet(key)
  next.delete(value)
  writeStoredSet(key, next)
}

function buildScopedKey(userId: string | null | undefined, suffix: string) {
  return `${STORAGE_NAMESPACE}:${userId ?? 'anonymous'}:${suffix}`
}

export function usePostSurfaceActions(post: PostWithMeta): PostSurfaceActionsResult {
  const { isAuthenticated, user } = useAuth()
  const followAgent = useFollowAgent(post.author.id)
  const createReport = useCreateReport()
  const [feedback, setFeedback] = useState<PostActionFeedback | null>(null)
  const [isFollowedPost, setIsFollowedPost] = useState(false)
  const [isFollowedAgent, setIsFollowedAgent] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isReported, setIsReported] = useState(false)

  const storageKeys = useMemo(() => ({
    followedPosts: buildScopedKey(user?.id, 'followed-posts'),
    followedAgents: buildScopedKey(user?.id, 'followed-agents'),
    hiddenPosts: buildScopedKey(user?.id, 'hidden-posts'),
  }), [user?.id])

  useEffect(() => {
    setIsFollowedPost(readStoredSet(storageKeys.followedPosts).has(post.id))
    setIsFollowedAgent(readStoredSet(storageKeys.followedAgents).has(post.author.id))
    setIsHidden(readStoredSet(storageKeys.hiddenPosts).has(post.id))
    setIsReported(false)
    setFeedback(null)
  }, [post.author.id, post.id, storageKeys.followedAgents, storageKeys.followedPosts, storageKeys.hiddenPosts])

  const handleFollowPost = useCallback(() => {
    if (isFollowedPost) {
      setFeedback({ message: '已关注此帖，后续会优先出现在你的阅读流。', tone: 'success' })
      return
    }
    appendStoredValue(storageKeys.followedPosts, post.id)
    setIsFollowedPost(true)
    setFeedback({ message: '已关注帖子，后续更新会优先展示。', tone: 'success' })
  }, [isFollowedPost, post.id, storageKeys.followedPosts])

  const handleFollowAgent = useCallback(async () => {
    if (!isAuthenticated) {
      setFeedback({ message: '登录后可以关注 Agent。', tone: 'default' })
      return
    }
    if (isFollowedAgent) {
      setFeedback({ message: `已关注 ${post.author.display_name}。`, tone: 'success' })
      return
    }
    try {
      await followAgent.mutateAsync()
      appendStoredValue(storageKeys.followedAgents, post.author.id)
      setIsFollowedAgent(true)
      setFeedback({ message: `已关注 ${post.author.display_name}。`, tone: 'success' })
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : '关注失败，请稍后重试。', tone: 'error' })
    }
  }, [
    followAgent,
    isAuthenticated,
    isFollowedAgent,
    post.author.display_name,
    post.author.id,
    storageKeys.followedAgents,
  ])

  const handleHidePost = useCallback(() => {
    appendStoredValue(storageKeys.hiddenPosts, post.id)
    setIsHidden(true)
  }, [post.id, storageKeys.hiddenPosts])

  const handleUndoHide = useCallback(() => {
    removeStoredValue(storageKeys.hiddenPosts, post.id)
    setIsHidden(false)
    setFeedback({ message: '已恢复帖子。', tone: 'success' })
  }, [post.id, storageKeys.hiddenPosts])

  const handleReportPost = useCallback(async () => {
    if (!isAuthenticated) {
      setFeedback({ message: '登录后可以举报帖子。', tone: 'default' })
      return
    }
    if (isReported) {
      setFeedback({ message: '举报已提交，可在“举报与申诉”页查看进度。', tone: 'success' })
      return
    }
    try {
      await createReport.mutateAsync({
        target_type: 'post',
        target_id: post.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'viewer_report',
        detail_text: `Reported from post surface: ${post.id}`,
      })
      setIsReported(true)
      setFeedback({ message: '举报已提交，可在“举报与申诉”页查看进度。', tone: 'success' })
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : '举报提交失败，请稍后重试。', tone: 'error' })
    }
  }, [createReport, isAuthenticated, isReported, post.id])

  return {
    feedback,
    followAgentPending: followAgent.isPending,
    reportPending: createReport.isPending,
    isFollowedAgent,
    isFollowedPost,
    isHidden,
    isReported,
    followAgentLabel: isFollowedAgent ? '已关注 Agent' : '关注 Agent',
    followPostLabel: isFollowedPost ? '已关注帖子' : '关注帖子',
    reportLabel: isReported ? '已举报' : createReport.isPending ? '提交中…' : '举报',
    handleFollowAgent,
    handleFollowPost,
    handleHidePost,
    handleReportPost,
    handleUndoHide,
  }
}
