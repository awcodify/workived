/**
 * ColumnTabNav.test.tsx - Tests for mobile column tab navigation
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColumnTabNav } from './ColumnTabNav'
import type { TaskList } from '@/types/api'

const mockColumns: TaskList[] = [
  {
    id: 'list1',
    organisation_id: 'org1',
    name: 'To Do',
    position: 1,
    is_active: true,
    is_final_state: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'list2',
    organisation_id: 'org1',
    name: 'In Progress',
    position: 2,
    is_active: true,
    is_final_state: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'list3',
    organisation_id: 'org1',
    name: 'Done',
    position: 3,
    is_active: true,
    is_final_state: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const mockTaskCounts = {
  list1: 5,
  list2: 3,
  list3: 12,
}

describe('ColumnTabNav', () => {
  it('renders all column tabs', () => {
    render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('displays task counts for each column', () => {
    render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('highlights active tab', () => {
    const { container } = render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list2"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    const activeTab = container.querySelector('[aria-selected="true"]')
    expect(activeTab).toHaveTextContent('In Progress')
  })

  it('shows checkmark for final state column', () => {
    render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    const doneTab = screen.getByText('Done').parentElement
    expect(doneTab).toHaveTextContent('✓')
  })

  it('calls onColumnChange when tab is clicked', () => {
    const onColumnChange = vitest.fn()
    render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={onColumnChange}
      />
    )
    
    fireEvent.click(screen.getByText('In Progress'))
    expect(onColumnChange).toHaveBeenCalledWith('list2')
  })

  it('applies correct ARIA attributes', () => {
    const { container } = render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist).toBeInTheDocument()
    expect(tablist).toHaveAttribute('aria-label', 'Task columns')
    
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-controls', 'column-list1')
  })

  it('handles empty task counts gracefully', () => {
    render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={{}}
        onColumnChange={vitest.fn()}
      />
    )
    
    // Should default to 0 for missing counts
    const tabs = screen.getAllByRole('tab')
    tabs.forEach(tab => {
      expect(tab).toHaveTextContent('0')
    })
  })

  it('is accessible for keyboard navigation', () => {
    const { container } = render(
      <ColumnTabNav
        columns={mockColumns}
        activeColumnId="list1"
        taskCounts={mockTaskCounts}
        onColumnChange={vitest.fn()}
      />
    )
    
    const tabs = container.querySelectorAll('[role="tab"]')
    tabs.forEach(tab => {
      // All tabs should be button elements (focusable by default)
      expect(tab.tagName).toBe('BUTTON')
    })
  })
})
