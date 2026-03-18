import { Link, useMatches } from '@tanstack/react-router'
import { LayoutDashboard, Users, Clock, CalendarDays, CheckSquare } from 'lucide-react'
import { dockThemes } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'
import { SettingsMenu } from './SettingsMenu'

type ModuleKey = keyof typeof dockThemes

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, module: 'overview' as ModuleKey },
  { to: '/people', label: 'People', icon: Users, module: 'people' as ModuleKey },
  { to: '/attendance', label: 'Attendance', icon: Clock, module: 'attendance' as ModuleKey },
  { to: '/attendance/monthly', label: 'Monthly', icon: CalendarDays, module: 'attendance' as ModuleKey },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, module: 'tasks' as ModuleKey },
] as const

function getCurrentModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/people')) return 'people'
  if (pathname.startsWith('/attendance')) return 'attendance'
  if (pathname.startsWith('/tasks')) return 'tasks'
  return 'overview'
}

export function Dock() {
  const matches = useMatches()
  const pathname = matches[matches.length - 1]?.pathname ?? '/'
  const currentModule = getCurrentModule(pathname)
  const theme = dockThemes[currentModule]

  return (
    <nav
      className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-2xl border backdrop-blur-xl"
      style={{
        background: theme.bg,
        borderColor: theme.border,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
              isActive && 'rounded-xl',
            )}
            style={{
              background: isActive ? theme.active.bg : 'transparent',
            }}
          >
            <Icon
              size={20}
              style={{ color: isActive ? theme.active.icon : theme.icon }}
            />
            <span
              className="text-[10px] font-semibold tracking-wide"
              style={{ color: isActive ? theme.active.label : theme.label }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}

      {/* Settings Menu */}
      <SettingsMenu currentModule={currentModule} />
    </nav>
  )
}
