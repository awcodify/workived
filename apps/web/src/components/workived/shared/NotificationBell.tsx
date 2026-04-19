import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Megaphone, Pin } from 'lucide-react'
import { colors } from '@/design/tokens'
import { useAnnouncements, useMarkAnnouncementRead, useAnnouncementUnreadCount } from '@/lib/hooks/useAnnouncements'

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
  const { data: unreadCount = 0 } = useAnnouncementUnreadCount()
  const { data: announcements = [] } = useAnnouncements()
  const markReadMut = useMarkAnnouncementRead()

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

  const recent = announcements.slice(0, 5)

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef} data-testid="notification-bell">
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        data-testid="notification-bell-btn"
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
          position: 'relative',
        }}
        title="Announcements"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: accentColor, flexShrink: 0 }}>
          <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {unreadCount > 0 && (
          <div
            data-testid="notification-bell-badge"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#D44040',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {showDropdown && (
        <div
          data-testid="notification-dropdown"
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
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Megaphone size={14} style={{ color: '#B45014' }} />
              <h3 style={{ fontSize: 13, fontWeight: 600, color: textColor, margin: 0 }}>
                Announcements
              </h3>
              {unreadCount > 0 && (
                <span
                  data-testid="notification-header-badge"
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    background: '#D44040',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <Link
              to="/announcements"
              onClick={() => setShowDropdown(false)}
              data-testid="notification-see-all-link"
              style={{ fontSize: 11, color: accentColor, fontWeight: 600, textDecoration: 'none' }}
            >
              See all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div
              data-testid="notification-empty"
              style={{ padding: '32px 20px', textAlign: 'center' }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: textColor, margin: '0 0 4px' }}>
                No announcements
              </p>
              <p style={{ fontSize: 12, color: textMutedColor, margin: 0 }}>
                You're all caught up
              </p>
            </div>
          ) : (
            <div>
              {recent.map((ann) => (
                <div
                  key={ann.id}
                  data-testid={`notification-item-${ann.id}`}
                  onClick={() => {
                    if (!ann.is_read) markReadMut.mutate(ann.id)
                    setShowDropdown(false)
                  }}
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    background: ann.is_read ? 'transparent' : `${accentColor}06`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {!ann.is_read && (
                      <div
                        data-testid={`notification-unread-dot-${ann.id}`}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: accentColor,
                          marginTop: 5,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{
                          fontSize: 13,
                          fontWeight: ann.is_read ? 500 : 600,
                          color: textColor,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}>
                          {ann.title}
                        </p>
                        {ann.is_pinned && (
                          <Pin
                            size={12}
                            style={{
                              color: accentColor,
                              flexShrink: 0,
                              opacity: 0.6,
                            }}
                          />
                        )}
                      </div>
                      <p style={{
                        fontSize: 11,
                        color: textMutedColor,
                        margin: '2px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {ann.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <Link
                to="/announcements"
                onClick={() => setShowDropdown(false)}
                data-testid="notification-view-all-btn"
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: accentColor,
                  textDecoration: 'none',
                }}
              >
                View all announcements
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
