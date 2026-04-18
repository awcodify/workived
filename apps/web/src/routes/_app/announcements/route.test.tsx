import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const mockAnnouncements = [
  { id: 'ann-1', title: 'First Ann', body: 'Body one here', is_pinned: true, is_read: false, author_name: 'Admin', published_at: '2026-04-18T10:00:00Z', organisation_id: 'org-1', author_id: 'emp-1', created_at: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' },
  { id: 'ann-2', title: 'Second Ann', body: 'Body two here', is_pinned: false, is_read: true, author_name: 'Admin', published_at: '2026-04-17T10:00:00Z', organisation_id: 'org-1', author_id: 'emp-1', created_at: '2026-04-17T10:00:00Z', updated_at: '2026-04-17T10:00:00Z' },
]

const mockMarkRead = vi.fn()
const mockDelete = vi.fn()
const mockPublish = vi.fn()
const mockPin = vi.fn()

vi.mock('@/lib/hooks/useAnnouncements', () => ({
  useAnnouncements: () => ({ data: mockAnnouncements, isLoading: false }),
  useAnnouncementsAdmin: () => ({ data: mockAnnouncements, isLoading: false }),
  useAnnouncementUnreadCount: () => ({ data: 1 }),
  useDeleteAnnouncement: () => ({ mutate: mockDelete }),
  usePublishAnnouncement: () => ({ mutate: mockPublish }),
  usePinAnnouncement: () => ({ mutate: mockPin }),
  useMarkAnnouncementRead: () => ({ mutate: mockMarkRead }),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanEditOrgSettings: () => true,
}))

vi.mock('@/components/workived/shared/DateTime', () => ({
  DateTime: () => <span data-testid="datetime" />,
}))

vi.mock('@/components/workived/shared/NotificationBell', () => ({
  NotificationBell: () => <span data-testid="notification-bell" />,
}))

vi.mock('@/components/workived/announcements/AnnouncementModal', () => ({
  AnnouncementModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="announcement-modal">
      <button data-testid="modal-close" onClick={onClose}>close</button>
    </div>
  ),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, createFileRoute: () => () => ({}) }
})

import { AnnouncementsPage } from './route'

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page root', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByTestId('announcements-page')).toBeInTheDocument()
  })

  it('shows feed tab by default with announcement rows', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByTestId('announcement-row-ann-1')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-row-ann-2')).toBeInTheDocument()
  })

  it('shows unread dot only on unread announcements', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByTestId('announcement-unread-dot-ann-1')).toBeInTheDocument()
    expect(screen.queryByTestId('announcement-unread-dot-ann-2')).not.toBeInTheDocument()
  })

  it('calls markRead when unread card clicked', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcement-row-ann-1'))
    expect(mockMarkRead).toHaveBeenCalledWith('ann-1')
  })

  it('does not call markRead when already read card clicked', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcement-row-ann-2'))
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('shows admin tabs for admin user', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByTestId('announcements-tab-feed')).toBeInTheDocument()
    expect(screen.getByTestId('announcements-tab-manage')).toBeInTheDocument()
    expect(screen.getByTestId('announcements-new-btn')).toBeInTheDocument()
  })

  it('switches to manage tab and shows admin rows', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcements-tab-manage'))
    expect(screen.getByTestId('announcement-admin-row-ann-1')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-admin-row-ann-2')).toBeInTheDocument()
  })

  it('opens modal when new button clicked', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcements-new-btn'))
    expect(screen.getByTestId('announcement-modal')).toBeInTheDocument()
  })

  it('closes modal', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcements-new-btn'))
    fireEvent.click(screen.getByTestId('modal-close'))
    expect(screen.queryByTestId('announcement-modal')).not.toBeInTheDocument()
  })

  it('calls delete from manage tab', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcements-tab-manage'))
    fireEvent.click(screen.getByTestId('announcement-delete-btn-ann-1'))
    expect(mockDelete).toHaveBeenCalledWith('ann-1')
  })

  it('calls pin toggle from manage tab', () => {
    render(<AnnouncementsPage />)
    fireEvent.click(screen.getByTestId('announcements-tab-manage'))
    fireEvent.click(screen.getByTestId('announcement-pin-btn-ann-2'))
    expect(mockPin).toHaveBeenCalledWith({ id: 'ann-2', pin: true })
  })
})
