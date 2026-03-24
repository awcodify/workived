import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmployeeSelector } from './EmployeeSelector'
import type { Employee, EmployeeWorkload } from '@/types/api'

const mockEmployees: Employee[] = [
  { id: '1', organisation_id: 'org1', full_name: 'Alice Available', email: 'alice@test.com', department_id: '1', employment_type: 'full_time', status: 'active', start_date: '2020-01-01', is_active: true, created_at: '', updated_at: '' },
  { id: '2', organisation_id: 'org1', full_name: 'Bob Overloaded', email: 'bob@test.com', department_id: '1', employment_type: 'full_time', status: 'active', start_date: '2020-01-01', is_active: true, created_at: '', updated_at: '' },
  { id: '3', organisation_id: 'org1', full_name: 'Charlie Warning', email: 'charlie@test.com', department_id: '1', employment_type: 'full_time', status: 'active', start_date: '2020-01-01', is_active: true, created_at: '', updated_at: '' },
  { id: '4', organisation_id: 'org1', full_name: 'Diana OnLeave', email: 'diana@test.com', department_id: '1', employment_type: 'full_time', status: 'active', start_date: '2020-01-01', is_active: true, created_at: '', updated_at: '' },
]

const mockWorkloadData: Record<string, EmployeeWorkload> = {
  '1': { employee_id: '1', full_name: 'Alice Available', workload: { active_tasks: 2, overdue_tasks: 0, status: 'available' }, leave: { is_on_leave: false, is_upcoming_leave: false } },
  '2': { employee_id: '2', full_name: 'Bob Overloaded', workload: { active_tasks: 8, overdue_tasks: 2, status: 'overloaded' }, leave: { is_on_leave: false, is_upcoming_leave: false } },
  '3': { employee_id: '3', full_name: 'Charlie Warning', workload: { active_tasks: 5, overdue_tasks: 1, status: 'warning' }, leave: { is_on_leave: false, is_upcoming_leave: false } },
  '4': { employee_id: '4', full_name: 'Diana OnLeave', workload: { active_tasks: 0, overdue_tasks: 0, status: 'on_leave' }, leave: { is_on_leave: true, is_upcoming_leave: false, leave_start: '2026-03-20', leave_end: '2026-03-27' } },
}

const getEmployeeWorkload = (id: string) => mockWorkloadData[id]

describe('EmployeeSelector', () => {
  it('renders with label and placeholder', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        label="👤 Assignee"
        placeholder="Unassigned"
        showUnassigned={true}
      />
    )

    expect(screen.getByText('👤 Assignee')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows unassigned option when showUnassigned is true', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        placeholder="No one"
        showUnassigned={true}
      />
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('')
    expect(screen.getByText('No one')).toBeInTheDocument()
  })

  it('hides unassigned option when showUnassigned is false', () => {
    render(
      <EmployeeSelector
        value="1"
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        showUnassigned={false}
      />
    )

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4) // Only employees, no unassigned
  })

  it('displays employees with workload badges', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        showUnassigned={true}
      />
    )

    // Available employee shows ✅
    expect(screen.getByText(/Alice Available.*✅/)).toBeInTheDocument()
    
    // Overloaded shows 🔴 + task count
    expect(screen.getByText(/Bob Overloaded.*🔴.*8 tasks/)).toBeInTheDocument()
    
    // Warning shows ⚠️ + task count
    expect(screen.getByText(/Charlie Warning.*⚠️.*5 tasks/)).toBeInTheDocument()
    
    // On leave shows 🏖️
    expect(screen.getByText(/Diana OnLeave.*🏖️ On Leave/)).toBeInTheDocument()
  })

  it('sorts employees: available → warning → overloaded → on_leave', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        showUnassigned={true}
      />
    )

    const options = screen.getAllByRole('option')
    // Skip first option (Unassigned)
    expect(options[1]).toHaveTextContent('Alice Available') // available
    expect(options[2]).toHaveTextContent('Charlie Warning') // warning
    expect(options[3]).toHaveTextContent('Bob Overloaded') // overloaded
    expect(options[4]).toHaveTextContent('Diana OnLeave') // on_leave
  })

  it('calls onChange when selection changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <EmployeeSelector
        value=""
        onChange={onChange}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        showUnassigned={true}
      />
    )

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '2')

    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('renders custom label and styles', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
        label="🎯 Owner"
        className="custom-class"
        style={{ background: 'red' }}
      />
    )

    expect(screen.getByText('🎯 Owner')).toBeInTheDocument()
    const select = screen.getByRole('combobox')
    expect(select).toHaveStyle({ background: 'red' })
  })

  it('handles employees without workload data', () => {
    const noWorkload = vi.fn(() => undefined)
    
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={noWorkload}
        showUnassigned={true}
      />
    )

    // Should render employees even without workload
    expect(screen.getByText('Alice Available')).toBeInTheDocument()
  })

  it('applies default label when not provided', () => {
    render(
      <EmployeeSelector
        value=""
        onChange={vi.fn()}
        employees={mockEmployees}
        getEmployeeWorkload={getEmployeeWorkload}
      />
    )

    expect(screen.getByText('👤 Assignee')).toBeInTheDocument()
  })
})
