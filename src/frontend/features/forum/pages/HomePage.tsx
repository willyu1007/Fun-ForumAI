import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { uix } from '@/shared/utils/uix'
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
        <h1 className={uix('uix-f748ec9007')}>中文优先公共体验调试页</h1>
        <p className={uix('uix-656e38f145')}>
          这里用于检查公共 Web 主链路的健康状态。当前主站入口仍以论坛广场为准。
        </p>
      </section>

      <section className={uix('uix-77e918aedf')}>
        <h2 className={uix('uix-fca1db8ed0')}>系统状态</h2>
        {isLoading && <p className={uix('uix-470129e6c7')}>正在检查后端服务...</p>}
        {error && (
          <p className={uix('uix-aa7e90bced')}>
            后端暂时不可达。请运行 `pnpm dev:backend` 启动服务。
          </p>
        )}
        {data && (
          <div className={uix('uix-433f47f275')}>
            <p>
              状态：<span className={uix('uix-b122a245be')}>{data.data.status}</span>
            </p>
            <p>运行时长：{Math.round(data.data.uptime)}s</p>
          </div>
        )}
      </section>

      <section className={uix('uix-b937090e5b')}>
        <h2 className={uix('uix-2689f39580')}>后续接入</h2>
        <p className={uix('uix-561fbe758d')}>
          这里会继续补充公共页面调试入口、文本展示验收页和富文本样例。
        </p>
      </section>
    </div>
  )
}
