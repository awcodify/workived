import { typography } from '@/design/tokens'
import type { Employee, EmployeeWorkload } from '@/types/api'
import { useEffect, useRef, useState } from 'react'
import { EmployeeSelector } from './EmployeeSelector'

interface TaskFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  selectedAssignee: string
  onAssigneeChange: (value: string) => void
  selectedPriority: string
  onPriorityChange: (value: string) => void
  showCompleted: boolean
  onShowCompletedChange: (value: boolean) => void
  employees: Employee[]
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function TaskFilters({
  searchQuery,
  onSearchChange,
  selectedAssignee,
  onAssigneeChange,
  selectedPriority,
  onPriorityChange,
  showCompleted,
  onShowCompletedChange,
  employees,
  getEmployeeWorkload,
  onClearFilters,
  hasActiveFilters,
}: TaskFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!showAdvanced) return

    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowAdvanced(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAdvanced])

  return (
    <div ref={filterRef} className="relative">
      {/* Main search bar + quick filter */}
      <div className="flex items-center gap-3">
        {/* Prominent search */}
        <div className="w-96">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg relative"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1.5px solid rgba(0, 0, 0, 0.12)',
              borderStyle: 'solid',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
              transform: 'rotate(-0.3deg)',
            }}
          >
            <span className="text-sm flex-shrink-0" style={{ opacity: 0.6 }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:font-normal"
              style={{
                color: '#2C3E50',
                fontFamily: typography.fontFamily,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-xs font-bold px-1.5 py-0.5 rounded transition-all hover:opacity-70"
                style={{
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: '#64748B',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick filters toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex-shrink-0"
          style={{
            background: hasActiveFilters || showAdvanced
              ? 'rgba(99, 102, 241, 0.08)'
              : 'rgba(0, 0, 0, 0.03)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            color: hasActiveFilters || showAdvanced ? '#6366F1' : '#64748B',
            fontFamily: typography.fontFamily,
            fontWeight: 500,
            fontSize: '12px',
            transform: 'rotate(0.4deg)',
          }}
        >
          <span style={{ fontSize: '11px', opacity: 0.7 }}>{showAdvanced ? '▲' : '▼'}</span>
          <span>Filters</span>
          {hasActiveFilters && (
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
              style={{
                background: '#6366F1',
                color: 'white',
              }}
            >
              {[selectedAssignee, selectedPriority, !showCompleted].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Advanced filters panel - Full width below */}
      {showAdvanced && (
        <div
          className="absolute left-0 right-0 top-full mt-3 px-4 py-4 rounded-xl z-10"
          style={{
            background: '#FFF9E6',
            border: '2px solid #E5DCC5',
            borderLeft: '4px solid #F59E0B',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
            transform: 'rotate(-0.25deg)',
          }}
        >
          {/* Notebook header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-dashed" style={{ borderColor: '#E5DCC5' }}>
            <h3
              className="text-xs font-bold uppercase"
              style={{
                color: '#D97706',
                fontFamily: "'Permanent Marker', 'Marker Felt', cursive",
                letterSpacing: '0.8px',
              }}
            >
              Advanced Filters
            </h3>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#DC2626',
                  fontFamily: typography.fontFamily,
                  border: '2px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Assignee Filter with workload indicators */}
            <EmployeeSelector
              value={selectedAssignee === 'unassigned' ? '' : selectedAssignee}
              onChange={(value) => onAssigneeChange(value || 'unassigned')}
              employees={employees}
              getEmployeeWorkload={getEmployeeWorkload}
              label="👤 Person"
              placeholder="All"
              showUnassigned={true}
            />

            {/* Priority Filter */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{
                  color: '#64748B',
                  fontFamily: typography.fontFamily,
                }}
              >
                🎯 Priority
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => onPriorityChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none transition-all font-medium"
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '2px solid rgba(245, 158, 11, 0.2)',
                  color: '#2C3E50',
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                <option value="">All priorities</option>
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟣 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">🟡 Low</option>
              </select>
            </div>

            {/* Show Completed */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{
                  color: '#64748B',
                  fontFamily: typography.fontFamily,
                }}
              >
                Status
              </label>
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                style={{
                  background: showCompleted
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(0, 0, 0, 0.03)',
                  border: showCompleted
                    ? '2px solid rgba(16, 185, 129, 0.3)'
                    : '2px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => onShowCompletedChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{
                    accentColor: '#10B981',
                  }}
                />
                <span
                  className="text-xs font-bold flex-1"
                  style={{
                    color: showCompleted ? '#059669' : '#646748B',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  ✓ Show done
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
