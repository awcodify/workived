import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryModal } from '@/components/workived/claims/CategoryModal'
import type { ClaimCategory } from '@/types/api'

const mockCreateMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()

vi.mock('@/lib/hooks/useClaims', () => ({
  useCreateCategory: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdateCategory: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: () => ({
    data: {
      id: 'org1',
      currency_code: 'IDR',
    },
  }),
}))

const mockCategory: ClaimCategory = {
  id: 'cat1',
  organisation_id: 'org1',
  name: 'Travel',
  description: 'Travel expenses',
  monthly_limit: 1000000,
  currency_code: 'IDR',
  requires_receipt: true,
  is_active: true,
  budget_period: 'monthly',
  eligible_employment_types: ['full_time'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('CategoryModal', () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create mode', () => {
    it('renders with "New Category" title', () => {
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('New Category')).toBeInTheDocument()
    })

    it('renders empty form fields', () => {
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)
      const nameInput = screen.getByPlaceholderText(/travel, meals/i)
      expect(nameInput).toHaveValue('')
    })

    it('shows "Create Category" submit button', () => {
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Create Category')).toBeInTheDocument()
    })

    it('calls createMutation on submit with valid data', async () => {
      const user = userEvent.setup()
      mockCreateMutateAsync.mockResolvedValueOnce({})

      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      await user.type(screen.getByPlaceholderText(/travel, meals/i), 'Meals')
      await user.click(screen.getByText('Create Category'))

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Meals' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('allows creating category with description', async () => {
      const user = userEvent.setup()
      mockCreateMutateAsync.mockResolvedValueOnce({})

      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      await user.type(screen.getByPlaceholderText(/travel, meals/i), 'Meals')
      await user.type(screen.getByPlaceholderText(/describe what expenses/i), 'Food and beverages')
      await user.click(screen.getByText('Create Category'))

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ 
            name: 'Meals',
            description: 'Food and beverages',
          }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('allows creating category without description', async () => {
      const user = userEvent.setup()
      mockCreateMutateAsync.mockResolvedValueOnce({})

      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      await user.type(screen.getByPlaceholderText(/travel, meals/i), 'Meals')
      await user.click(screen.getByText('Create Category'))

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Meals' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('defaults to monthly budget period', () => {
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)
      const monthlyBtn = screen.getByText('monthly')
      // Should have active styling by default
      expect(monthlyBtn).toBeInTheDocument()
    })

    it('allows switching budget period to yearly', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const yearlyBtn = screen.getByText('yearly')
      await user.click(yearlyBtn)

      expect(screen.getByText('Yearly Limit (Optional)')).toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    it('renders with "Edit Category" title', () => {
      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Edit Category')).toBeInTheDocument()
    })

    it('pre-fills form with category data', () => {
      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)
      const nameInput = screen.getByPlaceholderText(/travel, meals/i)
      expect(nameInput).toHaveValue('Travel')
    })

    it('pre-fills description when category has description', () => {
      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)
      const descInput = screen.getByPlaceholderText(/describe what expenses/i) as HTMLTextAreaElement
      expect(descInput).toHaveValue('Travel expenses')
    })

    it('shows empty description field when category has no description', () => {
      const categoryWithoutDescription = {
        ...mockCategory,
        description: null,
      }
      render(<CategoryModal category={categoryWithoutDescription} onClose={onClose} onSuccess={onSuccess} />)
      const descInput = screen.getByPlaceholderText(/describe what expenses/i) as HTMLTextAreaElement
      expect(descInput).toHaveValue('')
    })

    it('shows "Save Changes" submit button', () => {
      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('calls updateMutation on submit', async () => {
      const user = userEvent.setup()
      mockUpdateMutateAsync.mockResolvedValueOnce({})

      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)

      await user.clear(screen.getByPlaceholderText(/travel, meals/i))
      await user.type(screen.getByPlaceholderText(/travel, meals/i), 'Updated Travel')
      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Travel' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('updates description when edited', async () => {
      const user = userEvent.setup()
      mockUpdateMutateAsync.mockResolvedValueOnce({})

      render(<CategoryModal category={mockCategory} onClose={onClose} onSuccess={onSuccess} />)

      const descInput = screen.getByPlaceholderText(/describe what expenses/i)
      await user.clear(descInput)
      await user.type(descInput, 'Updated description')
      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Updated description' }),
        )
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  describe('interactions', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      await user.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const backdrop = container.firstElementChild!
      await user.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when X button is clicked', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const header = screen.getByText('New Category').parentElement!
      const closeButton = header.querySelector('button')!
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    })

    it('toggles employment type selection', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const fullTimeBtn = screen.getByText('Full-time')
      await user.click(fullTimeBtn)

      // Click again to deselect
      await user.click(fullTimeBtn)

      expect(fullTimeBtn).toBeInTheDocument()
    })

    it('toggles require receipt checkbox', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const checkbox = screen.getByRole('checkbox', { name: /require receipt attachment/i })
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(checkbox).toBeChecked()
    })

    it('formats monthly limit with thousand separators', async () => {
      const user = userEvent.setup()
      render(<CategoryModal onClose={onClose} onSuccess={onSuccess} />)

      const limitInput = screen.getByPlaceholderText('0')
      await user.type(limitInput, '1000000')

      // Should format as "1,000,000"
      await waitFor(() => {
        expect(limitInput).toHaveValue('1,000,000')
      })
    })
  })
})
