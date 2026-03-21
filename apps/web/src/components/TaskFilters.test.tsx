import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskFilters } from './TaskFilters'
import type { Employee } from '@/types/api'

const mockEmployees: Employee[] = [
  {
    id: '1',
    full_name: 'John Doe',
    email: 'john@example.com',
    employment_status: 'active',
    join_date: '2024-01-01',
    organisation_id: 'org-1',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    full_name: 'Jane Smith',
    email: 'jane@example.com',
    employment_status: 'active',
    join_date: '2024-01-01',
    organisation_id: 'org-1',
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockGetEmployeeWorkload = vi.fn(() => undefined)

describe('TaskFilters', () => {
  it('renders search input in collapsed state', () => {
    const mockOnSearchChange = vi.fn()

    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument()
  })

  it('expands when clicking on filter bar', () => {
    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    // Should not show expanded filters initially
    expect(screen.queryByText('Filter Options')).not.toBeInTheDocument()

    // Click expand button
    const expandButton = screen.getByText('▼')
    fireEvent.click(expandButton)

    // Should now show expanded filters
    expect(screen.getByText('Filter Options')).toBeInTheDocument()
  })

  it('shows expanded state when filters are active', () => {
    render(
      <TaskFilters
        searchQuery="test"
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Should be expanded by default when filters are active
    expect(screen.getByText('Filter Options')).toBeInTheDocument()
  })

  it('calls onSearchChange when search input changes', () => {
    const mockOnSearchChange = vi.fn()

    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search tasks...')
    fireEvent.change(searchInput, { target: { value: 'test task' } })

    expect(mockOnSearchChange).toHaveBeenCalledWith('test task')
  })

  it('calls onAssigneeChange when assignee filter changes', () => {
    const mockOnAssigneeChange = vi.fn()

    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={mockOnAssigneeChange}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    const assigneeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(assigneeSelect, { target: { value: '1' } })

    expect(mockOnAssigneeChange).toHaveBeenCalledWith('1')
  })

  it('calls onPriorityChange when priority filter changes', () => {
    const mockOnPriorityChange = vi.fn()

    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={mockOnPriorityChange}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    const prioritySelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(prioritySelect, { target: { value: 'high' } })

    expect(mockOnPriorityChange).toHaveBeenCalledWith('high')
  })

  it('calls onShowCompletedChange when checkbox is toggled', () => {
    const mockOnShowCompletedChange = vi.fn()

    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={mockOnShowCompletedChange}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(mockOnShowCompletedChange).toHaveBeenCalledWith(true)
  })

  it('shows clear filters button when filters are active', () => {
    render(
      <TaskFilters
        searchQuery="test"
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    expect(screen.getByText(/Clear all filters/i)).toBeInTheDocument()
  })

  it('hides clear filters button when no filters are active', () => {
    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    expect(screen.queryByText(/Clear all filters/i)).not.toBeInTheDocument()
  })

  it('calls onClearFilters when clear button is clicked', () => {
    const mockOnClearFilters = vi.fn()

    render(
      <TaskFilters
        searchQuery="test"
        onSearchChange={vi.fn()}
        selectedAssignee="1"
        onAssigneeChange={vi.fn()}
        selectedPriority="high"
        onPriorityChange={vi.fn()}
        showCompleted={true}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={mockOnClearFilters}
        hasActiveFilters={true}
      />
    )

    const clearButton = screen.getByText(/Clear all filters/i)
    fireEvent.click(clearButton)

    expect(mockOnClearFilters).toHaveBeenCalled()
  })

  it('renders employee options in assignee dropdown', () => {
    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('renders priority options in priority dropdown', () => {
    render(
      <TaskFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedAssignee=""
        onAssigneeChange={vi.fn()}
        selectedPriority=""
        onPriorityChange={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
        employees={mockEmployees}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    expect(screen.getByText('🔴 Urgent')).toBeInTheDocument()
    expect(screen.getByText('🟠 High')).toBeInTheDocument()
    expect(screen.getByText('🟡 Medium')).toBeInTheDocument()
    expect(screen.getByText('🟢 Low')).toBeInTheDocument()
  })
})
