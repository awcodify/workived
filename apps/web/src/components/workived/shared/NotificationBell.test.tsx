import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const mockMarkRead = vi.fn()
const mockAnnouncements = [
  { id: 'ann-1', title: 'Office closed', body: 'We are closed tomorrow.', is_pinned: false, is_read: false, author_name: 'Admin', published_at: '2026-04-18T10:00:00Z', organisation_id: 'org-1', author_id: 'emp-1', created_at: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' },
  { id: 'ann-2', title: 'Team outing', body: 'Join us this Friday.', is_pinned: false, is_read: true, author_name: 'Admin', published_at: '2026-04-17T10:00:00Z', organisation_id: 'org-1', author_id: 'emp-1', created_at: '2026-04-17T10:00:00Z', updated_at: '2026-04-17T10:00:00Z' },
]

vi.mock('@/lib/hooks/useAnnouncements', () => ({
  useAnnouncementUnreadCount: () => ({ data: 1 }),
  useAnnouncements: () => ({ data: mockAnnouncements, isLoading: false }),
  useMarkAnnouncementRead: () => ({ mutate: mockMarkRead }),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, onClick, 'data-testid': testid, ...rest }: { children: React.ReactNode; to: string; onClick?: () => void; 'data-testid'?: string; style?: React.CSSProperties }) => (
      <a data-testid={testid} onClick={onClick} {...rest}>{children}</a>
    ),
  }
})

import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders bell button', () => {
    render(<NotificationBell />)
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    expect(screen.getByTestId('notification-bell-btn')).toBeInTheDocument()
  })

  it('shows unread badge when count > 0', () => {
    render(<NotificationBell />)
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('1')
  })

  it('dropdown hidden initially', () => {
    render(<NotificationBell />)
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()
  })

  it('shows announcement items in dropdown', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    expect(screen.getByTestId('notification-item-ann-1')).toBeInTheDocument()
    expect(screen.getByTestId('notification-item-ann-2')).toBeInTheDocument()
  })

  it('shows unread dot only for unread item', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    expect(screen.getByTestId('notification-unread-dot-ann-1')).toBeInTheDocument()
    expect(screen.queryByTestId('notification-unread-dot-ann-2')).not.toBeInTheDocument()
  })

  it('calls markRead when unread item clicked', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    fireEvent.click(screen.getByTestId('notification-item-ann-1'))
    expect(mockMarkRead).toHaveBeenCalledWith('ann-1')
  })

  it('does not call markRead for already-read item', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    fireEvent.click(screen.getByTestId('notification-item-ann-2'))
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('shows see-all link', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByTestId('notification-bell-btn'))
    expect(screen.getByTestId('notification-see-all-link')).toBeInTheDocument()
  })
})
