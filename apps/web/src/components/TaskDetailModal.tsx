import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { ApprovalTaskView } from './ApprovalTaskView'
import { ReactionPicker } from './ReactionPicker'
import { Dropdown, type DropdownOption } from './workived/shared/Dropdown'
import { typography, colors } from '@/design/tokens'
import { orgTimeToUTC, utcToZonedDateTime } from '@/lib/utils/date'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import type { TaskWithDetails, Employee, EmployeeWorkload, TaskPriority, FieldDefinition, FieldValueWithDefinition } from '@/types/api'
import {
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useCreateTask,
  useTaskComments,
  useCreateTaskComment,
  useDeleteTaskComment,
  useCommentReactions,
  useToggleReaction,
  useFieldDefinitions,
  useSetFieldValue,
  useClearFieldValue,
} from '@/lib/hooks/useTasks'
import { DatePicker, DateTimePicker } from '@/components/ui'

// ── Utility Functions ────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  
  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

// ── TaskFieldsSection ─────────────────────────────────────────────────────────

const FIELDS_VISIBLE_DEFAULT = 2

const lightDropdownTheme = {
  text:        '#2C3E50',
  textMuted:   '#64748B',
  input:       '#F9FAFB',
  inputBorder: '#DFE1E6',
  surface:     '#FFFFFF',
  border:      '#DFE1E6',
  hoverBg:     '#F9FAFB',
}

function getCurrentValue(fd: FieldDefinition, fieldValues: FieldValueWithDefinition[]): FieldValueWithDefinition | undefined {
  return fieldValues.find((fv) => fv.field_id === fd.id)
}

function FieldInput({
  fd,
  current,
  taskId,
  employees,
  // Create mode — if provided, skips mutations and writes to local state instead
  createValue,
  onCreateChange,
  // Saving indicator callback
  onSavingChange,
}: {
  fd: FieldDefinition
  current: FieldValueWithDefinition | undefined
  taskId: string
  employees: Employee[]
  createValue?: unknown
  onCreateChange?: (value: unknown) => void
  onSavingChange?: (saving: boolean) => void
}) {
  const isCreateMode = onCreateChange !== undefined
  const setMutation   = useSetFieldValue()
  const clearMutation = useClearFieldValue()

  // Optimistic state: set immediately on user action, cleared when server value arrives
  const [optimistic, setOptimistic] = useState<{ value: unknown } | null>(null)
  const prevCurrent = useRef(current)
  useEffect(() => {
    // Cache updated → discard optimistic overlay
    if (prevCurrent.current !== current) {
      setOptimistic(null)
      prevCurrent.current = current
    }
  }, [current])

  const save = (value: unknown) => {
    if (isCreateMode) { onCreateChange(value); return }
    setOptimistic({ value })
    onSavingChange?.(true)
    setMutation.mutate({ taskId, fieldId: fd.id, value }, {
      onError:   () => setOptimistic(null),
      onSettled: () => onSavingChange?.(false),
    })
  }
  const clear = () => {
    if (isCreateMode) { onCreateChange(null); return }
    setOptimistic({ value: '' })   // immediate visual reset
    onSavingChange?.(true)
    clearMutation.mutate({ taskId, fieldId: fd.id }, {
      onError:   () => setOptimistic(null),
      onSettled: () => onSavingChange?.(false),
    })
  }

  // Resolved display values — create mode > optimistic > server
  // Note: select/employee store in value_json (not value_text) on the backend
  const serverText = current?.value_text ?? (typeof current?.value_json === 'string' ? current.value_json : '')
  const dispText = isCreateMode
    ? (createValue as string ?? '')
    : (optimistic !== null ? (optimistic.value as string ?? '') : serverText)
  const dispNumber = isCreateMode
    ? (typeof createValue === 'number' ? createValue : 0)
    : (optimistic !== null ? (typeof optimistic.value === 'number' ? optimistic.value : 0) : (current?.value_number ?? 0))
  const dispBool = isCreateMode
    ? (createValue === true)
    : (optimistic !== null ? (optimistic.value as boolean ?? false) : (current?.value_boolean ?? false))
  const dispJson = isCreateMode
    ? (Array.isArray(createValue) ? createValue as string[] : [])
    : (optimistic !== null
      ? (Array.isArray(optimistic.value) ? optimistic.value as string[] : [])
      : (Array.isArray(current?.value_json) ? current!.value_json as string[] : []))
  const hasValue = isCreateMode
    ? (createValue !== null && createValue !== undefined && createValue !== '' &&
       !(Array.isArray(createValue) && (createValue as unknown[]).length === 0))
    : (optimistic !== null
      ? (optimistic.value !== null && optimistic.value !== undefined && optimistic.value !== '')
      : (current !== undefined && (
          current.value_text !== undefined ||
          current.value_number !== undefined ||
          current.value_date !== undefined ||
          current.value_boolean !== undefined ||
          (current.value_json !== undefined && current.value_json !== null &&
           !(Array.isArray(current.value_json) && (current.value_json as unknown[]).length === 0))
        )))

  const inputStyle: React.CSSProperties = {
    background: '#F9FAFB',
    border: '1px solid #DFE1E6',
    borderRadius: '6px',
    color: '#2C3E50',
    fontFamily: typography.fontFamily,
    fontSize: '13px',
    padding: '6px 10px',
    width: '100%',
    outline: 'none',
  }

  const wrapper = (input: React.ReactNode) => (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 min-w-0">{input}</div>
      {hasValue && (
        <button type="button" onClick={clear} title="Clear value"
          className="flex-shrink-0 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
          style={{ color: '#94A3B8' }}
        >✕</button>
      )}
    </div>
  )

  switch (fd.field_type) {
    case 'text':
    case 'url': {
      const textKey = isCreateMode
        ? `cm_${String(createValue ?? 'empty')}`
        : (optimistic !== null ? `opt_${JSON.stringify(optimistic.value)}` : (current?.value_text ?? 'empty'))
      return wrapper(
        <input
          key={textKey}
          type={fd.field_type === 'url' ? 'url' : 'text'}
          defaultValue={dispText}
          placeholder={fd.description || fd.name}
          style={inputStyle}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v) save(v)
            else if (isCreateMode ? hasValue : current) clear()
          }}
        />
      )
    }

    case 'number': {
      const numKey = isCreateMode
        ? `cm_${String(createValue ?? 'empty')}`
        : (optimistic !== null ? `opt_${JSON.stringify(optimistic.value)}` : (current?.value_number ?? 'empty'))
      return wrapper(
        <input
          key={numKey}
          type="number"
          defaultValue={dispNumber || ''}
          placeholder="0"
          style={inputStyle}
          onBlur={(e) => {
            const v = e.target.value
            if (v !== '') save(parseFloat(v))
            else if (isCreateMode ? hasValue : current) clear()
          }}
        />
      )
    }

    case 'rating':
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => save(n)}
              className="text-lg leading-none transition-colors"
              style={{ color: dispNumber >= n ? '#F59E0B' : '#D1D5DB' }}
            >★</button>
          ))}
          {hasValue && (
            <button type="button" onClick={clear}
              className="text-xs ml-1 px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
              style={{ color: '#94A3B8' }}
            >✕</button>
          )}
        </div>
      )

    case 'date':
      return wrapper(
        <DatePicker
          data-testid={`field-input-date-${fd.id}`}
          value={isCreateMode
            ? (createValue as string ?? '')
            : (optimistic !== null ? (optimistic.value as string ?? '') : (current?.value_date ? current.value_date.split('T')[0] : ''))}
          style={{ ...inputStyle, colorScheme: 'light' }}
          onChange={(e) => {
            if (e.target.value) save(e.target.value)
            else if (isCreateMode ? hasValue : current) clear()
          }}
          className=""
        />
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dispBool}
            onChange={(e) => save(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-xs" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
            {dispBool ? 'Yes' : 'No'}
          </span>
        </label>
      )

    case 'select': {
      const opts: DropdownOption[] = [
        { value: '', label: '— select —' },
        ...(fd.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      ]
      return wrapper(
        <Dropdown
          value={dispText}
          onChange={(v) => { if (v) save(v); else clear() }}
          options={opts}
          fullWidth
          theme={lightDropdownTheme}
          style={{ fontSize: '13px', fontFamily: typography.fontFamily }}
        />
      )
    }

    case 'multi_select': {
      const opts = fd.options ?? []
      const selected = dispJson
      const toggle = (val: string) => {
        const next = selected.includes(val)
          ? selected.filter((v) => v !== val)
          : [...selected, val]
        if (next.length > 0) save(next)
        else clear()
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {opts.map((o) => {
            const isActive = selected.includes(o.value)
            const active = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="text-xs px-2 py-1 rounded-md font-medium transition-all"
                style={{
                  background: active ? '#C97B2A' : '#F3F4F6',
                  color:      active ? '#FFFFFF' : '#64748B',
                  fontFamily: typography.fontFamily,
                }}
              >
                {o.label}
              </button>
            )
          })}
          {hasValue && (
            <button type="button" onClick={clear}
              className="text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
              style={{ color: '#94A3B8' }}
            >✕</button>
          )}
        </div>
      )
    }

    case 'employee': {
      const opts: DropdownOption[] = [
        { value: '', label: '— select employee —' },
        ...employees.map((e) => ({ value: e.id, label: e.full_name })),
      ]
      return wrapper(
        <Dropdown
          value={dispText}
          onChange={(v) => { if (v) save(v); else clear() }}
          options={opts}
          fullWidth
          theme={lightDropdownTheme}
          style={{ fontSize: '13px', fontFamily: typography.fontFamily }}
        />
      )
    }

    default:
      return null
  }
}

interface TaskFieldsSectionProps {
  task?: TaskWithDetails
  employees: Employee[]
  // Create mode — pass pending values + change handler instead of task
  pendingFieldValues?: Record<string, unknown>
  onFieldChange?: (fieldId: string, value: unknown) => void
  onSavingChange?: (saving: boolean) => void
}

function TaskFieldsSection({ task, employees, pendingFieldValues, onFieldChange, onSavingChange }: TaskFieldsSectionProps) {
  const { data: fieldDefs = [], isLoading } = useFieldDefinitions()
  const [expanded, setExpanded] = useState(false)
  const isCreateMode = onFieldChange !== undefined

  const active = fieldDefs.filter((fd) => fd.is_active)
  const fieldValues = task?.field_values ?? []

  // Always show fields that have a value; fill remaining slots from top of list
  const visible = expanded
    ? active
    : (() => {
        const hasPendingOrSaved = (fd: FieldDefinition) => {
          if (isCreateMode) {
            const v = pendingFieldValues?.[fd.id]
            return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && (v as unknown[]).length === 0)
          }
          return fieldValues.some((fv) => fv.field_id === fd.id)
        }
        const withValue    = active.filter(hasPendingOrSaved)
        const withValueIds = new Set(withValue.map((fd) => fd.id))
        const withoutValue = active.filter((fd) => !withValueIds.has(fd.id))
        const extra        = withoutValue.slice(0, Math.max(0, FIELDS_VISIBLE_DEFAULT - withValue.length))
        const shown        = new Set([...withValue.map((fd) => fd.id), ...extra.map((fd) => fd.id)])
        return active.filter((fd) => shown.has(fd.id))
      })()

  const hiddenCount = active.length - visible.length

  if (isLoading || active.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <label
          className="block text-sm font-bold"
          style={{ color: '#64748B', fontFamily: typography.fontFamily }}
        >
          Custom Fields
        </label>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: '#C97B2A', fontFamily: typography.fontFamily }}
          >
            {expanded ? 'Show less' : `+${hiddenCount} more`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {visible.map((fd) => {
          const current = isCreateMode ? undefined : getCurrentValue(fd, fieldValues)
          return (
            <div key={fd.id}>
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
              >
                {fd.name}
              </label>
              <FieldInput
                fd={fd}
                current={current}
                taskId={task?.id ?? ''}
                employees={employees}
                createValue={isCreateMode ? pendingFieldValues?.[fd.id] : undefined}
                onCreateChange={isCreateMode ? (v) => onFieldChange(fd.id, v as unknown) : undefined}
                onSavingChange={onSavingChange}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

interface TaskDetailModalProps {
  mode?: 'create' | 'edit'
  task?: TaskWithDetails
  listId?: string
  employees: Employee[]
  taskLists: any[]
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
  onClose: () => void
}

export function TaskDetailModal({ mode = 'edit', task, listId: initialListId, employees, taskLists, getEmployeeWorkload, onClose }: TaskDetailModalProps) {
  const isCreateMode = mode === 'create'
  const isApprovalTask = task?.approval_type && task?.approval_id && !task?.completed_at
  const { data: org } = useOrganisation()
  const orgTz = org?.timezone ?? 'UTC'

  // If it's an approval task, show the approval view
  if (isApprovalTask && task) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl overflow-y-auto max-h-[90vh] relative"
          style={{
            background: '#FFFFFF',
            boxShadow: `
              0 24px 48px rgba(0,0,0,0.12),
              0 12px 24px rgba(0,0,0,0.08),
              0 0 0 1px rgba(0,0,0,0.05)
            `,
            borderRadius: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ApprovalTaskView task={task} onClose={onClose} />
        </div>
      </div>
    )
  }
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const initialDueParts = task?.due_date ? utcToZonedDateTime(task.due_date, orgTz) : null
  const [dueDatetime, setDueDatetime] = useState(
    initialDueParts ? `${initialDueParts.date}T${initialDueParts.time}` : ''
  )
  const [listId, setListId] = useState(initialListId || task?.task_list_id || '')
  const [commentText, setCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingFieldValues, setPendingFieldValues] = useState<Record<string, unknown>>({})

  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const moveMutation = useMoveTask()
  const createTaskMutation = useCreateTask()
  const createFieldValueMutation = useSetFieldValue()
  const { data: commentsData } = useTaskComments(task?.id || '')
  const createCommentMutation = useCreateTaskComment()
  const deleteCommentMutation = useDeleteTaskComment()
  const toggleReactionMutation = useToggleReaction()
  
  // Sync form state when task prop changes (e.g., after auto-save refetch)
  useEffect(() => {
    if (task) {
      const parts = task.due_date ? utcToZonedDateTime(task.due_date, orgTz) : null
      setTitle(task.title || '')
      setDescription(task.description || '')
      setAssigneeId(task.assignee_id || '')
      setPriority(task.priority || 'medium')
      setDueDatetime(parts ? `${parts.date}T${parts.time}` : '')
      setListId(task.task_list_id || '')
    }
  }, [task, orgTz])
  
  // Build hierarchical comment structure from flat list
  const comments = useMemo(() => {
    const flatComments = commentsData || []
    const commentMap = new Map<string, any>()
    const rootComments: any[] = []

    // First pass: create map of all comments
    flatComments.forEach((comment: any) => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // Second pass: build hierarchy
    flatComments.forEach((comment: any) => {
      const commentWithReplies = commentMap.get(comment.id)
      if (!comment.parent_id) {
        // Root comment
        rootComments.push(commentWithReplies)
      } else {
        // Nested comment - attach to parent
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies.push(commentWithReplies)
        }
      }
    })

    return rootComments
  }, [commentsData])

  // Build assignee dropdown options with workload indicators
  const assigneeOptions = useMemo((): DropdownOption[] => {
    const options: DropdownOption[] = [
      { value: '', label: 'Unassigned', description: 'No assignee' },
    ]

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

    sortedEmployees.forEach((emp) => {
      const workload = getEmployeeWorkload(emp.id)
      let description = ''
      let badge = ''

      if (workload) {
        if (workload.workload.status === 'on_leave') {
          description = 'On Leave'
          badge = '🏖️'
        } else if (workload.workload.status === 'overloaded') {
          description = `Overloaded • ${workload.workload.active_tasks} tasks`
          badge = '🔴'
        } else if (workload.workload.status === 'warning') {
          description = `Busy • ${workload.workload.active_tasks} tasks`
          badge = '⚠️'
        } else {
          description = `Available • ${workload.workload.active_tasks} tasks`
          badge = '✅'
        }
      } else {
        description = 'Available'
        badge = '✅'
      }

      options.push({
        value: emp.id,
        label: emp.full_name,
        description,
        badge,
      })
    })

    return options
  }, [employees, getEmployeeWorkload])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Auto-save helpers (only for edit mode)
  const buildDueDateUTC = useCallback((datetime: string): string | undefined => {
    if (!datetime) return undefined
    const [date, timeFull] = datetime.split('T')
    const time = (timeFull ?? '00:00').slice(0, 5) // strip seconds if present (HH:MM)
    return orgTimeToUTC(date!, time, orgTz)
  }, [orgTz])

  const autoSave = useCallback((field: string, value: any) => {
    if (isCreateMode) return // Don't auto-save in create mode
    if (!title.trim() || !task) return // Don't save if title is empty or no task

    setIsSaving(true)
    const saveStartTime = Date.now()
    const data: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignee_id: assigneeId || undefined,
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      due_date: buildDueDateUTC(dueDatetime),
    }

    // Override with the specific field being changed
    if (field === 'title') data.title = value.trim()
    if (field === 'description') data.description = value.trim() || undefined
    if (field === 'assignee_id') data.assignee_id = value || undefined
    if (field === 'priority') data.priority = value
    if (field === 'due_datetime') data.due_date = buildDueDateUTC(value)

    updateTaskMutation.mutate(
      { id: task!.id, data },
      {
        onSuccess: () => {
          // Minimum 500ms delay so user can see saving animation
          const elapsed = Date.now() - saveStartTime
          const remainingDelay = Math.max(0, 500 - elapsed)
          setTimeout(() => setIsSaving(false), remainingDelay)
        },
        onError: () => {
          const elapsed = Date.now() - saveStartTime
          const remainingDelay = Math.max(0, 500 - elapsed)
          setTimeout(() => setIsSaving(false), remainingDelay)
        },
      }
    )
  }, [isCreateMode, title, description, assigneeId, priority, dueDatetime, task, updateTaskMutation, buildDueDateUTC])

  const handleTitleChange = (value: string) => {
    setTitle(value)
  }

  const handleTitleBlur = () => {
    if (!task || title === task.title || !title.trim()) return
    autoSave('title', title)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
  }

  const handleDescriptionBlur = () => {
    if (!task || description === (task.description || '')) return
    autoSave('description', description)
  }

  const handleAssigneeChange = (value: string) => {
    setAssigneeId(value)
    autoSave('assignee_id', value)
  }

  const handlePriorityChange = (value: string) => {
    setPriority(value as 'low' | 'medium' | 'high' | 'urgent')
    autoSave('priority', value)
  }

  const handleDueDatetimeChange = (value: string) => {
    setDueDatetime(value)
    autoSave('due_datetime', value)
  }

  const handleDelete = () => {
    if (!task) return
    if (!confirm('Are you sure you want to delete this task?')) return

    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  const handleCreate = () => {
    if (!title.trim() || !listId) return

    createTaskMutation.mutate(
      {
        task_list_id: listId,
        title: title.trim(),
        description: description.trim() || undefined,
        assignee_id: assigneeId || undefined,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: buildDueDateUTC(dueDatetime) || undefined,
      },
      {
        onSuccess: (newTask) => {
          // Fire field value mutations for any pending custom field values
          const entries = Object.entries(pendingFieldValues)
          entries.forEach(([fieldId, value]) => {
            if (value !== null && value !== undefined && value !== '' &&
                !(Array.isArray(value) && (value as unknown[]).length === 0)) {
              createFieldValueMutation.mutate({ taskId: newTask.id, fieldId, value })
            }
          })
          onClose()
        },
      }
    )
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !task) return

    createCommentMutation.mutate(
      {
        taskId: task.id,
        data: {
          body: commentText.trim(),
          content_type: 'markdown',
          parent_id: replyingToId || undefined,
        },
      },
      {
        onSuccess: () => {
          setCommentText('')
          setReplyingToId(null)
        },
        onError: (error) => {
          console.error('Failed to add comment:', error)
        },
      }
    )
  }

  const handleDeleteComment = (commentId: string) => {
    if (!task) return
    if (!confirm('Delete this comment?')) return
    
    deleteCommentMutation.mutate(
      { taskId: task.id, commentId },
      {
        onError: (error) => {
          console.error('Failed to delete comment:', error)
          alert('Failed to delete comment. You can only delete your own comments.')
        },
      }
    )
  }

  const handleListChange = (newListId: string) => {
    if (!task || newListId === task.task_list_id) return

    setIsSaving(true)
    const saveStartTime = Date.now()
    const newPosition = 1000 // Backend will adjust

    moveMutation.mutate(
      {
        id: task.id,
        data: {
          task_list_id: newListId,
          position: newPosition,
        },
      },
      {
        onSuccess: () => {
          setListId(newListId)
          // Minimum 500ms delay so user can see saving animation
          const elapsed = Date.now() - saveStartTime
          const remainingDelay = Math.max(0, 500 - elapsed)
          setTimeout(() => setIsSaving(false), remainingDelay)
        },
        onError: () => {
          const elapsed = Date.now() - saveStartTime
          const remainingDelay = Math.max(0, 500 - elapsed)
          setTimeout(() => setIsSaving(false), remainingDelay)
        },
      }
    )
  }

  // Get vibrant sticky note colors for the modal
  const stickyColors: Record<TaskPriority, { bg: string; text: string; pin: string; tape: string }> = {
    urgent: { bg: '#FF9999', text: '#5C1A1A', pin: '#CC0000', tape: '#FFD6D6' },
    high: { bg: '#B19CD9', text: '#3D2A56', pin: '#6A4C9C', tape: '#E6D9FF' },
    medium: { bg: '#99EBFF', text: '#0D4552', pin: '#0099CC', tape: '#D6F7FF' },
    low: { bg: '#FFE066', text: '#5C4D00', pin: '#CCAA00', tape: '#FFF4CC' },
  }
  const colors = stickyColors[priority as TaskPriority]

  // Comment reactions component
  const CommentReactions = ({ taskId, commentId }: { taskId: string; commentId: string }) => {
    const { data: reactions = [] } = useCommentReactions(taskId, commentId)
    
    const handleToggleReaction = (emoji: string) => {
      if (!taskId || !commentId) return
      toggleReactionMutation.mutate({ taskId, commentId, emoji })
    }

    return (
      <ReactionPicker
        reactions={reactions}
        onToggle={handleToggleReaction}
        isLoading={toggleReactionMutation.isPending}
      />
    )
  }

  // Recursive comment renderer with nesting support
  const renderComment = (comment: any, depth: number = 0): React.ReactNode => {
    const marginLeft = depth * 24
    const maxDepth = 2
    const isReplyingToThis = replyingToId === comment.id
    
    return (
      <div key={comment.id} style={{ marginLeft: `${marginLeft}px` }} className="mb-3">
        <div
          className="rounded-lg p-3 relative group"
          style={{
            background: depth === 0 ? '#F8FAFC' : '#FFFFFF',
            border: '2px solid #E2E8F0',
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold"
                  style={{ color: '#1E293B', fontFamily: typography.fontFamily }}
                >
                  {comment.author_name}
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                >
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {depth < maxDepth && (
                <button
                  onClick={() => {
                    if (isReplyingToThis) {
                      setReplyingToId(null)
                      setCommentText('')
                    } else {
                      setReplyingToId(comment.id)
                      setCommentText(`@${comment.author_name} `)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold px-2 py-1 rounded"
                  style={{
                    background: isReplyingToThis ? '#DBEAFE' : '#EFF6FF',
                    color: '#2563EB',
                    fontFamily: typography.fontFamily,
                  }}
                  title={isReplyingToThis ? 'Cancel Reply' : 'Reply'}
                >
                  {isReplyingToThis ? '✕ Cancel' : '↩️ Reply'}
                </button>
              )}
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{
                  background: '#FEE2E2',
                  color: '#EF4444',
                }}
                title="Delete comment"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div
            className="text-sm prose prose-sm max-w-none"
            style={{ 
              color: '#334155',
              fontFamily: typography.fontFamily,
            }}
            dangerouslySetInnerHTML={{ 
              __html: comment.content_type === 'markdown' ? comment.body : `<p>${comment.body}</p>` 
            }}
          />

          {/* Emoji Reactions */}
          <CommentReactions taskId={task?.id || ''} commentId={comment.id} />
        </div>

        {/* Inline Reply Editor */}
        {isReplyingToThis && (
          <div className="mt-2" style={{ marginLeft: '0px' }}>
            <div
              className="px-3 py-2 rounded-t-lg"
              style={{
                background: '#EFF6FF',
                border: '2px solid #BFDBFE',
                borderBottom: 'none',
              }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: '#1E40AF', fontFamily: typography.fontFamily }}
              >
                💬 Replying to {comment.author_name}
              </span>
            </div>
            <div
              className="p-3 rounded-b-lg"
              style={{
                background: '#FFFFFF',
                border: '2px solid #BFDBFE',
              }}
            >
              <RichTextEditor
                value={commentText}
                onChange={setCommentText}
                placeholder="Write a reply..."
                textColor="#1E293B"
                bgColor="#F8FAFC"
                minHeight="80px"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || createCommentMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
                  style={{
                    background: commentText.trim() ? '#2563EB' : '#CBD5E1',
                    color: '#FFFFFF',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  {createCommentMutation.isPending ? 'Posting...' : 'Post Reply'}
                </button>
                <button
                  onClick={() => {
                    setReplyingToId(null)
                    setCommentText('')
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{
                    background: '#FEE2E2',
                    color: '#EF4444',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply: any) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-y-auto max-h-[90vh] relative"
        style={{
          background: '#FFFFFF',
          boxShadow: `
            0 24px 48px rgba(0,0,0,0.12),
            0 12px 24px rgba(0,0,0,0.08),
            0 0 0 1px rgba(0,0,0,0.05)
          `,
          borderRadius: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-3xl leading-none transition-opacity hover:opacity-70"
            style={{ color: '#64748B', opacity: 0.6 }}
          >
            ×
          </button>

          {/* Saving indicator */}
          {isSaving && (
            <div
              className="absolute top-6 right-16 flex items-center gap-2 text-xs font-semibold"
              style={{ color: '#64748B' }}
            >
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
              Saving...
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-3xl font-bold w-full bg-transparent border-none outline-none mb-4"
              style={{ 
                color: '#1E293B',
                fontFamily: typography.fontFamily,
              }}
              placeholder={isCreateMode ? "Enter task name..." : "Task title"}
            />
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Priority badge */}
              <div
                className="text-xs font-bold px-3 py-1.5 uppercase rounded-full"
                style={{
                  background: colors.bg,
                  color: colors.text,
                  letterSpacing: '0.5px',
                }}
              >
                {priority}
              </div>
              {/* Status dropdown badge - Only in edit mode */}
              {!isCreateMode && (
                <div className="relative inline-block">
                  <select
                    value={listId}
                    onChange={(e) => handleListChange(e.target.value)}
                    disabled={moveMutation.isPending}
                    className="text-xs font-semibold px-2 py-1 rounded appearance-none cursor-pointer pr-6"
                    style={{
                      background: `${colors.text}15`,
                      color: colors.text,
                      fontFamily: typography.fontFamily,
                      border: 'none',
                      outline: 'none',
                    }}
                  >
                    {taskLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        📋 {list.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ opacity: 0.5 }}
                  >
                    <path
                      d="M3 5l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: colors.text }}
                    />
                  </svg>
                </div>
              )}
              {task?.completed_at && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{
                    background: '#10B98115',
                    color: '#10B981',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  ✓ Completed
                </span>
              )}
            </div>

            {/* Creator metadata - Only show in edit mode */}
            {!isCreateMode && task && (
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-xs font-semibold"
                  style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
                >
                  Created by {task.creator_name}
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
                >
                  {formatRelativeTime(task.created_at)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: '#64748B', fontFamily: typography.fontFamily }}
            >
              Description
            </label>
            <RichTextEditor
              value={description}
              onChange={handleDescriptionChange}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              textColor={colors.text}
              bgColor={`${colors.text}08`}
              minHeight="120px"
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Assignee with workload indicators */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color:'#64748B', fontFamily: typography.fontFamily }}
              >
                👤 Assignee
              </label>
              <Dropdown
                value={assigneeId}
                onChange={handleAssigneeChange}
                options={assigneeOptions}
                fullWidth
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontSize: '12px',
                  fontWeight: '500',
                  fontFamily: typography.fontFamily,
                  width: '100%',
                }}
              />
            </div>

            {/* Priority */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color:'#64748B', fontFamily: typography.fontFamily }}
              >
                🏷️ Priority
              </label>
              <Dropdown
                value={priority}
                onChange={handlePriorityChange}
                options={[
                  { value: 'low', label: 'Low', description: 'Can wait for later' },
                  { value: 'medium', label: 'Medium', description: 'Normal priority' },
                  { value: 'high', label: 'High', description: 'Important task' },
                  { value: 'urgent', label: 'Urgent', description: 'Needs immediate attention', badge: '🔥' },
                ]}
                fullWidth
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontSize: '12px',
                  fontWeight: '500',
                  fontFamily: typography.fontFamily,
                  width: '100%',
                }}
              />
            </div>

            {/* Due Date */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color:'#64748B', fontFamily: typography.fontFamily }}
              >
                📅 Due Date
              </label>
              <DateTimePicker
                value={dueDatetime}
                onChange={handleDueDatetimeChange}
                dateProps={{
                  'data-testid': 'task-due-date-input',
                  className: 'rounded-lg px-3 py-2 text-xs outline-none font-medium',
                  style: {
                    background: `${colors.text}08`,
                    border: `2px solid ${colors.text}20`,
                    color: colors.text,
                    fontFamily: typography.fontFamily,
                    colorScheme: 'light',
                  }
                }}
                timeProps={{
                  'data-testid': 'task-due-time-input',
                  className: 'rounded-lg px-3 py-2 text-xs outline-none font-medium',
                  style: {
                    background: `${colors.text}08`,
                    border: `2px solid ${colors.text}20`,
                    color: colors.text,
                    fontFamily: typography.fontFamily,
                    colorScheme: 'light',
                  }
                }}
              />
            </div>
          </div>

          {/* Custom Fields */}
          {isCreateMode ? (
            <TaskFieldsSection
              employees={employees}
              pendingFieldValues={pendingFieldValues}
              onFieldChange={(fieldId, value) =>
                setPendingFieldValues((prev) => ({ ...prev, [fieldId]: value }))
              }
            />
          ) : (
            task && (
              <TaskFieldsSection
                task={task}
                employees={employees}
                onSavingChange={setIsSaving}
              />
            )
          )}

          {/* Actions */}
          {isCreateMode ? (
            <div className="flex items-center gap-3 pb-6 mb-6 border-b-2"
              style={{ borderColor: `${colors.text}20` }}
            >
              <button
                onClick={handleCreate}
                disabled={!title.trim() || createTaskMutation.isPending}
                className="flex-1 px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:scale-105"
                style={{
                  background: title.trim() ? '#F59E0B' : '#E2E8F0',
                  color: title.trim() ? '#000' : '#94A3B8',
                  fontFamily: typography.fontFamily,
                }}
              >
                {createTaskMutation.isPending ? 'Creating...' : '✨ Create Task'}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-black/5"
                style={{
                  background: '#F1F5F9',
                  color: '#64748B',
                  fontFamily: typography.fontFamily,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 pb-6 mb-6 border-b-2"
            style={{ borderColor: `${colors.text}20` }}
          >
            <button
              onClick={handleDelete}
              disabled={deleteTaskMutation.isPending}
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:scale-105"
              style={{
                background: '#EF444415',
                color: '#EF4444',
                border: '2px solid #EF444430',
                fontFamily: typography.fontFamily,
              }}
            >
              {deleteTaskMutation.isPending ? 'Deleting...' : '🗑️ Delete'}
            </button>
          </div>
          )}

          {/* Comments Section - Only in edit mode */}
          {!isCreateMode && task && (
            <div>
              <h3
                className="text-base font-bold mb-4"
                style={{ color: colors.text, fontFamily: typography.fontFamily }}
              >
                💬 Comments ({comments.length})
              </h3>

              {/* Comment List */}
              <div className="space-y-3 mb-4">
                {comments.map((comment: any) => renderComment(comment, 0))}
              </div>

              {/* Add Root Comment - Only show when not replying */}
              {!replyingToId && (
                <div>
                  <RichTextEditor
                    value={commentText}
                    onChange={setCommentText}
                    placeholder="Add a comment..."
                    textColor={colors.text}
                    bgColor={`${colors.text}08`}
                    minHeight="100px"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || createCommentMutation.isPending}
                    className="mt-2 w-full px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:scale-105"
                    style={{
                      background: commentText.trim() ? colors.text : `${colors.text}20`,
                      color: colors.bg,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    {createCommentMutation.isPending ? 'Posting...' : 'Add Comment'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
