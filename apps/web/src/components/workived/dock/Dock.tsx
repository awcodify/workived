import { Link, useMatches } from '@tanstack/react-router'
import { LayoutDashboard, Users, Clock, Calendar, CalendarDays, Receipt, BarChart3, CheckSquare } from 'lucide-react'
import { dockThemes } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'
import { SettingsMenu } from './SettingsMenu'
import { useEnabledFeatures } from '@/lib/hooks/useFeatures'
import { useLeaveNotificationCount } from '@/lib/hooks/useLeave'
import { useClaimNotificationCount } from '@/lib/hooks/useClaims'
import { useCanManageLeave } from '@/lib/hooks/useRole'
import { useCanManageClaims } from '@/lib/hooks/useRole'

type ModuleKey = keyof typeof dockThemes

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, module: 'overview' as ModuleKey, featureKey: null, notificationKey: null },
  { to: '/people', label: 'People', icon: Users, module: 'people' as ModuleKey, featureKey: null, notificationKey: 'people' },
  { to: '/attendance', label: 'Attendance', icon: Clock, module: 'attendance' as ModuleKey, featureKey: null, notificationKey: 'attendance' },
  { to: '/leave', label: 'Leave', icon: Calendar, module: 'leave' as ModuleKey, featureKey: null, notificationKey: 'leave' },
  { to: '/claims', label: 'Claims', icon: Receipt, module: 'claims' as ModuleKey, featureKey: null, notificationKey: 'claims' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' as ModuleKey, featureKey: null, notificationKey: null },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' as ModuleKey, featureKey: 'reports', notificationKey: null },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, module: 'tasks' as ModuleKey, featureKey: 'tasks', notificationKey: 'tasks' },
] as const

function getCurrentModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/people')) return 'people'
  if (pathname.startsWith('/attendance')) return 'attendance'
  if (pathname.startsWith('/leave')) return 'leave'
  if (pathname.startsWith('/claims')) return 'claims'
  if (pathname.startsWith('/calendar')) return 'calendar'
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
  
  // Get real notification counts
  const canManageLeave = useCanManageLeave()
  const canManageClaims = useCanManageClaims()
  const { data: leaveCount } = useLeaveNotificationCount()
  const { data: claimCount } = useClaimNotificationCount()
  
  // Build notification counts object
  const notificationCounts = {
    people: 0,
    attendance: 0,
    leave: canManageLeave ? (leaveCount ?? 0) : 0,
    claims: canManageClaims ? (claimCount ?? 0) : 0,
    tasks: 0,
  }

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
          filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.4)) drop-shadow(0 4px 16px rgba(0, 0, 0, 0.2))',
        }}
      >
        {/* Navigation Items */}
        {visibleItems.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
          const Icon = item.icon
          const notificationCount = item.notificationKey ? notificationCounts[item.notificationKey] || 0 : 0
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group relative"
            >
              <div
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300',
                  isActive ? 'scale-100' : 'scale-95 opacity-60 group-hover:scale-100 group-hover:opacity-100'
                )}
                style={{
                  background: isActive ? theme.active.bg : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.1)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = theme.active.bg
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
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
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = theme.active.icon
                        e.currentTarget.style.strokeWidth = '2.5'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = theme.icon
                        e.currentTarget.style.strokeWidth = '2'
                      }
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
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = theme.active.label
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = theme.label
                    }
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
