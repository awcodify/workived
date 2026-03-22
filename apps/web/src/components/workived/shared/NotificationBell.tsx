import { useState, useRef, useEffect } from 'react'
import { colors } from '@/design/tokens'

interface NotificationBellProps {
  surfaceColor?: string
  borderColor?: string
  accentColor?: string
  textColor?: string
  textMutedColor?: string
}

export function NotificationBell({
  surfaceColor = '#FFFFFF',
  borderColor = 'rgba(0,0,0,0.08)',
  accentColor = colors.accent,
  textColor = '#2C3E50',
  textMutedColor = '#7F8C8D',
}: NotificationBellProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          minWidth: 36,
          height: 36,
          background: surfaceColor,
          borderRadius: 10,
          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: `1px solid ${borderColor}`,
          cursor: 'pointer',
        }}
        title="Notifications"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: accentColor, flexShrink: 0 }}>
          <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: surfaceColor,
            borderRadius: 12,
            boxShadow: '0 4px 20px 0 rgba(0,0,0,0.12)',
            border: `1px solid ${borderColor}`,
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: textColor,
                margin: 0,
              }}
            >
              Notifications
            </h3>
          </div>

          {/* Empty State */}
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `${accentColor}15`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" style={{ color: accentColor }}>
                <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: textColor,
                margin: '0 0 4px 0',
              }}
            >
              Coming Soon
            </p>
            <p
              style={{
                fontSize: 12,
                color: textMutedColor,
                margin: 0,
              }}
            >
              Notification features are being built
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
