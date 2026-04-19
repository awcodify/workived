import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/useTasks', () => ({
  useUpdateTask:        () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTask:        () => ({ mutate: vi.fn(), isPending: false }),
  useMoveTask:          () => ({ mutate: vi.fn(), isPending: false }),
  useCreateTask:        () => ({ mutate: vi.fn(), isPending: false }),
  useTaskComments:      () => ({ data: [], isLoading: false }),
  useCreateTaskComment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTaskComment: () => ({ mutate: vi.fn(), isPending: false }),
  useCommentReactions:  () => ({ data: [], isLoading: false }),
  useToggleReaction:    () => ({ mutate: vi.fn(), isPending: false }),
  useFieldDefinitions:  vi.fn(),
  useSetFieldValue:     () => ({ mutate: vi.fn(), isPending: false }),
  useClearFieldValue:   () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: () => ({ data: { timezone: 'Asia/Jakarta' } }),
}))

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rich-text-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('./ApprovalTaskView', () => ({ ApprovalTaskView: () => null }))
vi.mock('./ReactionPicker', () => ({ ReactionPicker: () => null }))
vi.mock('./workived/shared/Dropdown', () => ({
  Dropdown: ({ onChange }: { onChange: (v: string) => void }) => (
    <select data-testid="dropdown" onChange={(e) => onChange(e.target.value)} />
  ),
}))

import { useFieldDefinitions } from '@/lib/hooks/useTasks'
import { TaskDetailModal } from './TaskDetailModal'
import type { FieldDefinition } from '@/types/api'

const dateFieldDef: FieldDefinition = {
  id: 'fd-date-1',
  organisation_id: 'org-1',
  name: 'Target Date',
  field_type: 'date',
  description: '',
  options: [],
  is_active: true,
  position: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const baseProps = {
  mode: 'create' as const,
  employees: [],
  taskLists: [{ id: 'list-1', name: 'To Do', is_final_state: false, position: 1000 }],
  getEmployeeWorkload: () => undefined,
  onClose: vi.fn(),
}

describe('TaskDetailModal — due datetime picker in create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFieldDefinitions).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useFieldDefinitions>)
  })

  it('renders single datetime-local input', () => {
    render(<TaskDetailModal {...baseProps} />)
    const input = screen.getByTestId('task-due-datetime-input') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('datetime-local')
  })

  it('accepts a datetime value', () => {
    render(<TaskDetailModal {...baseProps} />)
    const input = screen.getByTestId('task-due-datetime-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-05-01T14:30' } })
    expect(input.value).toBe('2026-05-01T14:30')
  })

  it('clears datetime value', () => {
    render(<TaskDetailModal {...baseProps} />)
    const input = screen.getByTestId('task-due-datetime-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-05-01T14:30' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })
})

describe('TaskDetailModal — date custom field in create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFieldDefinitions).mockReturnValue({ data: [dateFieldDef], isLoading: false } as ReturnType<typeof useFieldDefinitions>)
  })

  it('reflects date picker value immediately when changed', () => {
    render(<TaskDetailModal {...baseProps} />)

    const dateInput = screen.getByTestId('field-input-date-fd-date-1') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-05-01' } })
    expect(dateInput.value).toBe('2026-05-01')
  })

  it('clears date value when input is cleared', () => {
    render(<TaskDetailModal {...baseProps} />)

    const dateInput = screen.getByTestId('field-input-date-fd-date-1') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-05-01' } })
    expect(dateInput.value).toBe('2026-05-01')
    fireEvent.change(dateInput, { target: { value: '' } })
    expect(dateInput.value).toBe('')
  })
})
