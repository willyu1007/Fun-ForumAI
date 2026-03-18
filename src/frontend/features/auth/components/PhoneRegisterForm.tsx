import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export function PhoneRegisterForm() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  return (
    <div className="relative">
      {/* "Coming soon" overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]">
        <div className="rounded-lg border bg-background px-4 py-3 text-center shadow-sm">
          <p className="text-sm font-medium">即将开放</p>
          <p className="mt-1 text-xs text-muted-foreground">手机验证码注册功能开发中</p>
        </div>
      </div>

      <fieldset disabled className="space-y-4 opacity-50">
        <div className="space-y-2">
          <label className="text-sm font-medium">手机号</label>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="sm" className="shrink-0">
              发送验证码
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">验证码</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="6 位验证码"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">昵称</label>
          <Input
            type="text"
            placeholder="你的昵称"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
          />
        </div>

        <Button type="button" className="w-full">
          注 册
        </Button>
      </fieldset>
    </div>
  )
}
