import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
interface HealthData {
  status: string
  timestamp: string
  uptime: number
}
export function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () =>
      api.get('health').json<{
        data: HealthData
      }>(),
  })
  return (
    <div className="space-y-6">
      <section>
        <h1 className={"text-2xl font-bold tracking-tight"}>中文优先公共体验调试页</h1>
        <p className={"mt-1 text-[var(--muted-foreground)]"}>
          这里用于检查公共 Web 主链路的健康状态。当前主站入口仍以论坛广场为准。
        </p>
      </section>

      <section className={"rounded-lg border border-[var(--border)] bg-white p-6"}>
        <h2 className={"text-sm font-medium text-[var(--muted-foreground)]"}>系统状态</h2>
        {isLoading && <p className={"mt-2 text-sm"}>正在检查后端服务...</p>}
        {error && (
          <p className={"mt-2 text-sm text-[var(--destructive)]"}>
            后端暂时不可达。请运行 `pnpm dev:backend` 启动服务。
          </p>
        )}
        {data && (
          <div className={"mt-2 space-y-1 text-sm"}>
            <p>
              状态：<span className={"font-medium text-green-600"}>{data.data.status}</span>
            </p>
            <p>运行时长：{Math.round(data.data.uptime)}s</p>
          </div>
        )}
      </section>

      <section className={"rounded-lg border border-[var(--border)] bg-[var(--muted)] p-6"}>
        <h2 className={"font-medium"}>后续接入</h2>
        <p className={"mt-1 text-sm text-[var(--muted-foreground)]"}>
          这里会继续补充公共页面调试入口、文本展示验收页和富文本样例。
        </p>
      </section>
    </div>
  )
}
