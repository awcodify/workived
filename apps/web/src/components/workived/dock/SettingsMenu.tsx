import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import { Settings, LogOut, User, Building2, Users, FileText, Moon, Sun, Sparkles, AlertCircle, HelpCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { useThemeStore } from '@/lib/stores/theme'
import { useTourStore } from '@/lib/stores/tour'
import { useHasOrg } from '@/lib/hooks/useRole'
import { useChangelogUnread } from '@/lib/hooks/useChangelog'
import { dockThemes, useDockTheme } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'

type ModuleKey = keyof typeof dockThemes

interface SettingsMenuProps {
  currentModule: ModuleKey
}

export function SettingsMenu({ currentModule }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme: currentTheme, toggleTheme } = useThemeStore()
  const hasOrg = useHasOrg()
  const { hasUnread } = useChangelogUnread()
  
  // Use themed dock for overview/people, static for others
  const overviewDockTheme = useDockTheme('overview')
  const peopleDockTheme = useDockTheme('people')
  
  const theme = currentModule === 'overview' ? overviewDockTheme
    : currentModule === 'people' ? peopleDockTheme
    : dockThemes[currentModule]

  const isDarkDock = theme.bg.includes('20,20,25')
  
  const menuStyle = isDarkDock ? {
    bg: theme.bg,
    text: 'rgba(255,255,255,0.92)',
    textMuted: 'rgba(255,255,255,0.50)',
    hoverBg: 'rgba(255,255,255,0.08)',
    iconColor: theme.icon,
    divider: theme.border,
    avatarBg: 'rgba(255,255,255,0.10)',
    logoutText: '#F87171',
    logoutHover: 'rgba(248,113,113,0.10)',
    badgeBg: '#6357E8',
  } : {
    bg: theme.bg,
    text: '#0F0E13',
    textMuted: 'rgba(0,0,0,0.45)',
    hoverBg: 'rgba(0,0,0,0.05)',
    iconColor: theme.icon,
    divider: theme.border,
    avatarBg: 'rgba(0,0,0,0.04)',
    logoutText: '#DC2626',
    logoutHover: 'rgba(220,38,38,0.06)',
    badgeBg: '#6357E8',
  }

  // Close menu when clicking outside (check both button and portal menu)
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Position the portal menu above the settings button
  // Compute position synchronously on open to avoid a flash at (0,0)
  const getPosition = useCallback(() => {
    if (!buttonRef.current) return { bottom: 0, right: 0 }
    const rect = buttonRef.current.getBoundingClientRect()
    return {
      bottom: window.innerHeight - rect.top + 12,
      right: window.innerWidth - rect.right,
    }
  }, [])

  const [menuPos, setMenuPos] = useState(getPosition)

  // Re-calculate whenever the menu opens or window resizes
  useEffect(() => {
    if (!isOpen) return
    setMenuPos(getPosition())
    const onResize = () => setMenuPos(getPosition())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isOpen, getPosition])

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login', search: { redirect: undefined } })
  }

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    testId,
    badge,
    destructive,
  }: {
    icon: React.ElementType
    label: string
    onClick: () => void
    testId: string
    badge?: React.ReactNode
    destructive?: boolean
  }) => (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 transition-all text-left group/item rounded-lg mx-0"
      data-testid={testId}
      style={{ color: destructive ? menuStyle.logoutText : menuStyle.text }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = destructive ? menuStyle.logoutHover : menuStyle.hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon
        size={17}
        style={{ color: destructive ? menuStyle.logoutText : menuStyle.iconColor }}
        className="transition-transform group-hover/item:scale-110 flex-shrink-0"
      />
      <span className="text-[13px] font-medium flex-1">{label}</span>
      {badge}
    </button>
  )

  return (
    <div data-tour="dock-settings" data-testid="settings-menu-container">
      {/* Settings Button — stays inside the dock */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Settings menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative group"
        data-testid="settings-menu-btn"
      >
        <div
          className={cn(
            'relative flex flex-col items-center gap-0.5 md:gap-1 px-3 py-3 md:px-3 md:py-2 rounded-lg md:rounded-xl transition-all duration-300',
            isOpen ? 'scale-100 bg-opacity-100' : 'scale-95 opacity-60'
          )}
          style={{
            background: isOpen ? theme.active.bg : 'transparent',
          }}
        >
          {/* Hover glow effect */}
          {!isOpen && (
            <div
              className="absolute inset-0 rounded-lg md:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"
              style={{
                background: theme.active.bg,
              }}
            />
          )}

          <Settings
            className="md:group-hover:rotate-90 md:group-hover:scale-110 transition-all duration-300 relative w-[22px] h-[22px] md:w-5 md:h-5"
            style={{ 
              color: isOpen ? theme.active.icon : theme.icon,
              strokeWidth: isOpen ? 2.5 : 2,
              transition: 'all 0.2s ease',
            }}
          />
          <span
            className={cn(
              "hidden md:block text-[9px] font-bold tracking-wider uppercase transition-all duration-300",
              !isOpen && "group-hover:scale-105 group-hover:tracking-widest"
            )}
            style={{ 
              color: isOpen ? theme.active.label : theme.label,
              transition: 'color 0.2s ease',
            }}
          >
            Settings
          </span>
        </div>
      </button>

      {/* Dropdown Menu — rendered via Portal so it escapes the dock's filter stacking context */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] rounded-2xl border"
          data-testid="settings-menu-dropdown"
          style={{
            bottom: menuPos.bottom,
            right: menuPos.right,
            minWidth: 240,
            borderColor: theme.border,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            animation: 'settingsSlideUp 0.2s ease-out',
          }}
        >
          {/* Backdrop blur layer — separate from shadow so both work */}
          <div
            className="absolute inset-0 rounded-2xl backdrop-blur-3xl"
            style={{ background: menuStyle.bg }}
          />

          {/* Content layer — sits above the blur */}
          <div className="relative">
            {/* User Info Header */}
            {user && (
              <div
                className="px-4 py-3.5 border-b"
                data-testid="settings-menu-user-info"
                style={{ borderColor: menuStyle.divider }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: menuStyle.avatarBg }}
                  >
                    <User size={18} style={{ color: menuStyle.iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-bold leading-tight truncate"
                      style={{ color: menuStyle.text }}
                    >
                      {user.full_name}
                    </p>
                    <p
                      className="text-[11px] leading-tight mt-0.5 truncate"
                      style={{ color: menuStyle.textMuted }}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Section */}
            <div className="p-1.5">
              <MenuItem
                icon={User}
                label="My profile"
                testId="settings-menu-profile-link"
                onClick={() => { setIsOpen(false); navigate({ to: '/profile' }) }}
              />
              <MenuItem
                icon={Building2}
                label="Company settings"
                testId="settings-menu-company-link"
                onClick={() => { setIsOpen(false); navigate({ to: '/settings/company' }) }}
              />
              {hasOrg && (
                <MenuItem
                  icon={Users}
                  label="Team members"
                  testId="settings-menu-members-link"
                  onClick={() => { setIsOpen(false); navigate({ to: '/settings/members' }) }}
                />
              )}
              {hasOrg && (
                <MenuItem
                  icon={FileText}
                  label="Audit logs"
                  testId="settings-menu-audit-logs-link"
                  onClick={() => { setIsOpen(false); navigate({ to: '/settings/audit-logs' }) }}
                />
              )}
            </div>

            {/* Divider */}
            <div className="mx-3" style={{ height: 1, background: menuStyle.divider }} />

            {/* Preferences Section */}
            <div className="p-1.5">
              <MenuItem
                icon={currentTheme === 'light' ? Moon : Sun}
                label={currentTheme === 'light' ? 'Dark mode' : 'Light mode'}
                testId="settings-menu-theme-toggle"
                onClick={toggleTheme}
                badge={
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: menuStyle.hoverBg, color: menuStyle.textMuted }}
                  >
                    Beta
                  </span>
                }
              />
              <MenuItem
                icon={Sparkles}
                label="What's New"
                testId="settings-menu-changelog-link"
                onClick={() => { setIsOpen(false); navigate({ to: '/changelog' }) }}
                badge={
                  hasUnread ? (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: menuStyle.badgeBg }}
                    />
                  ) : undefined
                }
              />
              <MenuItem
                icon={AlertCircle}
                label="Known Issues"
                testId="settings-menu-known-issues-link"
                onClick={() => { setIsOpen(false); navigate({ to: '/known-issues' }) }}
              />
              <MenuItem
                icon={HelpCircle}
                label="Replay tour"
                testId="settings-menu-tour-link"
                onClick={() => {
                  setIsOpen(false)
                  useTourStore.getState().resetTour()
                  navigate({ to: '/overview' })
                  setTimeout(() => useTourStore.getState().startTour(), 500)
                }}
              />
            </div>

            {/* Divider */}
            <div className="mx-3" style={{ height: 1, background: menuStyle.divider }} />

            {/* Logout */}
            <div className="p-1.5">
              <MenuItem
                icon={LogOut}
                label="Logout"
                testId="settings-menu-logout-btn"
                onClick={handleLogout}
                destructive
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes settingsSlideUp {
          from {
            transform: translateY(6px);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
