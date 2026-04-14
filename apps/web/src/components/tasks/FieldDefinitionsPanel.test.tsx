import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { FieldDefinition } from '@/types/api'
import { FieldDefinitionsPanel } from './FieldDefinitionsPanel'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateMutate    = vi.fn()
const mockUpdateMutate    = vi.fn()
const mockDeactivateMutate = vi.fn()

vi.mock('@/lib/hooks/useTasks', () => ({
  useFieldDefinitions:        vi.fn(),
  useCreateFieldDefinition:   vi.fn(),
  useUpdateFieldDefinition:   vi.fn(),
  useDeactivateFieldDefinition: vi.fn(),
}))

import {
  useFieldDefinitions,
  useCreateFieldDefinition,
  useUpdateFieldDefinition,
  useDeactivateFieldDefinition,
} from '@/lib/hooks/useTasks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id:          'fd-1',
    name:        'Story Points',
    field_type:  'number',
    description: '',
    sort_order:  0,
    is_active:   true,
    created_at:  '2026-01-01T00:00:00Z',
    updated_at:  '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function setupMocks(fields: FieldDefinition[] = []) {
  vi.mocked(useFieldDefinitions).mockReturnValue({
    data: fields,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useCreateFieldDefinition).mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useUpdateFieldDefinition).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useDeactivateFieldDefinition).mockReturnValue({
    mutate: mockDeactivateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FieldDefinitionsPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders panel header', () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    expect(screen.getByText('Custom Fields')).toBeInTheDocument()
    expect(screen.getByText('Add extra data to every task')).toBeInTheDocument()
  })

  it('calls onClose when X button clicked', () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop clicked', () => {
    const { container } = render(<FieldDefinitionsPanel onClose={onClose} />)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows empty state when no fields', () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    expect(screen.getByText('No custom fields yet')).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useFieldDefinitions).mockReturnValue({
      data: [],
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(<FieldDefinitionsPanel onClose={onClose} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders existing field rows', () => {
    setupMocks([
      makeField({ id: 'fd-1', name: 'Story Points', field_type: 'number' }),
      makeField({ id: 'fd-2', name: 'Category',     field_type: 'select' }),
    ])
    render(<FieldDefinitionsPanel onClose={onClose} />)
    expect(screen.getByText('Story Points')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('shows type badge for each field', () => {
    setupMocks([makeField({ field_type: 'text', name: 'Notes' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)
    expect(screen.getByText(/Text/)).toBeInTheDocument()
  })

  it('opens create form when Add Field clicked', () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    expect(screen.getByText('New Field')).toBeInTheDocument()
  })

  it('closes form when Cancel clicked', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    expect(screen.getByText('New Field')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('New Field')).not.toBeInTheDocument()
    })
  })

  it('shows field_type selector only in create form', () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  it('shows options section when select type chosen', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'select' } })

    await waitFor(() => {
      expect(screen.getByText('Options')).toBeInTheDocument()
    })
  })

  it('shows options section for multi_select type', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'multi_select' } })

    await waitFor(() => {
      expect(screen.getByText('Options')).toBeInTheDocument()
    })
  })

  it('does not show options section for text type', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'text' } })

    await waitFor(() => {
      expect(screen.queryByText('Options')).not.toBeInTheDocument()
    })
  })

  it('shows validation error when submitting empty name', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    fireEvent.click(screen.getByText('Create Field'))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })

  it('calls createMutation when form submitted with valid name', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Story Points'), {
      target: { value: 'My Field' },
    })
    fireEvent.click(screen.getByText('Create Field'))

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Field', field_type: 'text' }),
        expect.any(Object),
      )
    })
  })

  it('shows edit form with existing data when Edit clicked', () => {
    setupMocks([makeField({ name: 'Story Points', field_type: 'number' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Edit Story Points'))
    expect(screen.getByText('Edit Field')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Story Points')).toBeInTheDocument()
  })

  it('does not show type selector in edit form', () => {
    setupMocks([makeField({ name: 'Story Points', field_type: 'number' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Edit Story Points'))
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })

  it('calls updateMutation when edit form submitted', async () => {
    setupMocks([makeField({ id: 'fd-1', name: 'Story Points' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Edit Story Points'))
    const nameInput = screen.getByDisplayValue('Story Points')
    fireEvent.change(nameInput, { target: { value: 'SP' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fd-1', data: expect.objectContaining({ name: 'SP' }) }),
        expect.any(Object),
      )
    })
  })

  it('shows delete confirm dialog when Delete clicked', () => {
    setupMocks([makeField({ name: 'Story Points' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Delete Story Points'))
    expect(screen.getByText((_, el) =>
      el?.tagName === 'H3' && (el.textContent ?? '').includes('Story Points')
    )).toBeInTheDocument()
  })

  it('calls deactivateMutation when delete confirmed', async () => {
    setupMocks([makeField({ id: 'fd-1', name: 'Story Points' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Delete Story Points'))
    fireEvent.click(screen.getByText('Hide Field'))

    await waitFor(() => {
      expect(mockDeactivateMutate).toHaveBeenCalledWith('fd-1', expect.any(Object))
    })
  })

  it('dismisses delete dialog when cancel clicked', () => {
    setupMocks([makeField({ name: 'Story Points' })])
    render(<FieldDefinitionsPanel onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Delete Story Points'))
    expect(screen.getByText((_, el) =>
      el?.tagName === 'H3' && (el.textContent ?? '').includes('Story Points')
    )).toBeInTheDocument()

    fireEvent.click(screen.getAllByText('Cancel')[0]!)
    expect(screen.queryByText((_, el) =>
      el?.tagName === 'H3' && (el.textContent ?? '').includes('Story Points')
    )).not.toBeInTheDocument()
  })

  it('shows error banner when create fails', () => {
    vi.mocked(useCreateFieldDefinition).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
      isError: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument()
  })

  it('shows saving state when mutation pending', () => {
    vi.mocked(useCreateFieldDefinition).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: true,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('shows options required error when submitting select type with no options', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    // Set name
    fireEvent.change(screen.getByPlaceholderText('e.g. Story Points'), {
      target: { value: 'My Select' },
    })

    // Pick select type
    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'select' } })

    await waitFor(() => screen.getByText('Options'))

    // Submit without adding any options
    fireEvent.click(screen.getByText('Create Field'))

    await waitFor(() => {
      expect(screen.getByText('At least one option is required')).toBeInTheDocument()
    })
    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('shows options required error for multi_select with no options', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Story Points'), {
      target: { value: 'Multi' },
    })

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'multi_select' } })

    await waitFor(() => screen.getByText('Options'))

    fireEvent.click(screen.getByText('Create Field'))

    await waitFor(() => {
      expect(screen.getByText('At least one option is required')).toBeInTheDocument()
    })
    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('can add and remove options in select form', async () => {
    render(<FieldDefinitionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Field'))

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'select' } })

    await waitFor(() => screen.getByText('Add option'))
    fireEvent.click(screen.getByText('Add option'))

    const valueInputs = screen.getAllByPlaceholderText('value')
    expect(valueInputs.length).toBe(1)

    fireEvent.click(screen.getByLabelText('Remove option'))

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText('value').length).toBe(0)
    })
  })
})
