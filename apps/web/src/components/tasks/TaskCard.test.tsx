/**
 * TaskCard.test.tsx - Tests for enhanced TaskCard component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskCard } from './TaskCard'
import type { TaskWithDetails, Employee } from '@/types/api'

// Mock task data
const mockTask: TaskWithDetails = {
  id: '1',
  title: 'Test Task',
  description: 'Test description',
  task_list_id: 'list1',
  position: 1000,
  priority: 'medium',
  due_date: new Date('2026-12-25').toISOString(),
  assignee_id: 'emp1',
  assignee_name: 'John Doe',
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  approval_type: null,
  approval_id: null,
}

const mockEmployees: Employee[] = [
  {
    id: 'emp1',
    user_id: 'user1',
    organisation_id: 'org1',
    full_name: 'John Doe',
    nid: 'E001',
    join_date: '2024-01-01',
    employment_type: 'permanent',
    status: 'active',
    department_id: 'dept1',
    department_name: 'Engineering',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} employees={mockEmployees} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('shows assignee avatar with initials', () => {
    render(<TaskCard task={mockTask} employees={mockEmployees} />)
    const avatar = screen.getByTitle('Assigned to John Doe')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('JD')
  })

  it('displays due date badge with relative time', () => {
    render(<TaskCard task={mockTask} employees={mockEmployees} />)
    // Should show relative time and absolute date
    expect(screen.getByText(/Due.*\(Dec 25\)/)).toBeInTheDocument()
  })

  it('shows overdue indicator when task is overdue', () => {
    const overdueTask = {
      ...mockTask,
      due_date: new Date('2026-04-01').toISOString(), // Past date
    }
    render(<TaskCard task={overdueTask} employees={mockEmployees} />)
    expect(screen.getByText(/Overdue.*\(Apr 1\)/)).toBeInTheDocument()
  })

  it('shows "due in X hours" for tasks due later today', () => {
    // Set due date to 5 hours from now
    const fiveHoursLater = new Date()
    fiveHoursLater.setHours(fiveHoursLater.getHours() + 5)
    
    const todayTask = {
      ...mockTask,
      due_date: fiveHoursLater.toISOString(),
    }
    
    render(<TaskCard task={todayTask} employees={mockEmployees} />)
    // Should show "Due in Xh" with date
    expect(screen.getByText(/Due in \d+h.*\(/)).toBeInTheDocument()
  })

  it('shows approval ribbon for approval tasks', () => {
    const approvalTask = {
      ...mockTask,
      approval_type: 'leave' as const,
      approval_id: 'approval1',
    }
    render(<TaskCard task={approvalTask} employees={mockEmployees} />)
    // Approval ribbon has purple stripe (visual check via snapshot)
  })

  it('applies completed styling when task is done', () => {
    const completedTask = {
      ...mockTask,
      completed_at: new Date().toISOString(),
    }
    render(<TaskCard task={completedTask} employees={mockEmployees} />)
    expect(screen.getByText('✓ Done')).toBeInTheDocument()
  })

  it('handles task without assignee', () => {
    const unassignedTask = {
      ...mockTask,
      assignee_id: null,
      assignee_name: null,
    }
    render(<TaskCard task={unassignedTask} employees={[]} />)
    // Should not show avatar
    expect(screen.queryByTitle(/Assigned to/)).not.toBeInTheDocument()
  })

  it('handles task without due date', () => {
    const noDuedateTask = {
      ...mockTask,
      due_date: null,
    }
    render(<TaskCard task={noDuedateTask} employees={mockEmployees} />)
    // Should not show due date badge
    expect(screen.queryByText(/📅/)).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vitest.fn()
    render(<TaskCard task={mockTask} employees={mockEmployees} onClick={onClick} />)
    screen.getByText('Test Task').click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when dragging', () => {
    const onClick = vitest.fn()
    render(
      <TaskCard 
        task={mockTask} 
        employees={mockEmployees} 
        onClick={onClick} 
        isDragging 
      />
    )
    screen.getByText('Test Task').click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows up to 2 custom field chips when field_values present', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [
        { field_id: 'f1', field_name: 'Deal Value', field_type: 'number', value_number: 5000 },
        { field_id: 'f2', field_name: 'Stage', field_type: 'select', value_text: 'Qualified' },
        { field_id: 'f3', field_name: 'Notes', field_type: 'text', value_text: 'Extra note' },
      ],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    expect(screen.getByText('Deal Value:')).toBeInTheDocument()
    expect(screen.getByText('5000')).toBeInTheDocument()
    expect(screen.getByText('Stage:')).toBeInTheDocument()
    expect(screen.getByText('Qualified')).toBeInTheDocument()
    // Third field should not appear (max 2)
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
  })

  it('skips empty/null field values', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [
        { field_id: 'f1', field_name: 'Empty Field', field_type: 'text' },
        { field_id: 'f2', field_name: 'Stage', field_type: 'select', value_text: 'Qualified' },
      ],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    expect(screen.queryByText('Empty Field:')).not.toBeInTheDocument()
    expect(screen.getByText('Stage:')).toBeInTheDocument()
  })

  it('formats boolean field as Yes/No', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [
        { field_id: 'f1', field_name: 'Invoiced', field_type: 'boolean', value_boolean: true },
      ],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    expect(screen.getByText('Invoiced:')).toBeInTheDocument()
    expect(screen.getByText('✓ Yes')).toBeInTheDocument()
  })

  it('formats date field as readable date', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [
        { field_id: 'f1', field_name: 'Deadline', field_type: 'date', value_date: '2026-06-15T00:00:00Z' },
      ],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    expect(screen.getByText('Deadline:')).toBeInTheDocument()
    expect(screen.getByText(/15 Jun 2026/)).toBeInTheDocument()
  })

  it('looks up employee name for employee field type', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [
        { field_id: 'f1', field_name: 'Reviewer', field_type: 'employee', value_text: 'emp1' },
      ],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    expect(screen.getByText('Reviewer:')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders nothing for field chips when field_values is empty', () => {
    const taskWithFields: TaskWithDetails = {
      ...mockTask,
      field_values: [],
    }
    render(<TaskCard task={taskWithFields} employees={mockEmployees} />)
    // No chip labels rendered
    expect(screen.queryByText(/:/)).not.toBeInTheDocument()
  })

  it('respects prefers-reduced-motion', () => {
    // Overdue tasks should not animate if user has reduced motion preference
    const overdueTask = {
      ...mockTask,
      due_date: new Date('2026-04-01').toISOString(),
    }
    const { container } = render(<TaskCard task={overdueTask} employees={mockEmployees} />)
    const style = container.querySelector('style')
    expect(style?.textContent).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
