import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Settings, LogOut, User, Building2, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { dockThemes } from '@/design/tokens'

type ModuleKey = keyof typeof dockThemes

interface SettingsMenuProps {
  currentModule: ModuleKey
}

export function SettingsMenu({ currentModule }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const theme = dockThemes[currentModule]

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
    navigate({ to: '/login' })
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Settings Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Settings menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors"
        style={{
          background: isOpen ? theme.active.bg : 'transparent',
        }}
      >
        <Settings
          size={20}
          style={{ color: isOpen ? theme.active.icon : theme.icon }}
        />
        <span
          className="text-[10px] font-semibold tracking-wide"
          style={{ color: isOpen ? theme.active.label : theme.label }}
        >
          Settings
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full mb-2 right-0 rounded-xl overflow-hidden shadow-lg"
          style={{
            minWidth: 180,
            background: currentModule === 'overview' 
              ? 'rgba(255,255,255,0.1)' 
              : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: currentModule === 'overview'
              ? '1px solid rgba(255,255,255,0.15)'
              : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* User Info */}
          {user && (
            <div
              className="px-4 py-3 border-b"
              style={{
                borderColor: currentModule === 'overview'
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: currentModule === 'overview'
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <User
                    size={16}
                    style={{
                      color: currentModule === 'overview' 
                        ? 'rgba(255,255,255,0.7)' 
                        : '#0F0E13',
                    }}
                  />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{
                      color: currentModule === 'overview' ? '#FFFFFF' : '#0F0E13',
                    }}
                  >
                    {user.full_name}
                  </p>
                  <p
                    className="text-xs leading-tight mt-0.5"
                    style={{
                      color: currentModule === 'overview' 
                        ? 'rgba(255,255,255,0.5)' 
                        : '#72708A',
                    }}
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
            className="w-full px-4 py-3 flex items-center gap-2 transition-colors text-left"
            style={{
              color: currentModule === 'overview'
                ? 'rgba(255,255,255,0.85)'
                : '#0F0E13',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentModule === 'overview'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Building2 size={16} />
            <span className="text-sm font-medium">Company settings</span>
          </button>
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); navigate({ to: '/settings/members' }) }}
            className="w-full px-4 py-3 flex items-center gap-2 transition-colors text-left"
            style={{
              color: currentModule === 'overview'
                ? 'rgba(255,255,255,0.85)'
                : '#0F0E13',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentModule === 'overview'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Users size={16} />
            <span className="text-sm font-medium">Team members</span>
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: currentModule === 'overview' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }} />

          {/* Logout Button */}
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full px-4 py-3 flex items-center gap-2 transition-colors text-left"
            style={{
              color: currentModule === 'overview' 
                ? 'rgba(255,255,255,0.85)' 
                : '#0F0E13',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentModule === 'overview'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOut size={16} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      )}
    </div>
  )
}
