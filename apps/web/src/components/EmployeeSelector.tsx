import { typography } from '@/design/tokens'
import type { Employee, EmployeeWorkload } from '@/types/api'

export interface EmployeeSelectorProps {
  value: string
  onChange: (employeeId: string) => void
  employees: Employee[]
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
  label?: string
  placeholder?: string
  showUnassigned?: boolean
  className?: string
  style?: React.CSSProperties
}

export function EmployeeSelector({
  value,
  onChange,
  employees,
  getEmployeeWorkload,
  label = '👤 Assignee',
  placeholder = 'Unassigned',
  showUnassigned = true,
  className = '',
  style = {},
}: EmployeeSelectorProps) {
  // Sort employees: available first, then warning, then overloaded, then on leave
  const sortedEmployees = [...employees].sort((a, b) => {
    const aWorkload = getEmployeeWorkload(a.id)
    const bWorkload = getEmployeeWorkload(b.id)
    
    const statusPriority = {
      available: 0,
      warning: 1,
      overloaded: 2,
      on_leave: 3,
    }
    
    const aStatus = aWorkload?.workload.status || 'available'
    const bStatus = bWorkload?.workload.status || 'available'
    
    if (statusPriority[aStatus] !== statusPriority[bStatus]) {
      return statusPriority[aStatus] - statusPriority[bStatus]
    }
    
    return a.full_name.localeCompare(b.full_name)
  })

  return (
    <div className={className}>
      {label && (
        <label
          className="block text-xs font-semibold mb-2"
          style={{
            color: '#64748B',
            fontFamily: typography.fontFamily,
          }}
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none transition-all font-medium"
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '2px solid rgba(99, 102, 241, 0.2)',
          color: '#2C3E50',
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
          ...style,
        }}
      >
        {showUnassigned && <option value="">{placeholder}</option>}
        {sortedEmployees.map((emp) => {
          const workload = getEmployeeWorkload(emp.id)
          const badge = workload 
            ? workload.workload.status === 'on_leave' 
              ? '🏖️ On Leave' 
              : workload.workload.status === 'overloaded' 
                ? `🔴 ${workload.workload.active_tasks} tasks` 
                : workload.workload.status === 'warning'
                  ? `⚠️ ${workload.workload.active_tasks} tasks`
                  : '✅'
            : ''
          return (
            <option key={emp.id} value={emp.id}>
              {emp.full_name} {badge}
            </option>
          )
        })}
      </select>
    </div>
  )
}
