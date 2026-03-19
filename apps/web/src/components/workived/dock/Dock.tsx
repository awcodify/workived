import { Link, useMatches } from '@tanstack/react-router'
import { LayoutDashboard, Users, Clock, Calendar, BarChart3, CheckSquare } from 'lucide-react'
import { dockThemes } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'
import { SettingsMenu } from './SettingsMenu'
import { useEnabledFeatures } from '@/lib/hooks/useFeatures'

type ModuleKey = keyof typeof dockThemes

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, module: 'overview' as ModuleKey, featureKey: null, notificationKey: null },
  { to: '/people', label: 'People', icon: Users, module: 'people' as ModuleKey, featureKey: null, notificationKey: 'people' },
  { to: '/attendance', label: 'Attendance', icon: Clock, module: 'attendance' as ModuleKey, featureKey: null, notificationKey: 'attendance' },
  { to: '/leave', label: 'Leave', icon: Calendar, module: 'leave' as ModuleKey, featureKey: null, notificationKey: 'leave' },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' as ModuleKey, featureKey: 'reports', notificationKey: null },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, module: 'tasks' as ModuleKey, featureKey: 'tasks', notificationKey: 'tasks' },
] as const

// Mock notification counts - replace with actual data from your API
const mockNotifications = {
  people: 3, // 3 leave requests awaiting approval
  attendance: 2, // 2 attendance corrections pending
  leave: 0, // pending leave approvals
  tasks: 5, // 5 task updates
}

function getCurrentModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/people')) return 'people'
  if (pathname.startsWith('/attendance')) return 'attendance'
  if (pathname.startsWith('/leave')) return 'leave'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/tasks')) return 'tasks'
  return 'overview'
}

export function Dock() {
  const matches = useMatches()
  const pathname = matches[matches.length - 1]?.pathname ?? '/'
  const currentModule = getCurrentModule(pathname)
  const theme = dockThemes[currentModule]
  const { data: features } = useEnabledFeatures()

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.featureKey === null || features === undefined || features[item.featureKey] === true
  )

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-2xl border backdrop-blur-3xl"
        style={{
          background: theme.bg,
          borderColor: theme.border,
          filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.4))',
        }}
      >
        {/* Navigation Items */}
        {visibleItems.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
          const Icon = item.icon
          const notificationCount = item.notificationKey ? mockNotifications[item.notificationKey] || 0 : 0
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group relative"
            >
              <div
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300',
                  isActive ? 'scale-100' : 'scale-95 opacity-60'
                )}
                style={{
                  background: isActive ? theme.active.bg : 'transparent',
                }}
              >
                {/* Hover glow effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"
                    style={{
                      background: theme.active.bg,
                    }}
                  />
                )}

                {/* Icon with notification badge */}
                <div className="relative group-hover:scale-110 group-hover:-translate-y-0.5 transition-all duration-300">
                  <Icon
                    size={20}
                    className="group-hover:rotate-6 transition-transform duration-300"
                    style={{ 
                      color: isActive ? theme.active.icon : theme.icon,
                      strokeWidth: isActive ? 2.5 : 2,
                      transition: 'all 0.2s ease',
                    }}
                  />
                  
                  {/* Notification badge */}
                  {notificationCount > 0 && (
                    <div
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse group-hover:scale-125 transition-transform"
                      style={{
                        background: '#D44040',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 8px rgba(212, 64, 64, 0.4)',
                        animationDuration: '2s',
                      }}
                    >
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </div>
                  )}
                </div>
                
                <span
                  className={cn(
                    "text-[9px] font-bold tracking-wider uppercase transition-all duration-300",
                    !isActive && "group-hover:scale-105 group-hover:tracking-widest"
                  )}
                  style={{ 
                    color: isActive ? theme.active.label : theme.label,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}

        {/* Divider */}
        <div
          className="h-12 w-px mx-1"
          style={{ background: theme.border, opacity: 0.5 }}
        />

        {/* Settings Menu */}
        <SettingsMenu currentModule={currentModule} />
      </div>
    </nav>
  )
}
