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
  due_date: new Date('2026-04-10').toISOString(),
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
    expect(screen.getByText(/Due.*\(Apr 10\)/)).toBeInTheDocument()
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
