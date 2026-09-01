import { BookCheck, LayoutDashboard, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { loadSessionUser } from '../../lib/user-session'
import { cn } from '../../lib/utils'

const links = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/profile', label: '个人中心', icon: UserRound },
]

export function Header() {
  const location = useLocation()
  const [viewerName, setViewerName] = useState(() => loadSessionUser()?.name?.trim() ?? '')

  useEffect(() => {
    const sync = () => setViewerName(loadSessionUser()?.name?.trim() ?? '')
    sync()
    window.addEventListener('ag-session-user-changed', sync)
    return () => window.removeEventListener('ag-session-user-changed', sync)
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <BookCheck className="h-5 w-5 shrink-0" />
          <span className="truncate">AI 智能批改助手</span>
          {viewerName ? (
            <span className="hidden max-w-[10rem] truncate text-xs font-normal text-gray-500 sm:inline">
              · {viewerName}
            </span>
          ) : null}
        </Link>
        <nav className="flex items-center gap-2">
          {links.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
