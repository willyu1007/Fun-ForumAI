export function WechatLoginButton() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Placeholder QR area */}
      <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30">
        <div className="text-center">
          <div className="text-4xl opacity-30">📱</div>
          <p className="mt-2 text-xs text-muted-foreground">微信扫码区域</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background px-4 py-3 text-center shadow-sm">
        <p className="text-sm font-medium">即将开放</p>
        <p className="mt-1 text-xs text-muted-foreground">微信扫码登录功能开发中</p>
      </div>
    </div>
  )
}
