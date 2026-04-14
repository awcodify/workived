/**
 * TaskCard - Enhanced task card with assignee avatar, due date, and status indicators
 * Mobile-optimized with touch targets and visible metadata
 */

import { useMemo } from 'react'
import { typography } from '@/design/tokens'
import { formatRelativeDueDate } from '@/lib/utils/date'
import type { TaskWithDetails, TaskPriority, Employee, EmployeeWorkload, FieldValueWithDefinition, FieldType } from '@/types/api'

// ── Field value formatter ────────────────────────────────────────────────────

function formatFieldValue(fv: FieldValueWithDefinition, employees: Employee[]): string | null {
  const truncate = (s: string, n = 28) => (s.length > n ? s.slice(0, n) + '…' : s)

  switch (fv.field_type as FieldType) {
    case 'text':
    case 'url':
    case 'select':
      return fv.value_text ? truncate(fv.value_text) : null

    case 'number':
      return fv.value_number != null ? String(fv.value_number) : null

    case 'rating':
      return fv.value_number != null
        ? '★'.repeat(Math.min(Math.max(Math.round(fv.value_number), 1), 5))
        : null

    case 'date':
      return fv.value_date
        ? new Date(fv.value_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null

    case 'boolean':
      return fv.value_boolean != null ? (fv.value_boolean ? '✓ Yes' : '✗ No') : null

    case 'multi_select': {
      const arr = Array.isArray(fv.value_json) ? (fv.value_json as string[]) : []
      return arr.length > 0 ? truncate(arr.join(', ')) : null
    }

    case 'employee': {
      if (!fv.value_text) return null
      const emp = employees.find((e) => e.id === fv.value_text)
      return emp ? truncate(emp.full_name) : null
    }

    default:
      return null
  }
}

interface TaskCardProps {
  task: TaskWithDetails
  isDragging?: boolean
  onClick?: () => void
  employees?: Employee[]
  getEmployeeWorkload?: (employeeId: string) => EmployeeWorkload | undefined
}

export function TaskCard({ 
  task, 
  isDragging, 
  onClick,
  employees = [],
  getEmployeeWorkload
}: TaskCardProps) {
  const isDone = !!task.completed_at
  
  // Find assignee
  const assignee = useMemo(() => 
    employees.find(e => e.id === task.assignee_id),
    [employees, task.assignee_id]
  )

  // Calculate if overdue
  const isOverdue = useMemo(() => {
    if (!task.due_date || isDone) return false
    const dueDate = new Date(task.due_date)
    const now = new Date()
    return dueDate < now
  }, [task.due_date, isDone])

  // Check if due today
  const isDueToday = useMemo(() => {
    if (!task.due_date || isDone) return false
    const dueDate = new Date(task.due_date)
    const today = new Date()
    return dueDate.toDateString() === today.toDateString()
  }, [task.due_date, isDone])

  // Format due date with relative time
  const formattedDueDate = useMemo(() => {
    if (!task.due_date) return null
    return formatRelativeDueDate(task.due_date)
  }, [task.due_date])

  // Top 2 non-empty custom field values for display on card
  const fieldChips = useMemo(() => {
    const values = task.field_values ?? []
    const chips: { label: string; value: string }[] = []
    for (const fv of values) {
      const formatted = formatFieldValue(fv, employees)
      if (formatted) {
        chips.push({ label: fv.field_name, value: formatted })
        if (chips.length === 2) break
      }
    }
    return chips
  }, [task.field_values, employees])
  
  // Vibrant sticky note colors
  const stickyColors: Record<TaskPriority, { bg: string; text: string; pin: string; tape: string }> = {
    urgent: { bg: '#FF9999', text: '#5C1A1A', pin: '#CC0000', tape: '#FFD6D6' },
    high: { bg: '#B19CD9', text: '#3D2A56', pin: '#6A4C9C', tape: '#E6D9FF' },
    medium: { bg: '#99EBFF', text: '#0D4552', pin: '#0099CC', tape: '#D6F7FF' },
    low: { bg: '#FFE066', text: '#5C4D00', pin: '#CCAA00', tape: '#FFF4CC' },
  }

  const colors = stickyColors[task.priority]
  
  // Seed for slight variations (no rotation, just for grid/edge)
  const seed = task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1)
  const hasGrid = seed % 3 === 0
  const hasTornEdge = false // Removed torn edge for cleaner look

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const first = parts[0][0]
      const second = parts[1][0]
      if (first && second) {
        return `${first}${second}`.toUpperCase()
      }
    }
    return name.substring(0, Math.min(2, name.length)).toUpperCase()
  }

  // Generate avatar color based on employee ID
  const getAvatarColor = (id: string) => {
    const avatarColors = [
      { bg: '#E3F2FD', text: '#1976D2' },
      { bg: '#F3E5F5', text: '#7B1FA2' },
      { bg: '#E8F5E9', text: '#388E3C' },
      { bg: '#FFF3E0', text: '#F57C00' },
      { bg: '#FCE4EC', text: '#C2185B' },
    ]
    const index = id.length > 0 ? id.charCodeAt(0) % avatarColors.length : 0
    return avatarColors[index]!
  }

  return (
    <div
      onClick={(e) => {
        if (onClick && !isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
      className="transition-all duration-150 relative"
      style={{
        background: isDone 
          ? '#F5F5F5' 
          : task.approval_type === 'claim'
            ? 'linear-gradient(to bottom, rgba(16, 185, 129, 0.03) 0%, #FFFFFF 60%)'
            : task.approval_type === 'leave'
              ? 'linear-gradient(to bottom, rgba(139, 92, 246, 0.03) 0%, #FFFFFF 60%)'
              : '#FFFFFF',
        borderRadius: '6px',
        borderLeft: task.approval_type === 'claim'
          ? `4px solid #10B981`
          : task.approval_type === 'leave'
            ? `4px solid #8B5CF6`
            : `4px solid ${isDone ? '#9CA3AF' : colors.pin}`,

        transform: isDragging ? 'scale(1.03)' : 'scale(1)',
        cursor: onClick ? 'pointer' : 'grab',
        opacity: isDone ? 0.7 : 1,
        boxShadow: isDragging
          ? `0 8px 16px rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.15)`
          : isDueToday
            ? `0 0 0 2px #F59E0B, 0 2px 4px rgba(0,0,0,0.1)`
            : task.approval_type === 'claim'
              ? `0 2px 8px rgba(16, 185, 129, 0.15), 0 1px 3px rgba(16, 185, 129, 0.2)`
              : task.approval_type === 'leave'
                ? `0 2px 8px rgba(139, 92, 246, 0.15), 0 1px 3px rgba(139, 92, 246, 0.2)`
                : `0 2px 4px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)`,
        minHeight: '88px', // Mobile: 44px touch target x2
        width: '100%',
        position: 'relative' as const,
        marginTop: '8px',
        border: task.approval_type === 'claim'
          ? '1px solid rgba(16, 185, 129, 0.2)'
          : task.approval_type === 'leave'
            ? '1px solid rgba(139, 92, 246, 0.2)'
            : '1px solid rgba(0,0,0,0.08)',
        // Overdue slow blink animation on border
        animation: isOverdue && !isDone ? 'borderBlink 1s ease-in-out infinite' : 'none',
      }}
    >
      {/* Blink animation keyframes */}
      <style>{`
        @keyframes borderBlink {
          0%, 100% { 
            box-shadow: 0 0 0 2px #EF4444, 0 2px 4px rgba(0,0,0,0.1);
          }
          50% { 
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2), 0 2px 4px rgba(0,0,0,0.1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>

      {/* Priority indicator (left border is now the main indicator) */}

      {/* Assignee Avatar (top-right) */}
      {assignee && (
        (() => {
          const avatarColor = getAvatarColor(assignee.id)
          const initials = getInitials(assignee.full_name)
          
          return (
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '8px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: avatarColor.bg,
                color: avatarColor.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: typography.fontFamily,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: '2px solid white',
                zIndex: 10,
              }}
              title={`Assigned to ${assignee.full_name}`}
            >
              {initials}
            </div>
          )
        })()
      )}

      {/* Grid pattern */}
      {hasGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '12px 12px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Approval ribbon - larger and more visible */}
      {task.approval_type && !task.completed_at && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: task.approval_type === 'claim'
              ? 'linear-gradient(90deg, #10B981 0%, #059669 50%, #10B981 100%)'
              : 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 50%, #8B5CF6 100%)',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            zIndex: 5,
          }}
        />
      )}

      <div className="px-4 py-3 h-full flex flex-col justify-between relative">
        {/* Title with approval label */}
        <div className="mb-2">
          {/* Approval label - prominent and clear */}
          {task.approval_type && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-2 text-xs font-bold uppercase"
              style={{
                background: task.approval_type === 'claim'
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFFFFF',
                fontFamily: typography.fontFamily,
                letterSpacing: '0.5px',
                boxShadow: task.approval_type === 'claim'
                  ? '0 2px 4px rgba(16, 185, 129, 0.3)'
                  : '0 2px 4px rgba(139, 92, 246, 0.3)',
              }}
            >
              <span>✓</span>
              <span>{task.approval_type === 'leave' ? 'Leave Approval' : 'Claim Approval'}</span>
            </div>
          )}
          
          <h3
            className="font-bold text-sm leading-snug line-clamp-2"
            style={{
              color: isDone ? '#6B7280' : '#1F2937',
              textDecoration: isDone ? 'line-through' : 'none',
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {task.title}
          </h3>
        </div>

        {/* Custom field chips */}
        {fieldChips.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-2">
            {fieldChips.map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-1 text-xs"
                style={{ fontFamily: typography.fontFamily }}
              >
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                  {chip.label}:
                </span>
                <span
                  className="truncate"
                  style={{ color: '#4B5563', fontWeight: 500 }}
                >
                  {chip.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer: Priority + Due date + Completed badge */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority badge */}
            <div
              className="px-2 py-0.5 rounded text-xs font-bold uppercase"
              style={{
                background: `${colors.pin}15`,
                color: colors.pin,
                fontFamily: typography.fontFamily,
                letterSpacing: '0.3px',
              }}
            >
              {task.priority}
            </div>

            {/* Due date */}
            { formattedDueDate && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                style={{
                  background: isOverdue 
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isDueToday
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(107, 114, 128, 0.1)',
                  color: isOverdue
                    ? '#DC2626'
                    : isDueToday
                      ? '#D97706'
                      : '#4B5563',
                  fontFamily: typography.fontFamily,
                }}
              >
                <span>{isOverdue ? '⚠️' : isDueToday ? '⚡' : '📅'}</span>
                <span>{formattedDueDate}</span>
              </div>
            )}
          </div>

          {/* Completed checkmark */}
          {isDone && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#059669',
                fontFamily: typography.fontFamily,
              }}
            >
              ✓ Done
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
