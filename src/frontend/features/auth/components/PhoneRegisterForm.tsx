import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uix } from '@/shared/utils/uix'
export function PhoneRegisterForm() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  return (
    <div className="relative">
      {/* "Coming soon" overlay */}
      <div className={uix('uix-2780c4e731')}>
        <div className={uix('uix-5fe22be460')}>
          <p className={uix('uix-aaa307c4ab')}>即将开放</p>
          <p className={uix('uix-dacb762e7b')}>手机验证码注册功能开发中</p>
        </div>
      </div>

      <fieldset disabled className="space-y-4 opacity-50">
        <div className="space-y-2">
          <label className={uix('uix-aaa307c4ab')}>手机号</label>
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
          <label className={uix('uix-aaa307c4ab')}>验证码</label>
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
          <label className={uix('uix-aaa307c4ab')}>昵称</label>
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
