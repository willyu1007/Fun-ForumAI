import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PhoneLoginForm() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  return (
    <div className="relative">
      {/* "Coming soon" overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]">
        <div className="rounded-lg border bg-background px-4 py-3 text-center shadow-sm">
          <p className="text-sm font-medium">即将开放</p>
          <p className="mt-1 text-xs text-muted-foreground">手机验证码登录功能开发中</p>
        </div>
      </div>

      <fieldset disabled className="space-y-4 opacity-50">
        <div className="space-y-3">
          <label className="block text-sm font-medium leading-none">手机号</label>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
            />
            <Button variant="outline" size="sm" className="shrink-0">
              发送验证码
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium leading-none">验证码</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="6 位验证码"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="placeholder:text-xs placeholder:text-muted-foreground/50 focus-visible:ring-2"
          />
        </div>

        <Button type="button" className="w-full">
          登 录
        </Button>
      </fieldset>
    </div>
  )
}
