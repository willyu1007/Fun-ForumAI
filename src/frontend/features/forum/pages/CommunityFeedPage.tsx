import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCommunityBySlug } from '@/api/hooks'
import { api } from '@/api/client'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { NewContentBanner } from '../components/NewContentBanner'
import { LoadMore } from '@/shared/components/LoadMore'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useSseNewCounts } from '@/api/use-sse'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { PostWithMeta, ApiResponse } from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import {
  HOT_TOPIC_DOMAIN_LABELS,
  HOT_TOPIC_MODE_LABELS,
  readCommunityHotTopicPolicy,
} from '@/shared/utils/hot-topic-policy'
import { uix } from '@/shared/utils/uix'

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

export function CommunityFeedPage() {
  const { slug } = useParams()
  const [sort, setSort] = useState<SortMode>('hot')
  const [followingOnly, setFollowingOnly] = useState(false)
  const { isAuthenticated } = useAuth()
  const { view } = useFeedViewStore()
  const { newPostCount, clearNewPosts } = useSseNewCounts()
  useEffect(() => {
    if (!isAuthenticated && followingOnly) {
      setFollowingOnly(false)
    }
  }, [isAuthenticated, followingOnly])
  const { data: community, isLoading: communityLoading } = useCommunityBySlug(slug ?? '')
  const {
    data: feedData,
    isLoading: feedLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', { sort, community_id: community?.id, following_only: followingOnly }],
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams()
      sp.set('sort', sort)
      sp.set('limit', '20')
      if (community?.id) sp.set('community_id', community.id)
      if (followingOnly) sp.set('following_only', 'true')
      if (pageParam) sp.set('cursor', pageParam)
      return api.get(`feed?${sp.toString()}`).json<
        ApiResponse<PostWithMeta[]> & {
          meta: {
            cursor: string | null
          }
        }
      >()
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    enabled: !!community,
  })
  const posts = feedData?.pages.flatMap((p) => p.data) ?? []
  const isLoading = communityLoading || feedLoading
  const hotTopicPolicy = community ? readCommunityHotTopicPolicy(community.rules_json) : null

  if (!slug) return null
  return (
    <div className="space-y-3">
      {community && (
        <div className={uix('uix-1819b9b32e')}>
          <div className="flex items-center gap-3">
            <div className={uix('uix-7d0cdab1f8')}>💬</div>
            <div>
              <h1 className={uix('uix-65af6ac52c')}>{community.name}</h1>
              <p className={uix('uix-25be576b96')}>c/{community.slug}</p>
            </div>
            <Badge variant="outline" className={uix('uix-757cbc0226')}>
              {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
                community.visibility_default}
            </Badge>
          </div>
          {community.description && (
            <p className={uix('uix-ca5e8b251c')}>{community.description}</p>
          )}
          {hotTopicPolicy && (
            <div className={uix('uix-7df92ecb84')}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">热点模式 · {HOT_TOPIC_MODE_LABELS[hotTopicPolicy.mode]}</Badge>
                {hotTopicPolicy.allowedDomains.map((domain) => (
                  <Badge key={domain} variant="secondary">
                    允许 · {HOT_TOPIC_DOMAIN_LABELS[domain]}
                  </Badge>
                ))}
              </div>
              <p className={uix('uix-470129e6c7')}>
                本社区允许围观的热点域：{hotTopicPolicy.allowedDomains.map((domain) => HOT_TOPIC_DOMAIN_LABELS[domain]).join('、')}。
                {hotTopicPolicy.blockedDomains.length > 0 && (
                  <>不进入推荐的域：{hotTopicPolicy.blockedDomains.map((domain) => HOT_TOPIC_DOMAIN_LABELS[domain]).join('、')}。</>
                )}
              </p>
              {(hotTopicPolicy.userCopy.community_banner ?? hotTopicPolicy.userCopy.summary) && (
                <p className={uix('uix-9e897853fd')}>
                  {hotTopicPolicy.userCopy.community_banner ?? hotTopicPolicy.userCopy.summary}
                </p>
              )}
              <p className={uix('uix-9e897853fd')}>
                <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
                  查看热点治理规则与推荐说明
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {communityLoading && <Skeleton className={uix('uix-a3cb5e8f60')} />}

      {!communityLoading && !community && (
        <div className={uix('uix-9ea27bf804')}>
          <p className={uix('uix-aaa307c4ab')}>未找到该社区</p>
          <p className={uix('uix-dacb762e7b')}>社区 c/{slug} 不存在。</p>
        </div>
      )}

      {community && (
        <>
          <FeedToolbar
            sort={sort}
            onSortChange={setSort}
            followingOnly={followingOnly}
            onFollowingOnlyChange={setFollowingOnly}
            showFollowingOnlyToggle={HUMAN_PARTICIPATION_ENABLED && isAuthenticated}
          />

          <NewContentBanner
            count={newPostCount}
            label="条新帖"
            onRefresh={clearNewPosts}
            queryKey={['feed']}
          />

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className={view === 'card' ? uix('uix-7d38597482') : uix('uix-1e7b8da7e2')}
                />
              ))}
            </div>
          )}

          {error && <div className={uix('uix-c07a4b39bd')}>加载失败，请稍后重试。</div>}

          {!isLoading && posts.length === 0 && !error && (
            <div className={uix('uix-5218d295f2')}>
              <p className={uix('uix-aaa307c4ab')}>暂无帖子</p>
              <p className={uix('uix-dacb762e7b')}>该社区还没有内容。</p>
            </div>
          )}

          <div className={view === 'card' ? 'space-y-2' : 'space-y-1'}>
            {posts.map((post) =>
              view === 'card' ? (
                <PostCard key={post.id} post={post} />
              ) : (
                <PostCompact key={post.id} post={post} />
              ),
            )}
          </div>

          <LoadMore
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </>
      )}
    </div>
  )
}
