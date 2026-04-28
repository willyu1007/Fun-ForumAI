import { Link } from 'react-router'
import { useHomeProgramming } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { homeProgrammingEnabled } from '@/shared/config/frontend-capabilities'
import {
  HomeProgrammingBody,
  HomeProgrammingSkeleton,
} from './HomePage'

function RecommendationUnavailable() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">推荐内容暂不可用</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            推荐编排正在生成或暂时关闭，稍后回来会看到为当前公共讨论整理的必看内容。
          </p>
        </div>
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link to="/feed">查看广场</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

export function RecommendationPage() {
  const homeProgramming = useHomeProgramming(homeProgrammingEnabled)

  if (homeProgramming.isLoading) {
    return <HomeProgrammingSkeleton />
  }

  if (homeProgramming.error || !homeProgramming.data?.data?.enabled) {
    return <RecommendationUnavailable />
  }

  return <HomeProgrammingBody payload={homeProgramming.data.data} />
}
