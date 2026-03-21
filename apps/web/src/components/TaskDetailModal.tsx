import { useState, useMemo, useEffect, useCallback } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { typography } from '@/design/tokens'
import type { TaskWithDetails, Employee, EmployeeWorkload, TaskPriority } from '@/types/api'
import {
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useCreateTask,
  useTaskComments,
  useCreateTaskComment,
  useDeleteTaskComment,
} from '@/lib/hooks/useTasks'

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
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date || '')
  const [listId, setListId] = useState(initialListId || task?.task_list_id || '')
  const [commentText, setCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const moveMutation = useMoveTask()
  const createTaskMutation = useCreateTask()
  const { data: commentsData } = useTaskComments(task?.id || '')
  const createCommentMutation = useCreateTaskComment()
  const deleteCommentMutation = useDeleteTaskComment()
  
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

  // Sort employees by workload: available first, on leave last
  const sortedEmployees = useMemo(() => {
    const statusOrder = { available: 1, warning: 2, overloaded: 3, on_leave: 4 }
    return [...employees].sort((a, b) => {
      const aWorkload = getEmployeeWorkload(a.id)
      const bWorkload = getEmployeeWorkload(b.id)
      const aOrder = aWorkload ? statusOrder[aWorkload.workload.status] || 5 : 5
      const bOrder = bWorkload ? statusOrder[bWorkload.workload.status] || 5 : 5
      return aOrder - bOrder
    })
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
      due_date: dueDate || undefined,
    }

    // Override with the specific field being changed
    if (field === 'title') data.title = value.trim()
    if (field === 'description') data.description = value.trim() || undefined
    if (field === 'assignee_id') data.assignee_id = value || undefined
    if (field === 'priority') data.priority = value
    if (field === 'due_date') data.due_date = value || undefined

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
  }, [isCreateMode, title, description, assigneeId, priority, dueDate, task, updateTaskMutation])

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

  const handleDueDateChange = (value: string) => {
    setDueDate(value)
    autoSave('due_date', value)
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
        due_date: dueDate || undefined,
      },
      {
        onSuccess: () => {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
            {/* Assignee */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: '#64748B', fontFamily: typography.fontFamily }}
              >
                👤 Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none font-semibold"
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontFamily: typography.fontFamily,
                }}
              >
                <option value="">Unassigned</option>
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

            {/* Priority */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: colors.text, opacity: 0.7, fontFamily: typography.fontFamily }}
              >
                🏷️ Priority
              </label>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none font-semibold"
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontFamily: typography.fontFamily,
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color:'#64748B', fontFamily: typography.fontFamily }}
              >
                📅 Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none font-semibold"
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontFamily: typography.fontFamily,
                }}
              />
            </div>
          </div>

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
