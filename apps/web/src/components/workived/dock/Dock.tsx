import { Link, useMatches, useRouter } from '@tanstack/react-router'
import { LayoutDashboard, Users, Clock, Calendar, CalendarDays, Receipt, BarChart3, CheckSquare, Loader2 } from 'lucide-react'
import { dockThemes, useDockTheme } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'
import { SettingsMenu } from './SettingsMenu'
import { useEnabledFeatures } from '@/lib/hooks/useFeatures'
import { useLeaveNotificationCount } from '@/lib/hooks/useLeave'
import { useClaimNotificationCount } from '@/lib/hooks/useClaims'
import { useEffect, useState } from 'react'

type ModuleKey = keyof typeof dockThemes
type ThemableModule = 'overview' | 'people'

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, module: 'overview' as ModuleKey, featureKey: null, notificationKey: null, hideOnMobile: false },
  { to: '/attendance', label: 'Attendance', icon: Clock, module: 'attendance' as ModuleKey, featureKey: null, notificationKey: 'attendance', hideOnMobile: false },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, module: 'tasks' as ModuleKey, featureKey: 'tasks', notificationKey: 'tasks', hideOnMobile: true },
  { to: '/leave', label: 'Leave', icon: Calendar, module: 'leave' as ModuleKey, featureKey: null, notificationKey: 'leave', hideOnMobile: false },
  { to: '/claims', label: 'Claims', icon: Receipt, module: 'claims' as ModuleKey, featureKey: null, notificationKey: 'claims', hideOnMobile: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' as ModuleKey, featureKey: null, notificationKey: null, hideOnMobile: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' as ModuleKey, featureKey: 'reports', notificationKey: null, hideOnMobile: false },
  { to: '/people', label: 'People', icon: Users, module: 'people' as ModuleKey, featureKey: null, notificationKey: 'people', hideOnMobile: true }
] as const

function getCurrentModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/people')) return 'people'
  if (pathname.startsWith('/attendance')) return 'attendance'
  if (pathname.startsWith('/leave')) return 'leave'
  if (pathname.startsWith('/claims')) return 'claims'
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'overview'
}

export function Dock() {
  const router = useRouter()
  const matches = useMatches()
  const pathname = matches[matches.length - 1]?.pathname ?? '/'
  const currentModule = getCurrentModule(pathname)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  
  // Use themed dock for overview/people, static for others
  const overviewDockTheme = useDockTheme('overview')
  const peopleDockTheme = useDockTheme('people')
  
  const theme = currentModule === 'overview' ? overviewDockTheme
    : currentModule === 'people' ? peopleDockTheme
    : dockThemes[currentModule]
  
  const { data: features } = useEnabledFeatures()
  
  // Get real notification counts.
  // Do NOT gate on canManageLeave/canManageClaims — JWT has_subordinate can be
  // stale after org chart changes. The API returns 0 for users with no pending
  // approvals, so the badge count is always accurate from the server.
  const { data: leaveCount } = useLeaveNotificationCount()
  const { data: claimCount } = useClaimNotificationCount()

  const notificationCounts = {
    people: 0,
    attendance: 0,
    leave: leaveCount ?? 0,
    claims: claimCount ?? 0,
    tasks: 0,
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.featureKey === null || features === undefined || features[item.featureKey] === true
  )

  // Clear loading state when navigation completes
  useEffect(() => {
    const unsubscribe = router.subscribe('onLoad', () => {
      setLoadingPath(null)
    })
    return unsubscribe
  }, [router])

  return (
    <nav
      className="fixed bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="flex items-center gap-1 md:gap-0.5 px-1.5 py-1.5 md:px-1.5 md:py-1.5 rounded-xl md:rounded-2xl border backdrop-blur-3xl"
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
          const isLoading = loadingPath === item.to
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("group relative", item.hideOnMobile && "hidden md:flex")}
              onClick={() => setLoadingPath(item.to)}
            >
              <div
                className={cn(
                  'relative flex flex-col items-center gap-0.5 md:gap-1 px-3 py-3 md:px-3 md:py-2 rounded-lg md:rounded-xl transition-all duration-300',
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
                {/* Icon with notification badge and loading spinner */}
                <div className="relative md:group-hover:scale-110 md:group-hover:-translate-y-0.5 transition-all duration-300">
                  {isLoading ? (
                    <Loader2
                      className="animate-spin w-[22px] h-[22px] md:w-5 md:h-5"
                      style={{ 
                        color: theme.active.icon,
                        strokeWidth: 2.5,
                      }}
                    />
                  ) : (
                    <Icon
                      className="md:group-hover:rotate-6 transition-transform duration-300 w-[22px] h-[22px] md:w-5 md:h-5"
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
                  )}
                  
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
                    "hidden md:block text-[9px] font-bold tracking-wider uppercase transition-all duration-300",
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
          className="h-8 md:h-12 w-px mx-0.5 md:mx-1"
          style={{ background: theme.border, opacity: 0.5 }}
        />

        {/* Settings Menu */}
        <SettingsMenu currentModule={currentModule} />
      </div>
    </nav>
  )
}
