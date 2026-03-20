import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// Mock search params
let mockSearchParams = { categoryId: undefined as string | undefined }

// Mock hooks BEFORE importing component
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: (path: string) => (opts: Record<string, unknown>) => ({
      options: opts,
      useSearch: () => mockSearchParams,
    }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/lib/hooks/useClaims', () => ({
  useSubmitClaim: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCategories: vi.fn(),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: () => ({
    data: {
      id: 'org1',
      name: 'Test Org',
      currency_code: 'IDR',
    },
    isLoading: false,
  }),
}))

// Import hooks AFTER mocks
import { useCategories } from '@/lib/hooks/useClaims'

const mockCategories = [
  {
    id: 'cat1',
    organisation_id: 'org1',
    name: 'Transport',
    monthly_limit: 500000,
    currency_code: 'IDR',
    requires_receipt: true,
    is_active: true,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'cat2',
    organisation_id: 'org1',
    name: 'Meals',
    monthly_limit: 300000,
    currency_code: 'IDR',
    requires_receipt: false,
    is_active: true,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'cat3',
    organisation_id: 'org1',
    name: 'Inactive Category',
    monthly_limit: 100000,
    currency_code: 'IDR',
    requires_receipt: false,
    is_active: false,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
]

describe('NewClaimPage - Category Auto-Selection', () => {
  let Route: any
  let NewClaimPage: React.ComponentType

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSearchParams = { categoryId: undefined }
    
    // Dynamically import the route
    const module = await import('./new')
    Route = module.Route
    NewClaimPage = Route.options.component as React.ComponentType
  })

  it('auto-selects category when prefilledCategoryId is provided and categories are loaded', async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as any)

    mockSearchParams.categoryId = 'cat1'

    render(<NewClaimPage />)

    await waitFor(() => {
      const select = screen.getByLabelText(/category/i)
      expect(select).toHaveValue('cat1')
    })
  })

  it('does not select inactive categories even if prefilledCategoryId matches', async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as any)

    mockSearchParams.categoryId = 'cat3' // Inactive category

    render(<NewClaimPage />)

    // Wait for async operations
    await waitFor(() => {
      const select = screen.getByLabelText(/category/i) as HTMLSelectElement
      // Should remain empty since cat3 is inactive
      // The useEffect should not set it because is_active = false
      expect(select.value).toBe('')
    }, { timeout: 2000 })
  })

  it('handles case when categories are not loaded yet', async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    mockSearchParams.categoryId = 'cat1'

    render(<NewClaimPage />)

    const select = screen.getByLabelText(/category/i)
    expect(screen.getByText('Select category')).toBeInTheDocument()
  })

  it('shows only active categories in dropdown', async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as any)

    render(<NewClaimPage />)

    await waitFor(() => {
      expect(screen.getByText('Transport')).toBeInTheDocument()
      expect(screen.getByText('Meals')).toBeInTheDocument()
      expect(screen.queryByText('Inactive Category')).not.toBeInTheDocument()
    })
  })

  it('disables category select when prefilled', async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as any)

    mockSearchParams.categoryId = 'cat1'

    render(<NewClaimPage />)

    await waitFor(() => {
      const select = screen.getByLabelText(/category/i)
      expect(select).toBeDisabled()
    })
  })
})
