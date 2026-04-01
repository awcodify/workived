import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PolicyModal } from '@/components/workived/leave/PolicyModal'
import type { LeavePolicy } from '@/types/api'

const mockCreateMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()

vi.mock('@/lib/hooks/useLeave', () => ({
  useCreatePolicy: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdatePolicy: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

const mockPolicy: LeavePolicy = {
  id: 'pol1',
  organisation_id: 'org1',
  name: 'Annual Leave',
  days_per_year: 12,
  carry_over_days: 3,
  min_tenure_days: 30,
  requires_approval: true,
  is_unlimited: false,
  is_active: true,
  gender_eligibility: null,
  eligible_employment_types: ['full_time'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('PolicyModal', () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create mode', () => {
    it('renders with "New Policy" title', () => {
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('New Policy')).toBeInTheDocument()
    })

    it('renders empty form fields', () => {
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)
      const nameInput = screen.getByPlaceholderText(/annual leave/i)
      expect(nameInput).toHaveValue('')
    })

    it('shows "Create Policy" submit button', () => {
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Create Policy')).toBeInTheDocument()
    })

    it('calls createMutation on submit with valid data', async () => {
      const user = userEvent.setup()
      mockCreateMutateAsync.mockResolvedValueOnce({})

      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      await user.type(screen.getByPlaceholderText(/annual leave/i), 'Sick Leave')
      await user.click(screen.getByText('Create Policy'))

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Sick Leave' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('shows validation error when name is empty', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      await user.click(screen.getByText('Create Policy'))

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled()
      })
    })
  })

  describe('edit mode', () => {
    it('renders with "Edit Policy" title', () => {
      render(<PolicyModal policy={mockPolicy} onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Edit Policy')).toBeInTheDocument()
    })

    it('pre-fills form with policy data', () => {
      render(<PolicyModal policy={mockPolicy} onClose={onClose} onSuccess={onSuccess} />)
      const nameInput = screen.getByPlaceholderText(/annual leave/i)
      expect(nameInput).toHaveValue('Annual Leave')
    })

    it('shows "Save Changes" submit button', () => {
      render(<PolicyModal policy={mockPolicy} onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('calls updateMutation on submit', async () => {
      const user = userEvent.setup()
      mockUpdateMutateAsync.mockResolvedValueOnce({})

      render(<PolicyModal policy={mockPolicy} onClose={onClose} onSuccess={onSuccess} />)

      await user.clear(screen.getByPlaceholderText(/annual leave/i))
      await user.type(screen.getByPlaceholderText(/annual leave/i), 'Updated Leave')
      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Leave' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  describe('interactions', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      await user.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      // Click the backdrop overlay directly (not the modal content inside it)
      const backdrop = container.firstElementChild!
      await user.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when X button is clicked', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      // X button is the one with the close icon in the header
      const header = screen.getByText('New Policy').parentElement!
      const closeButton = header.querySelector('button')!
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    })

    it('hides days per year field when unlimited is checked', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      expect(screen.getByText('Days Per Year')).toBeInTheDocument()

      await user.click(screen.getByLabelText('Unlimited leave'))

      expect(screen.queryByText('Days Per Year')).not.toBeInTheDocument()
    })

    it('toggles employment type selection', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      const fullTimeBtn = screen.getByText('Full-time')
      await user.click(fullTimeBtn)

      // Click again to deselect
      await user.click(fullTimeBtn)

      // Both clicks should work without error
      expect(fullTimeBtn).toBeInTheDocument()
    })

    it('changes gender eligibility selection', async () => {
      const user = userEvent.setup()
      render(<PolicyModal onClose={onClose} onSuccess={onSuccess} />)

      await user.click(screen.getByText('Female'))
      // Should be selectable without error
      expect(screen.getByText('Female')).toBeInTheDocument()
    })
  })
})
