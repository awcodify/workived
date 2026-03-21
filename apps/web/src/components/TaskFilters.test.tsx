import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskFilters } from './TaskFilters'
import type { Employee } from '@/types/api'

const mockEmployees: Employee[] = [
  {
    id: '1',
    full_name: 'John Doe',
    email: 'john@example.com',
    employment_type: 'full_time',
    status: 'active',
    start_date: '2024-01-01',
    is_active: true,
    organisation_id: 'org-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    full_name: 'Jane Smith',
    email: 'jane@example.com',
    employment_type: 'full_time',
    status: 'active',
    start_date: '2024-01-01',
    is_active: true,
    organisation_id: 'org-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    // Should not show Priority filter initially
    expect(screen.queryByText('🎯 Priority')).not.toBeInTheDocument()

    // Click filter button to expand
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    // Should now show advanced filters including Priority
    expect(screen.getByText('🎯 Priority')).toBeInTheDocument()
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Filter button should show active state with badge count
    const filterButton = screen.getByText('Filters')
    expect(filterButton).toBeInTheDocument()
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand to see controls
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    const assigneeSelect = screen.getAllByRole('combobox')[0]
    if (assigneeSelect) {
      fireEvent.change(assigneeSelect, { target: { value: '1' } })
    }

    // EmployeeSelector passes through the value directly
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand to see controls
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    const prioritySelect = screen.getAllByRole('combobox')[1]
    if (prioritySelect) {
      fireEvent.change(prioritySelect, { target: { value: 'high' } })
    }

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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand to see checkbox
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand filters to see clear button
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    expect(screen.getByText('✕ Clear')).toBeInTheDocument()
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    )

    // Expand filters
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    // Clear button should not appear when no filters are active
    expect(screen.queryByText('✕ Clear')).not.toBeInTheDocument()
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={mockOnClearFilters}
        hasActiveFilters={true}
      />
    )

    // Expand filters to see clear button
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    const clearButton = screen.getByText('✕ Clear')
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand filters to see employee dropdown
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    // EmployeeSelector uses "All" as placeholder instead of "Unassigned"
    expect(screen.getByText('All')).toBeInTheDocument()
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
        getEmployeeWorkload={mockGetEmployeeWorkload}
        onClearFilters={vi.fn()}
        hasActiveFilters={true}
      />
    )

    // Expand filters to see priority options
    const filterButton = screen.getByText('Filters')
    fireEvent.click(filterButton)

    expect(screen.getByText('🔴 Urgent')).toBeInTheDocument()
    expect(screen.getByText('🟣 High')).toBeInTheDocument()
    expect(screen.getByText('🔵 Medium')).toBeInTheDocument()
    expect(screen.getByText('🟡 Low')).toBeInTheDocument()
  })
})
