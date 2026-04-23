import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TaskWithDetails, Employee, FieldDefinition, TaskList } from '@/types/api'
import { AllIssuesTable } from './AllIssuesTable'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/useTasks', () => ({
  useAllTasks:        vi.fn(),
  useFieldDefinitions: vi.fn(),
}))

import { useAllTasks, useFieldDefinitions } from '@/lib/hooks/useTasks'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<TaskWithDetails> = {}): TaskWithDetails {
  return {
    id:            't-1',
    title:         'Fix login bug',
    description:   '',
    task_list_id:  'list-1',
    list_name:     'In Progress',
    position:      1000,
    priority:      'high',
    due_date:      '2026-06-01T00:00:00Z',
    assignee_id:   'emp-1',
    assignee_name: 'Alice Smith',
    created_at:    '2026-04-01T00:00:00Z',
    updated_at:    '2026-04-01T00:00:00Z',
    ...overrides,
  } as TaskWithDetails
}

const mockEmployee: Employee = {
  id:              'emp-1',
  user_id:         'user-1',
  organisation_id: 'org-1',
  full_name:       'Alice Smith',
  nid:             'E001',
  join_date:       '2024-01-01',
  employment_type: 'full_time',
  status:          'active',
  department_id:   'dept-1',
  department_name: 'Engineering',
  created_at:      '2024-01-01T00:00:00Z',
  updated_at:      '2024-01-01T00:00:00Z',
}

const mockTaskLists: TaskList[] = [
  {
    id:              'list-1',
    organisation_id: 'org-1',
    name:            'To Do',
    position:        1,
    is_final_state:  false,
    is_active:       true,
    created_at:      '2024-01-01T00:00:00Z',
    updated_at:      '2024-01-01T00:00:00Z',
  },
  {
    id:              'list-2',
    organisation_id: 'org-1',
    name:            'In Progress',
    position:        2,
    is_final_state:  false,
    is_active:       true,
    created_at:      '2024-01-01T00:00:00Z',
    updated_at:      '2024-01-01T00:00:00Z',
  },
  {
    id:              'list-3',
    organisation_id: 'org-1',
    name:            'Done',
    position:        3,
    is_final_state:  true,
    is_active:       true,
    created_at:      '2024-01-01T00:00:00Z',
    updated_at:      '2024-01-01T00:00:00Z',
  },
]

function setupMocks(tasks: TaskWithDetails[] = [], fieldDefs: FieldDefinition[] = [], hasMore = false) {
  vi.mocked(useAllTasks).mockReturnValue({
    data: { tasks, meta: { has_more: hasMore, next_cursor: hasMore ? 'cursor-2' : undefined, limit: 50 } },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useFieldDefinitions).mockReturnValue({
    data: fieldDefs,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AllIssuesTable', () => {
  const onTaskClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('shows empty state when no tasks', () => {
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('No tasks found')).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading', () => {
    vi.mocked(useAllTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders task rows', () => {
    setupMocks([makeTask(), makeTask({ id: 't-2', title: 'Add dark mode' })])
    render(<AllIssuesTable employees={mockEmployee ? [mockEmployee] : []} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    expect(screen.getByText('Add dark mode')).toBeInTheDocument()
  })

  it('renders table column headers', () => {
    setupMocks([makeTask()])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Assignee')).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
  })

  it('calls onTaskClick when row clicked', () => {
    const task = makeTask()
    setupMocks([task])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    fireEvent.click(screen.getByText('Fix login bug'))
    expect(onTaskClick).toHaveBeenCalledWith(task)
  })

  it('shows completed task with strikethrough indicator', () => {
    setupMocks([makeTask({ completed_at: '2026-04-10T00:00:00Z' } as Partial<TaskWithDetails>)])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    // The ✓ indicator is shown for completed tasks
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows priority badge', () => {
    setupMocks([makeTask({ priority: 'urgent' })])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  it('shows list name', () => {
    setupMocks([makeTask({ list_name: 'Done' })])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('shows assignee name', () => {
    setupMocks([makeTask()])
    render(<AllIssuesTable employees={[mockEmployee]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0)
  })

  it('shows dash for missing due date', () => {
    setupMocks([makeTask({ due_date: null })])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    // Multiple dashes expected (due, completed, etc.)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders custom field columns from active field definitions', () => {
    const fd: FieldDefinition = {
      id: 'fd-1', organisation_id: 'org-1', name: 'Deal Value', field_type: 'number',
      description: '', sort_order: 0, is_active: true,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    setupMocks([makeTask()], [fd])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('Deal Value')).toBeInTheDocument()
  })

  it('renders custom field value in row', () => {
    const fd: FieldDefinition = {
      id: 'fd-1', organisation_id: 'org-1', name: 'Points', field_type: 'number',
      description: '', sort_order: 0, is_active: true,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    const task = makeTask({
      field_values: [{ field_id: 'fd-1', field_name: 'Points', field_type: 'number', value_number: 42 }],
    })
    setupMocks([task], [fd])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('sorts by title when Title header clicked', async () => {
    setupMocks([
      makeTask({ id: 't-1', title: 'Zebra task' }),
      makeTask({ id: 't-2', title: 'Apple task' }),
    ])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1) // skip header
      expect(rows[0]).toHaveTextContent('Zebra task')
    })

    fireEvent.click(screen.getByText('Title'))
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('Apple task')
    })
  })

  it('shows Clear filters button when search is active', async () => {
    setupMocks([makeTask()])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)

    const searchInput = screen.getByPlaceholderText('Search tasks...')
    fireEvent.change(searchInput, { target: { value: 'bug' } })

    await waitFor(() => {
      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })
  })

  it('clears all filters when Clear filters clicked', async () => {
    setupMocks([makeTask()])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)

    fireEvent.change(screen.getByPlaceholderText('Search tasks...'), { target: { value: 'bug' } })
    await waitFor(() => screen.getByText('Clear filters'))

    fireEvent.click(screen.getByText('Clear filters'))
    await waitFor(() => {
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
    })
  })

  it('enables Next button when hasMore is true', () => {
    setupMocks([makeTask()], [], true)
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    const nextBtn = screen.getByText('Next →')
    expect(nextBtn).not.toBeDisabled()
  })

  it('disables Next button when no more pages', () => {
    setupMocks([makeTask()], [], false)
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('Next →')).toBeDisabled()
  })

  it('disables Prev button on first page', () => {
    setupMocks([makeTask()])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('← Prev')).toBeDisabled()
  })

  it('sorts by number custom field when column header clicked', async () => {
    const fd: FieldDefinition = {
      id: 'fd-sp', organisation_id: 'org-1', name: 'Story Points', field_type: 'number',
      description: '', sort_order: 0, is_active: true,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    const tasks = [
      makeTask({ id: 't-1', title: 'Task A', field_values: [{ field_id: 'fd-sp', field_name: 'Story Points', field_type: 'number', value_number: 8 }] }),
      makeTask({ id: 't-2', title: 'Task B', field_values: [{ field_id: 'fd-sp', field_name: 'Story Points', field_type: 'number', value_number: 2 }] }),
    ]
    setupMocks(tasks, [fd])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)

    fireEvent.click(screen.getByText('Story Points'))
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('Task A') // desc: 8 first
    })

    fireEvent.click(screen.getByText('Story Points'))
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent('Task B') // asc: 2 first
    })
  })

  it('shows task count', () => {
    setupMocks([makeTask(), makeTask({ id: 't-2', title: 'Task 2' })])
    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    expect(screen.getByText('2 tasks on this page')).toBeInTheDocument()
  })

  it('shows empty state with Clear filters link when filters active and no results', async () => {
    vi.mocked(useAllTasks).mockReturnValue({
      data: { tasks: [], meta: { has_more: false, limit: 50 } },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AllIssuesTable employees={[]} taskLists={mockTaskLists} onTaskClick={onTaskClick} />)
    fireEvent.change(screen.getByPlaceholderText('Search tasks...'), { target: { value: 'notfound' } })

    await waitFor(() => {
      expect(screen.getByText('No tasks found')).toBeInTheDocument()
    })
    // Should show clear filters link in empty state too
    expect(screen.getAllByText('Clear filters').length).toBeGreaterThan(0)
  })
})
