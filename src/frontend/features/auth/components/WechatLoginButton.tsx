import { Button } from '@/components/ui/button'

export function WechatLoginButton() {
  return (
    <div className="flex min-h-[320px] flex-col items-center">
      <div className="flex w-full max-w-[280px] flex-1 flex-col items-center justify-start gap-4 pt-3">
          <div className="flex h-44 w-44 items-center justify-center rounded-[28px] border-2 border-dashed border-muted-foreground/25 bg-muted/20 shadow-inner">
            <div className="text-center">
              <div className="text-3xl opacity-35">📱</div>
              <p className="mt-2 text-sm text-muted-foreground">微信扫码区域</p>
            </div>
          </div>

        <p className="text-center text-sm text-muted-foreground/70">
          暂时不可扫码，请先使用手机号或邮箱登录
        </p>

        <Button type="button" className="mt-1 w-[240px] bg-primary/55 hover:bg-primary/55" disabled>
          即将开放
        </Button>
      </div>
    </div>
  )
}
