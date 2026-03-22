import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Settings, LogOut, User, Building2, Users, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { useThemeStore } from '@/lib/stores/theme'
import { useHasOrg } from '@/lib/hooks/useRole'
import { dockThemes, useDockTheme } from '@/design/tokens'
import { cn } from '@/lib/utils/cn'

type ModuleKey = keyof typeof dockThemes

interface SettingsMenuProps {
  currentModule: ModuleKey
}

export function SettingsMenu({ currentModule }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme: currentTheme, toggleTheme } = useThemeStore()
  const hasOrg = useHasOrg()
  
  // Use themed dock for overview/people, static for others
  const overviewDockTheme = useDockTheme('overview')
  const peopleDockTheme = useDockTheme('people')
  
  const theme = currentModule === 'overview' ? overviewDockTheme
    : currentModule === 'people' ? peopleDockTheme
    : dockThemes[currentModule]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login', search: { redirect: undefined } })
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Settings menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative group"
      >
        <div
          className={cn(
            'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300',
            isOpen ? 'scale-100 bg-opacity-100' : 'scale-95 opacity-60'
          )}
          style={{
            background: isOpen ? theme.active.bg : 'transparent',
          }}
        >
          {/* Hover glow effect */}
          {!isOpen && (
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"
              style={{
                background: theme.active.bg,
              }}
            />
          )}

          <Settings
            size={20}
            className="group-hover:rotate-90 group-hover:scale-110 transition-all duration-300 relative"
            style={{ 
              color: isOpen ? theme.active.icon : theme.icon,
              strokeWidth: isOpen ? 2.5 : 2,
              transition: 'all 0.2s ease',
            }}
          />
          <span
            className={cn(
              "text-[9px] font-bold tracking-wider uppercase transition-all duration-300",
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full mb-3 right-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            minWidth: 200,
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            backdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: currentModule === 'leave' || currentModule === 'claims'
              ? '0 8px 32px rgba(0, 0, 0, 0.12)'
              : '0 8px 32px rgba(0, 0, 0, 0.4)',
            animation: 'slideUpFade 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* User Info */}
          {user && (
            <div
              className="px-3 py-3 border-b"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ 
                    background: theme.active.bg,
                  }}
                >
                  <User
                    size={16}
                    style={{ color: theme.active.icon }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold leading-tight truncate"
                    style={{ color: theme.active.icon }}
                  >
                    {user.full_name}
                  </p>
                  <p
                    className="text-[10px] leading-tight mt-0.5 truncate opacity-70"
                    style={{ color: theme.icon }}
                  >
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Settings Links */}
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); navigate({ to: '/settings/company' }) }}
            className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-all text-left group/item"
            style={{ color: theme.active.icon }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.background = theme.active.bg
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Building2 size={16} className="transition-transform group-hover/item:scale-110" />
            <span className="text-xs font-medium">Company settings</span>
          </button>
          {hasOrg && (
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); navigate({ to: '/settings/members' }) }}
            className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-all text-left group/item"
            style={{ color: theme.active.icon }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.background = theme.active.bg
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Users size={16} className="transition-transform group-hover/item:scale-110" />
            <span className="text-xs font-medium">Team members</span>
          </button>
          )}

          {/* Divider */}
          <div className="my-1" style={{ height: 1, background: theme.border }} />

          {/* Theme Toggle */}
          <button
            role="menuitem"
            onClick={() => { toggleTheme() }}
            className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-all text-left group/item"
            style={{ color: theme.active.icon }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.background = theme.active.bg
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {currentTheme === 'light' ? (
              <>
                <Moon size={16} className="transition-transform group-hover/item:scale-110" />
                <span className="text-xs font-medium">Dark mode (beta)</span>
              </>
            ) : (
              <>
                <Sun size={16} className="transition-transform group-hover/item:scale-110" />
                <span className="text-xs font-medium">Light mode (beta)</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="my-1" style={{ height: 1, background: theme.border }} />

          {/* 
          {/* Logout Button */}
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-all text-left group/item"
            style={{ color: theme.active.icon }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.background = theme.active.bg
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={16} className="transition-transform group-hover/item:scale-110" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
