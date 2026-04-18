import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnnouncementModal } from './AnnouncementModal'
import type { Announcement } from '@/types/api'

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/hooks/useAnnouncements', () => ({
  useCreateAnnouncement: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateAnnouncement: () => ({ mutateAsync: mockUpdate, isPending: false }),
}))

const mockAnn: Announcement = {
  id: 'ann-1',
  organisation_id: 'org-1',
  author_id: 'emp-1',
  author_name: 'Admin',
  title: 'Existing Title',
  body: 'Existing body content here',
  is_pinned: false,
  is_read: false,
  published_at: null,
  created_at: '2026-04-18T10:00:00Z',
  updated_at: '2026-04-18T10:00:00Z',
}

describe('AnnouncementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders create form', () => {
    render(<AnnouncementModal onClose={vi.fn()} />)
    expect(screen.getByTestId('announcement-modal')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-body-input')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-publish-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('announcement-submit-btn')).toHaveTextContent('Create')
  })

  it('renders edit form with existing values', () => {
    render(<AnnouncementModal announcement={mockAnn} onClose={vi.fn()} />)
    expect(screen.getByTestId('announcement-title-input')).toHaveValue('Existing Title')
    expect(screen.getByTestId('announcement-body-input')).toHaveValue('Existing body content here')
    expect(screen.getByTestId('announcement-submit-btn')).toHaveTextContent('Save changes')
    expect(screen.queryByTestId('announcement-publish-checkbox')).not.toBeInTheDocument()
  })

  it('closes on cancel', () => {
    const onClose = vi.fn()
    render(<AnnouncementModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('announcement-cancel-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on X button', () => {
    const onClose = vi.fn()
    render(<AnnouncementModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('announcement-modal-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows validation error when title empty', async () => {
    render(<AnnouncementModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('announcement-submit-btn'))
    await waitFor(() => {
      expect(screen.getByText('Title required')).toBeInTheDocument()
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls create on valid submit', async () => {
    mockCreate.mockResolvedValue({ id: 'new-id' })
    const onClose = vi.fn()
    render(<AnnouncementModal onClose={onClose} />)
    fireEvent.change(screen.getByTestId('announcement-title-input'), { target: { value: 'New Ann' } })
    fireEvent.change(screen.getByTestId('announcement-body-input'), { target: { value: 'Body text here.' } })
    fireEvent.click(screen.getByTestId('announcement-submit-btn'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledOnce())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls update on edit submit', async () => {
    mockUpdate.mockResolvedValue({ id: 'ann-1' })
    const onClose = vi.fn()
    render(<AnnouncementModal announcement={mockAnn} onClose={onClose} />)
    fireEvent.change(screen.getByTestId('announcement-title-input'), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByTestId('announcement-submit-btn'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce())
    expect(onClose).toHaveBeenCalledOnce()
  })
})
