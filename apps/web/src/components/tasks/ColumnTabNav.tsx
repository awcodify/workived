/**
 * ColumnTabNav - Mobile tab navigation for task columns
 * Shows on screens <640px, allows switching between To Do, In Progress, Done
 */

import { typography } from '@/design/tokens'
import type { TaskList } from '@/types/api'

interface ColumnTabNavProps {
  columns: TaskList[]
  activeColumnId: string
  taskCounts: Record<string, number>
  onColumnChange: (columnId: string) => void
}

export function ColumnTabNav({ 
  columns, 
  activeColumnId, 
  taskCounts, 
  onColumnChange 
}: ColumnTabNavProps) {
  return (
    <div 
      className="flex items-center gap-1 overflow-x-auto scrollbar-hide sticky top-0 z-10 pb-2 mb-4"
      style={{ 
        background: 'inherit',
      }}
      role="tablist"
      aria-label="Task columns"
    >
      {columns.map((column) => {
        const isActive = column.id === activeColumnId
        const count = taskCounts[column.id] || 0
        
        return (
          <button
            key={column.id}
            onClick={() => onColumnChange(column.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`column-${column.id}`}
            className="flex-1 min-w-[100px] px-4 py-3 rounded-lg transition-all"
            style={{
              background: isActive 
                ? 'rgba(255,255,255,0.9)' 
                : 'rgba(0,0,0,0.03)',
              boxShadow: isActive 
                ? '0 2px 8px rgba(0,0,0,0.12)' 
                : 'none',
              border: isActive 
                ? '2px solid rgba(0,0,0,0.1)' 
                : '2px solid transparent',
              fontFamily: typography.fontFamily,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#2C3E50' : '#64748B',
            }}
          >
            <div className="text-center">
              <div className="text-sm">
                {column.name}
                {column.is_final_state && (
                  <span className="ml-1" style={{ color: '#27AE60' }}>✓</span>
                )}
              </div>
              <div 
                className="text-xs mt-1"
                style={{ 
                  color: isActive ? '#7F8C8D' : '#94A3B8',
                  fontWeight: 600,
                }}
              >
                {count}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
