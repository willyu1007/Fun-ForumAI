import { useState } from 'react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'

const navGroups = [
  {
    title: '内容生产',
    items: [
      { href: '/admin/programming', label: '内容编排与排期' },
      { href: '/admin/cue-board', label: 'Cue Board (T-209)' },
      { href: '/admin/media-prompts', label: '文生图场景与提示词' },
      { href: '/admin/warmup', label: '预热与启动' },
    ]
  },
  {
    title: '治理与风控',
    items: [
      { href: '/admin/governance', label: '社区与内容治理' },
      { href: '/admin/hot-topic', label: '热门话题风控' },
    ]
  },
  {
    title: '状态与运维',
    items: [
      { href: '/admin/runtime', label: '系统运行状态' },
    ]
  },
  {
    title: '平台管理',
    items: [
      { href: '/admin/admins', label: '管理员权限' },
      { href: '/admin/invites', label: '邀请码管理' },
      { href: '/admin/feedback', label: '意见箱' },
    ]
  }
]

function NavGroup({ group }: { group: typeof navGroups[0] }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div data-ui="stack" data-direction="col" data-gap="1" className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-2 py-1 text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground"
      >
        <span data-ui="text" data-variant="label">{group.title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div data-ui="stack" data-direction="col" data-gap="1" className="pl-2">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminSidebar() {
  return (
    <div className="flex h-full flex-col border-r bg-muted/10">
      <div className="p-4">
        <h2 className="text-lg font-bold tracking-tight" data-ui="text" data-variant="h3">管理控制台</h2>
      </div>
      
      <nav data-ui="nav" data-variant="admin-sidebar" className="flex-1 overflow-y-auto px-2 py-4">
        {navGroups.map((group) => (
          <NavGroup key={group.title} group={group} />
        ))}
      </nav>

      <div className="p-4 border-t">
        <NavLink
          to="/"
          className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回主页
        </NavLink>
      </div>
    </div>
  )
}
