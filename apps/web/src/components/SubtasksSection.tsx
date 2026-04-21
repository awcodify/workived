import { useState, useMemo } from 'react'
import { ListTodo, Plus, X, CheckCircle2, Circle } from 'lucide-react'
import { typography, colors } from '@/design/tokens'
import { useSubtasks, useCreateSubtask } from '@/lib/hooks/useTasks'
import type { TaskWithDetails, TaskPriority } from '@/types/api'

interface SubtasksSectionProps {
  task: TaskWithDetails
  onSubtaskClick?: (subtaskId: string) => void
}

export function SubtasksSection({ task, onSubtaskClick }: SubtasksSectionProps) {
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [subtaskDescription, setSubtaskDescription] = useState('')
  const [subtaskPriority, setSubtaskPriority] = useState<TaskPriority>('medium')

  const { data: subtasksResponse } = useSubtasks(task.id)
  const createSubtaskMutation = useCreateSubtask()

  const subtasks = subtasksResponse || []

  // Compute counts from fetched subtasks - no backend needed
  const counts = useMemo(() => {
    if (subtasks.length === 0) return null
    const total = subtasks.length
    const completed = subtasks.filter(s => s.completed_at).length
    return { total, completed }
  }, [subtasks])

  const handleAddSubtask = () => {
    if (!subtaskTitle.trim()) return

    createSubtaskMutation.mutate(
      {
        parentTaskId: task.id,
        data: {
          title: subtaskTitle,
          description: subtaskDescription || undefined,
          priority: subtaskPriority,
        },
      },
      {
        onSuccess: () => {
          setSubtaskTitle('')
          setSubtaskDescription('')
          setSubtaskPriority('medium')
          setShowAddSubtask(false)
        },
      }
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-base font-bold flex items-center gap-2"
          style={{ color: colors.ink900, fontFamily: typography.fontFamily }}
        >
          <ListTodo size={18} />
          Subtasks
          {counts && counts.total > 0 && (
            <span
              className="ml-2 px-2.5 py-1 rounded-lg text-sm font-semibold"
              style={{
                background: counts.completed === counts.total 
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
                color: counts.completed === counts.total
                  ? '#059669'
                  : '#4F46E5',
              }}
            >
              {counts.completed}/{counts.total} • {Math.round((counts.completed / counts.total) * 100)}%
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowAddSubtask(!showAddSubtask)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 flex items-center gap-1.5"
          style={{
            background: `${colors.ink900}10`,
            color: colors.ink900,
            fontFamily: typography.fontFamily,
          }}
        >
          {showAddSubtask ? <X size={16} /> : <Plus size={16} />}
          {showAddSubtask ? 'Cancel' : 'Add Subtask'}
        </button>
      </div>

      {/* Add Subtask Form */}
      {showAddSubtask && (
        <div
          className="p-4 rounded-lg mb-4"
          style={{ background: `${colors.ink900}05`, border: `1px solid ${colors.ink900}15` }}
        >
          <div className="mb-3">
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: colors.ink500 }}
            >
              Title
            </label>
            <input
              type="text"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="Enter subtask title..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: colors.ink0,
                color: colors.ink900,
                border: `1px solid ${colors.ink900}15`,
                fontFamily: typography.fontFamily,
              }}
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: colors.ink500 }}
            >
              Description (optional)
            </label>
            <textarea
              value={subtaskDescription}
              onChange={(e) => setSubtaskDescription(e.target.value)}
              placeholder="Enter description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: colors.ink0,
                color: colors.ink900,
                border: `1px solid ${colors.ink900}15`,
                fontFamily: typography.fontFamily,
              }}
            />
          </div>

          <div className="mb-3">
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: colors.ink500 }}
            >
              Priority
            </label>
            <select
              value={subtaskPriority}
              onChange={(e) => setSubtaskPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: colors.ink0,
                color: colors.ink900,
                border: `1px solid ${colors.ink900}15`,
                fontFamily: typography.fontFamily,
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <button
            onClick={handleAddSubtask}
            disabled={!subtaskTitle.trim() || createSubtaskMutation.isPending}
            className="w-full px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:scale-105"
            style={{
              background: subtaskTitle.trim() ? colors.ink900 : `${colors.ink900}20`,
              color: colors.ink0,
              fontFamily: typography.fontFamily,
            }}
          >
            {createSubtaskMutation.isPending ? 'Creating...' : 'Create Subtask'}
          </button>
        </div>
      )}

      {/* Subtasks List */}
      {subtasks.length > 0 ? (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              onClick={() => onSubtaskClick?.(subtask.id)}
              className="flex items-center gap-3 p-3 rounded-lg group hover:shadow-sm transition-all cursor-pointer"
              style={{
                background: `${colors.ink900}05`,
                border: `1px solid ${colors.ink900}10`,
              }}
            >
              {/* Completion Icon */}
              <div
                className="flex-shrink-0"
                style={{ color: subtask.completed_at ? colors.ink900 : `${colors.ink900}30` }}
              >
                {subtask.completed_at ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div
                  className="font-semibold mb-1"
                  style={{
                    color: subtask.completed_at ? colors.ink500 : colors.ink900,
                    fontSize: '14px',
                    textDecoration: subtask.completed_at ? 'line-through' : 'none',
                  }}
                >
                  {subtask.title}
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: colors.ink500 }}>
                  <span
                    className="px-2 py-0.5 rounded uppercase font-bold"
                    style={{
                      background: `${colors.ink900}10`,
                      fontSize: '10px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {subtask.priority}
                  </span>
                  {subtask.assignee_name && (
                    <>
                      <span>•</span>
                      <span>{subtask.assignee_name}</span>
                    </>
                  )}
                  {subtask.completed_at && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Completed
                      </span>
                    </>
                  )}
                  {subtask.subtask_counts && subtask.subtask_counts.total > 0 && (
                    <>
                      <span>•</span>
                      <span
                        className="px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          background: subtask.subtask_counts.completed === subtask.subtask_counts.total
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(99, 102, 241, 0.15)',
                          color: subtask.subtask_counts.completed === subtask.subtask_counts.total
                            ? '#059669'
                            : '#4F46E5',
                        }}
                      >
                        {subtask.subtask_counts.completed}/{subtask.subtask_counts.total} ({Math.round((subtask.subtask_counts.completed / subtask.subtask_counts.total) * 100)}%)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Arrow icon */}
              <svg
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.ink500}
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="text-center py-8 text-sm"
          style={{ color: colors.ink500 }}
        >
          No subtasks yet. Break this task into smaller steps.
        </div>
      )}

      {/* Progress Bar */}
      {counts && counts.total > 0 && (
        <div className="mt-4">
          <div
            className="h-2.5 rounded-full overflow-hidden"
            style={{ background: `${colors.ink900}10` }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(counts.completed / counts.total) * 100}%`,
                background: counts.completed === counts.total
                  ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(90deg, #6366F1 0%, #4F46E5 100%)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
