import { createFileRoute, redirect } from '@tanstack/react-router'
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { moduleBackgrounds, typography } from '@/design/tokens'
import { apiClient } from '@/lib/api/client'
import { 
  useTaskLists, 
  useTasks, 
  useMoveTask, 
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useTaskComments,
  useCreateTaskComment,
  useDeleteTaskComment,
} from '@/lib/hooks/useTasks'
import { useEmployees } from '@/lib/hooks/useEmployees'
import type { TaskWithDetails, TaskPriority, Employee } from '@/types/api'

export const Route = createFileRoute('/_app/tasks')({
  loader: async () => {
    try {
      const { data } = await apiClient.get<{ data: Record<string, boolean> }>('/api/v1/features')
      if (data.data.tasks === false) {
        throw redirect({ to: '/feature-disabled' })
      }
    } catch (err) {
      // Re-throw TanStack Router redirects; ignore network errors (fail open)
      if (err && typeof err === 'object' && 'to' in err) throw err
    }
  },
  component: TasksPage,
})

// ── Main Component ──────────────────────────────────────────────

function TasksPage() {
  const { data: taskLists = [], isLoading: listsLoading } = useTaskLists()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: employeesData } = useEmployees({ status: 'active' })
  const employees = employeesData?.data || []
  
  const moveMutation = useMoveTask()
  const createMutation = useCreateTask()

  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [activeTaskOriginalListId, setActiveTaskOriginalListId] = useState<string | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithDetails[]>([])
  const [creatingInListId, setCreatingInListId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)

  // Sync with server data (ensure we always have an array)
  useEffect(() => {
    setOptimisticTasks(tasks || [])
  }, [tasks])

  // Only render first 3 lists (To Do, In Progress, Done)
  const visibleLists = useMemo(() => {
    const lists = taskLists || []
    return lists
      .filter((list) => list.is_active)
      .sort((a, b) => a.position - b.position)
      .slice(0, 3)
  }, [taskLists])

  // Visual column config
  const columnConfig = useMemo(() => {
    const configs = [
      { accent: '#A0A0C0', accentDim: '#1A1A2E', headerBg: 'rgba(255,255,255,0.04)' },
      { accent: '#818CF8', accentDim: '#1E1B4B', headerBg: 'rgba(129,140,248,0.08)' },
      { accent: '#34D399', accentDim: '#0D2818', headerBg: 'rgba(52,211,153,0.06)' },
    ]
    return visibleLists.map((list, idx) => ({
      ...list,
      ...(configs[idx] || configs[0]), // Fallback to first config if index out of bounds
    }))
  }, [visibleLists])

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 3,
      } 
    }),
  )

  // Custom collision detection: prefer pointer within droppable areas (better for empty columns)
  const collisionDetectionStrategy = useCallback((args: any) => {
    // First, try pointer within (best for empty drop zones)
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    
    // Fallback to rectangle intersection
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      return rectCollisions
    }
    
    // Final fallback to closest center
    return closestCenter(args)
  }, [])

  const findListId = useCallback((id: string): string | undefined => {
    // Check if id is a list ID
    if (visibleLists.some((list) => list.id === id)) return id
    // Find task and return its list_id
    const tasks = optimisticTasks || []
    return tasks.find((t) => t.id === id)?.task_list_id
  }, [optimisticTasks, visibleLists])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const tasks = optimisticTasks || []
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) {
      setActiveTask(task)
      setActiveTaskOriginalListId(task.task_list_id) // Store original list ID
    }
  }, [optimisticTasks])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Don't update optimistic state here - let @dnd-kit handle visual feedback
    // Optimistic update happens in handleDragEnd to avoid conflicts
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const draggedTask = activeTask
    const originalListId = activeTaskOriginalListId
    setActiveTask(null)
    setActiveTaskOriginalListId(null)
    if (!over || !draggedTask || !originalListId) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    // Use ORIGINAL list ID (before handleDragOver updated it) for cross-list detection
    const activeListId = originalListId
    const overListId = findListId(overId)

    if (!activeListId || !overListId) return

    // Same list: reorder within list
    if (activeListId === overListId) {
      const listTasks = (optimisticTasks || [])
        .filter((t) => t.task_list_id === activeListId)
        .sort((a, b) => a.position - b.position)
      
      const oldIdx = listTasks.findIndex((t) => t.id === activeId)
      if (oldIdx === -1) return
      
      // Check if overId is a task or the list itself
      const newIdx = listTasks.findIndex((t) => t.id === overId)
      
      let newPosition: number
      let reordered: TaskWithDetails[]
      
      if (newIdx === -1) {
        // Dropped on the list itself (empty space) - move to end
        reordered = listTasks.filter((t) => t.id !== activeId)
        reordered.push(draggedTask)
        
        const lastTask = reordered[reordered.length - 2] // Task before the moved one
        newPosition = lastTask ? lastTask.position + 1000 : 1000
      } else {
        // Dropped on a specific task - reorder
        reordered = arrayMove(listTasks, oldIdx, newIdx)
        
        // Get the tasks before and after the drop position
        const taskBefore = newIdx > 0 ? reordered[newIdx - 1] : null
        const taskAfter = newIdx < reordered.length - 1 ? reordered[newIdx + 1] : null
        
        // Calculate new position with proper gaps (min=1 validation on backend)
        if (!taskBefore && taskAfter) {
          // Dropping at the start - ensure position stays >= 1
          const calculatedPos = taskAfter.position - 1000
          newPosition = calculatedPos >= 1 ? calculatedPos : Math.max(1, Math.floor(taskAfter.position / 2))
        } else if (taskBefore && !taskAfter) {
          // Dropping at the end
          newPosition = taskBefore.position + 1000
        } else if (taskBefore && taskAfter) {
          // Dropping between two tasks
          const gap = taskAfter.position - taskBefore.position
          newPosition = gap > 2 ? Math.floor((taskBefore.position + taskAfter.position) / 2) : taskBefore.position + 1
        } else {
          // Only task in list
          newPosition = 1000
        }
      }
      
      // Update optimistic state with new position
      const updatedReordered = reordered.map((t) => 
        t.id === activeId ? { ...t, position: newPosition } : t
      )
      const otherTasks = (optimisticTasks || []).filter((t) => t.task_list_id !== activeListId)
      
      setOptimisticTasks([...otherTasks, ...updatedReordered])
      
      // Persist to backend (outside of state setter to avoid duplicate calls)
      moveMutation.mutate(
        {
          id: activeId,
          data: {
            task_list_id: activeListId,
            position: newPosition,
          },
        },
        {
          onError: () => {
            console.error('Failed to move task, refetching...')
          }
        }
      )
    } else {
      // Different list: move to end of target list
      const listTasks = (optimisticTasks || [])
        .filter((t) => t.task_list_id === overListId && t.id !== activeId)
        .sort((a, b) => a.position - b.position)
      
      const maxPosition = listTasks.length > 0 
        ? Math.max(...listTasks.map((t) => t.position)) 
        : 0
      const newPosition = maxPosition + 1000

      // Check if we're moving FROM a final state list to a non-final state list
      const sourceList = visibleLists.find((l) => l.id === activeListId)
      const targetList = visibleLists.find((l) => l.id === overListId)
      const shouldUncomplete = sourceList?.is_final_state && !targetList?.is_final_state

      // Update the task with new list and position
      const updated = (optimisticTasks || []).map(t => 
        t.id === activeId 
          ? { 
              ...t, 
              task_list_id: overListId, 
              position: newPosition,
              // Auto-uncomplete if moving FROM final state to non-final state
              completed_at: shouldUncomplete ? undefined : t.completed_at
            }
          : t
      )
      
      setOptimisticTasks(updated)

      // Persist to backend (outside of state setter to avoid duplicate calls)
      moveMutation.mutate(
        {
          id: activeId,
          data: {
            task_list_id: overListId,
            position: newPosition,
          },
        },
        {
          onError: () => {
            console.error('Failed to move task to different list, refetching...')
          }
        }
      )
    }
  }, [activeTask, activeTaskOriginalListId, findListId, moveMutation, optimisticTasks, visibleLists])

  const handleCreateTask = useCallback((listId: string) => {
    if (!newTaskTitle.trim()) return
    
    createMutation.mutate(
      {
        task_list_id: listId,
        title: newTaskTitle.trim(),
        assignee_id: newTaskAssignee || undefined,
      },
      {
        onSuccess: () => {
          setNewTaskTitle('')
          setNewTaskAssignee('')
          setCreatingInListId(null)
        },
      }
    )
  }, [newTaskTitle, newTaskAssignee, createMutation])

  if (listsLoading || tasksLoading) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10 flex items-center justify-center"
        style={{ background: moduleBackgrounds.tasks }}
      >
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading tasks...</p>
      </div>
    )
  }

  const totalTasks = (optimisticTasks || []).length
  const completedTasks = (optimisticTasks || []).filter((t) => t.completed_at).length
  const inProgressList = visibleLists[1]
  const inProgressCount = inProgressList ? (optimisticTasks || []).filter(
    (t) => t.task_list_id === inProgressList.id && !t.completed_at
  ).length : 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.tasks }}  // Use design tokens
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-extrabold"
            style={{ 
              fontSize: 32, 
              letterSpacing: '-0.02em', 
              color: '#2C3E50', 
              lineHeight: 1,
              fontFamily: typography.fontFamily,
            }}
          >
            Tasks
          </h1>
          <p 
            className="mt-3" 
            style={{ 
              fontSize: 13, 
              color: '#7F8C8D',
              fontFamily: typography.fontFamily,
              fontWeight: 500,
            }}
          >
            {totalTasks} total · {inProgressCount} in progress · {completedTasks} done
          </p>
        </div>
      </div>

      {/* Unique Vertical Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-8 relative">
          {columnConfig.map((col, idx) => {
            const columnTasks = (optimisticTasks || [])
              .filter((t) => t.task_list_id === col.id)
              .sort((a, b) => a.position - b.position)
            return (
              <React.Fragment key={col.id}>
                <StatusColumn
                  listId={col.id}
                  label={col.name}
                  count={columnTasks.length}
                  tasks={columnTasks}
                  employees={employees}
                  creatingInListId={creatingInListId}
                  newTaskTitle={newTaskTitle}
                  newTaskAssignee={newTaskAssignee}
                  onCreateTask={handleCreateTask}
                  onTitleChange={setNewTaskTitle}
                  onAssigneeChange={setNewTaskAssignee}
                  onCancelCreate={() => {
                    setCreatingInListId(null)
                    setNewTaskTitle('')
                    setNewTaskAssignee('')
                  }}
                  onStartCreate={setCreatingInListId}
                  onTaskClick={setSelectedTask}
                  isFinalState={col.is_final_state}
                />
                
                {/* Hand-drawn vertical divider between columns */}
                {idx < columnConfig.length - 1 && (
                  <div 
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${((idx + 1) / 3) * 100}%`,
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg
                      width="6"
                      height="100%"
                      style={{ overflow: 'visible' }}
                    >
                      <path
                        d={`M 3 0 Q ${Math.random() * 2 + 2} ${Math.random() * 30 + 40}, 3 ${Math.random() * 30 + 70}
                            T 3 ${Math.random() * 40 + 140}
                            T 3 ${Math.random() * 40 + 210}
                            T 3 ${Math.random() * 40 + 280}
                            T 3 ${Math.random() * 40 + 350}
                            T 3 420
                            T 3 490
                            T 3 560`}
                        stroke="#2C3E50"
                        strokeWidth="2.5"
                        fill="none"
                        opacity="0.25"
                        strokeDasharray="4,8"
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
      
      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          employees={employees}
          taskLists={visibleLists}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

// ── Status Column ───────────────────────────────────────────────

function StatusColumn({
  listId,
  label,
  count,
  tasks,
  employees,
  creatingInListId,
  newTaskTitle,
  newTaskAssignee,
  onCreateTask,
  onTitleChange,
  onAssigneeChange,
  onCancelCreate,
  onStartCreate,
  onTaskClick,
  isFinalState,
}: {
  listId: string
  label: string
  count: number
  tasks: TaskWithDetails[]
  employees: Employee[]
  creatingInListId: string | null
  newTaskTitle: string
  newTaskAssignee: string
  onCreateTask: (listId: string) => void
  onTitleChange: (title: string) => void
  onAssigneeChange: (assigneeId: string) => void
  onCancelCreate: () => void
  onStartCreate: (listId: string) => void
  onTaskClick: (task: TaskWithDetails) => void
  isFinalState?: boolean
}) {
  const { setNodeRef } = useDroppable({ id: listId })
  const isCreating = creatingInListId === listId

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col min-h-[500px] transition-all"
      style={{
        background: 'transparent',
        borderRadius: '0',
        border: 'none',
        minHeight: '600px',
      }}
    >
      {/* Hand-drawn Column Header */}
      <div className="px-2 py-4 mb-4">
        <div className="inline-block">
          {/* Task count on the left */}
          <div className="flex items-baseline gap-2">
            <span
              className="text-sm font-bold"
              style={{
                color: '#7F8C8D',
                fontFamily: typography.fontFamily,
              }}
            >
              {count}
            </span>
            <h3
              className="text-xl font-bold"
              style={{
                color: '#2C3E50',
                fontFamily: "'Permanent Marker', 'Marker Felt', cursive",
                letterSpacing: '1px',
                transform: `rotate(${isFinalState ? -1 : 0}deg)`,
              }}
            >
              {label}
              {isFinalState && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '16px',
                    color: '#27AE60',
                  }}
                >
                  ✓
                </span>
              )}
            </h3>
          </div>
          {/* Hand-drawn underline */}
          <svg width="100%" height="8" style={{ overflow: 'visible' }}>
            <path
              d={`M 0 4 Q ${Math.random() * 20 + 40} ${Math.random() * 2 + 3}, ${Math.random() * 20 + 80} 4 T ${Math.random() * 20 + 160} 4`}
              stroke="#2C3E50"
              strokeWidth="2.5"
              fill="none"
              opacity="0.8"
            />
          </svg>
        </div>
      </div>

      {/* Tasks Container */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 px-4 py-3 flex-1">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}

          {/* Create Task Form */}
          {isCreating ? (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: 'rgba(255,255,255,0.6)',
                border: '2px solid rgba(0,0,0,0.1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTaskTitle.trim()) {
                    onCreateTask(listId)
                  } else if (e.key === 'Escape') {
                    onCancelCreate()
                  }
                }}
                placeholder="Task name"
                autoFocus
                className="w-full bg-transparent border-none outline-none text-sm mb-3"
                style={{
                  color: '#2C3E50',
                  fontFamily: typography.fontFamily,
                }}
              />

              <select
                value={newTaskAssignee}
                onChange={(e) => onAssigneeChange(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs mb-3"
                style={{
                  color: '#2C3E50',
                  fontFamily: typography.fontFamily,
                  background: 'rgba(255,255,255,0.5)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.15)',
                }}
              >
                <option value="" style={{ background: '#FFFFFF' }}>
                  Assign to...
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id} style={{ background: '#FFFFFF' }}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => onCreateTask(listId)}
                  disabled={!newTaskTitle.trim()}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: newTaskTitle.trim()
                      ? '#F59E0B'
                      : 'rgba(0,0,0,0.1)',
                    color: newTaskTitle.trim() ? '#000' : 'rgba(0,0,0,0.3)',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  Add task
                </button>
                <button
                  onClick={onCancelCreate}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-black/5"
                  style={{
                    background: 'rgba(0,0,0,0.05)',
                    color: 'rgba(0,0,0,0.6)',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onStartCreate(listId)}
              className="rounded-xl px-4 py-3 text-left text-sm font-medium transition-all hover:shadow-md"
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '2px dashed rgba(0,0,0,0.15)',
                color: 'rgba(0,0,0,0.5)',
                fontFamily: typography.fontFamily,
              }}
            >
              + Add task
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Sortable Task Card Wrapper ──────────────────────────────────

function SortableTaskCard({ task, onClick }: { task: TaskWithDetails; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  )
}

// ── Task Card ───────────────────────────────────────────────────

function TaskCard({ 
  task, 
  isDragging, 
  onClick 
}: { 
  task: TaskWithDetails
  isDragging?: boolean
  onClick?: () => void
}) {
  const isDone = !!task.completed_at
  
  // Vibrant sticky note colors
  const stickyColors: Record<TaskPriority, { bg: string; text: string; pin: string; tape: string }> = {
    urgent: { bg: '#FF9999', text: '#5C1A1A', pin: '#CC0000', tape: '#FFD6D6' },    // Pink/Red
    high: { bg: '#B19CD9', text: '#3D2A56', pin: '#6A4C9C', tape: '#E6D9FF' },      // Purple  
    medium: { bg: '#99EBFF', text: '#0D4552', pin: '#0099CC', tape: '#D6F7FF' },    // Cyan
    low: { bg: '#FFE066', text: '#5C4D00', pin: '#CCAA00', tape: '#FFF4CC' },       // Yellow
  }

  const colors = stickyColors[task.priority]
  
  // Subtle rotation (seeded by task ID)
  const seed = task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1)
  const rotation = ((seed % 9) - 4) * 0.6  // -2.4deg to +2.4deg
  const hasGrid = seed % 3 === 0  // Some cards have grid pattern
  const hasTornEdge = seed % 2 === 0  // Some cards have torn top edge

  return (
    <div
      onClick={(e) => {
        if (onClick && !isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
      className="transition-all duration-150"
      style={{
        background: isDone ? '#D5DBDB' : colors.bg,
        borderRadius: '3px',
        transform: isDragging 
          ? `rotate(${rotation + 2}deg) scale(1.05)` 
          : `rotate(${rotation}deg)`,
        cursor: onClick ? 'pointer' : 'grab',
        opacity: isDone ? 0.7 : 1,
        boxShadow: isDragging
          ? `0 8px 16px rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.15)`
          : `0 2px 4px rgba(0,0,0,0.1), 0 3px 6px rgba(0,0,0,0.08)`,
        minHeight: '100px',
        width: '100%',
        position: 'relative' as const,
        marginTop: hasTornEdge ? '12px' : '8px',
      }}
    >
      {/* Torn/Notched edge at top */}
      {hasTornEdge && (
        <div
          style={{
            position: 'absolute',
            top: '-12px',
            left: 0,
            right: 0,
            height: '12px',
            background: colors.bg,
            opacity: isDone ? 0.7 : 1,
            borderRadius: '3px 3px 0 0',
            // Create notched/perforated effect
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 8px,
              ${colors.bg} 8px,
              ${colors.bg} 10px,
              transparent 10px,
              transparent 12px
            )`,
            backgroundPosition: '0 100%',
            backgroundSize: '100% 6px',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      
      {/* Tape label at top center */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <div
          className="text-[11px] font-extrabold uppercase px-6 py-2 whitespace-nowrap"
          style={{
            background: colors.tape,
            color: colors.text,
            fontFamily: typography.fontFamily,
            letterSpacing: '1px',
            transform: 'rotate(-1.5deg)',
            boxShadow: `0 2px 4px rgba(0,0,0,0.1), 0 3px 6px rgba(0,0,0,0.08)`,
            position: 'relative',
            clipPath: `polygon(
              3% 0%, 
              97% 0%, 
              100% 8%, 
              98% 18%, 
              100% 35%, 
              97% 50%, 
              100% 65%, 
              98% 82%, 
              100% 92%, 
              97% 100%, 
              3% 100%, 
              0% 92%, 
              2% 82%, 
              0% 65%, 
              3% 50%, 
              0% 35%, 
              2% 18%, 
              0% 8%
            )`,
          }}
        >
          {task.priority}
          {/* Paper fiber texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 1px,
                  rgba(0,0,0,0.015) 1px,
                  rgba(0,0,0,0.015) 2px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 1px,
                  rgba(255,255,255,0.03) 1px,
                  rgba(255,255,255,0.03) 2px
                )
              `,
              pointerEvents: 'none',
              opacity: 0.8,
            }}
          />
          {/* Subtle paper grain */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              opacity: 0.05,
              mixBlendMode: 'multiply',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Grid pattern overlay (some cards) */}
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
      
      <div className="px-4 py-3.5 h-full flex flex-col justify-between relative">
        {/* Title */}
        <h3
          className="font-bold text-[15px] leading-snug mb-2.5"
          style={{
            color: colors.text,
            textDecoration: isDone ? 'line-through' : 'none',
            fontFamily: "'Permanent Marker', 'Marker Felt', cursive",
            fontWeight: 700,
          }}
        >
          {task.title}
        </h3>

        {/* Metadata */}
        <div className="flex items-end justify-between gap-2 text-xs border-t pt-2"
          style={{ borderColor: `${colors.text}20` }}
        >
          <div className="flex flex-col gap-0.5">
            {task.assignee_name ? (
              <div
                className="inline-flex items-center gap-1 px-2 py-1 rounded"
                style={{
                  background: `${colors.text}15`,
                  border: `1px solid ${colors.text}25`,
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                  }}
                >
                  👤
                </span>
                <span
                  className="text-xs font-bold"
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily,
                    fontSize: '12px',
                  }}
                >
                  {task.assignee_name}
                </span>
              </div>
            ) : (
              <span
                className="text-xs italic px-2 py-1"
                style={{
                  color: colors.text,
                  opacity: 0.4,
                  fontFamily: typography.fontFamily,
                  fontSize: '11px',
                }}
              >
                Unassigned
              </span>
            )}
          </div>

          {/* Right: Due date or Done */}
          <div className="flex items-center gap-2">
            {isDone ? (
              <span
                className="text-sm font-bold"
                style={{
                  color: colors.text,
                  opacity: 0.7,
                }}
              >
                ✓
              </span>
            ) : (
              <>
                {task.due_date && (
                  <span
                    className="text-[11px] font-semibold"
                    style={{
                      color: colors.text,
                      opacity: 0.65,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    📅 {task.due_date}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Task Detail Modal ───────────────────────────────────────────

interface TaskDetailModalProps {
  task: TaskWithDetails
  employees: Employee[]
  taskLists: any[]
  onClose: () => void
}

function TaskDetailModal({ task, employees, taskLists, onClose }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [listId, setListId] = useState(task.task_list_id)
  const [commentText, setCommentText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const moveMutation = useMoveTask()
  const { data: commentsData } = useTaskComments(task.id)
  const createCommentMutation = useCreateTaskComment()
  const deleteCommentMutation = useDeleteTaskComment()
  const comments = commentsData || []

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Auto-save helpers
  const autoSave = useCallback((field: string, value: any) => {
    if (!title.trim()) return // Don't save if title is empty

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
      { id: task.id, data },
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
  }, [title, description, assigneeId, priority, dueDate, task.id, updateTaskMutation])

  const handleTitleChange = (value: string) => {
    setTitle(value)
  }

  const handleTitleBlur = () => {
    if (title !== task.title && title.trim()) {
      autoSave('title', title)
    }
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
  }

  const handleDescriptionBlur = () => {
    if (description !== (task.description || '')) {
      autoSave('description', description)
    }
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
    if (!confirm('Are you sure you want to delete this task?')) return

    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  const handleAddComment = () => {
    if (!commentText.trim()) return

    createCommentMutation.mutate(
      {
        taskId: task.id,
        data: { body: commentText.trim() },
      },
      {
        onSuccess: () => {
          setCommentText('')
        },
      }
    )
  }

  const handleDeleteComment = (commentId: string) => {
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
    if (newListId === task.task_list_id) return

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

  // Subtle variations based on task ID
  const seed = task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1)
  const hasGrid = seed % 3 === 0

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
          background: colors.bg,
          boxShadow: `
            0 12px 24px rgba(0,0,0,0.2),
            0 20px 40px rgba(0,0,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.3)
          `,
          transform: 'rotate(-0.5deg)',
          borderRadius: '4px',
          // Torn edges effect
          clipPath: `polygon(
            0% 2%, 1% 0%, 2% 1.5%, 3% 0.5%, 4% 2%, 5% 1%, 6% 2.5%, 7% 1.5%, 8% 2%, 9% 0.5%, 10% 2%,
            11% 1%, 12% 2%, 13% 0.5%, 14% 1.5%, 15% 2%, 16% 1%, 17% 2.5%, 18% 1%, 19% 2%, 20% 0.5%,
            21% 1.5%, 22% 2%, 23% 1%, 24% 2%, 25% 1.5%, 26% 2%, 27% 1%, 28% 2.5%, 29% 1.5%, 30% 2%,
            31% 1%, 32% 2%, 33% 0.5%, 34% 1.5%, 35% 2%, 36% 1%, 37% 2%, 38% 1.5%, 39% 2%, 40% 1%,
            41% 2%, 42% 1.5%, 43% 2%, 44% 1%, 45% 2%, 46% 1.5%, 47% 2%, 48% 0.5%, 49% 1.5%, 50% 2%,
            51% 1%, 52% 2%, 53% 1.5%, 54% 2%, 55% 1%, 56% 2%, 57% 1.5%, 58% 2%, 59% 1%, 60% 2%,
            61% 1.5%, 62% 2%, 63% 1%, 64% 2%, 65% 1.5%, 66% 2%, 67% 1%, 68% 2%, 69% 1.5%, 70% 2%,
            71% 1%, 72% 2%, 73% 1.5%, 74% 2%, 75% 1%, 76% 2%, 77% 1.5%, 78% 2%, 79% 1%, 80% 2%,
            81% 1.5%, 82% 2%, 83% 1%, 84% 2%, 85% 1.5%, 86% 2%, 87% 1%, 88% 2%, 89% 1.5%, 90% 2%,
            91% 1%, 92% 2%, 93% 1.5%, 94% 2%, 95% 1%, 96% 2%, 97% 1.5%, 98% 2%, 99% 1%, 100% 2%,
            100% 98%, 99% 100%, 98% 98.5%, 97% 99.5%, 96% 98%, 95% 99%, 94% 98%, 93% 99.5%, 92% 98.5%, 91% 99%, 90% 98%,
            89% 99%, 88% 98.5%, 87% 99.5%, 86% 98%, 85% 99%, 84% 98%, 83% 99%, 82% 98.5%, 81% 99%, 80% 98%,
            79% 99%, 78% 98.5%, 77% 99%, 76% 98%, 75% 99%, 74% 98.5%, 73% 99%, 72% 98%, 71% 99%, 70% 98.5%,
            69% 99%, 68% 98%, 67% 99%, 66% 98.5%, 65% 99%, 64% 98%, 63% 99%, 62% 98.5%, 61% 99%, 60% 98%,
            59% 99%, 58% 98.5%, 57% 99%, 56% 98%, 55% 99%, 54% 98.5%, 53% 99%, 52% 98%, 51% 99%, 50% 98.5%,
            49% 99%, 48% 98%, 47% 99%, 46% 98.5%, 45% 99%, 44% 98%, 43% 99%, 42% 98.5%, 41% 99%, 40% 98%,
            39% 99%, 38% 98.5%, 37% 99%, 36% 98%, 35% 99%, 34% 98.5%, 33% 99%, 32% 98%, 31% 99%, 30% 98.5%,
            29% 99%, 28% 98%, 27% 99%, 26% 98.5%, 25% 99%, 24% 98%, 23% 99%, 22% 98.5%, 21% 99%, 20% 98%,
            19% 99%, 18% 98.5%, 17% 99%, 16% 98%, 15% 99%, 14% 98.5%, 13% 99%, 12% 98%, 11% 99%, 10% 98.5%,
            9% 99%, 8% 98%, 7% 99%, 6% 98.5%, 5% 99%, 4% 98%, 3% 99%, 2% 98.5%, 1% 99%, 0% 98%
          )`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pin at top */}
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${colors.pin}DD, ${colors.pin})`,
              boxShadow: `
                0 2px 4px rgba(0,0,0,0.3),
                inset -1px -1px 2px rgba(0,0,0,0.2),
                inset 1px 1px 2px rgba(255,255,255,0.3)
              `,
            }}
          />
        </div>

        {/* Paper texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px)',
            pointerEvents: 'none',
            opacity: 0.4,
          }}
        />

        {/* Grid pattern overlay (conditionally) */}
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
              backgroundSize: '16px 16px',
              pointerEvents: 'none',
            }}
          />
        )}

        <div className="p-8 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-3xl leading-none transition-opacity hover:opacity-70"
            style={{ color: colors.text, opacity: 0.5 }}
          >
            ×
          </button>

          {/* Saving indicator */}
          {isSaving && (
            <div
              className="absolute top-4 right-16 flex items-center gap-2 text-xs font-semibold"
              style={{ color: colors.text, opacity: 0.7 }}
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
              className="text-2xl font-bold w-full bg-transparent border-none outline-none mb-2"
              style={{ 
                color: colors.text,
                fontFamily: "'Permanent Marker', 'Marker Felt', cursive",
                fontWeight: 700,
              }}
              placeholder="Task title"
            />
            {/* Hand-drawn underline */}
            <svg width="100%" height="6" style={{ overflow: 'visible', marginBottom: '8px' }}>
              <path
                d={`M 0 3 Q ${Math.random() * 40 + 80} ${Math.random() * 2 + 2}, ${Math.random() * 40 + 160} 3 T ${Math.random() * 40 + 320} 3 T ${Math.random() * 40 + 480} 3`}
                stroke={colors.text}
                strokeWidth="2"
                fill="none"
                opacity="0.3"
              />
            </svg>
            
            <div className="flex items-center gap-2 mt-3">
              {/* Tape label in modal */}
              <div
                className="text-xs font-bold px-5 py-2 uppercase relative"
                style={{
                  background: colors.tape,
                  color: colors.text,
                  letterSpacing: '1px',
                  transform: 'rotate(-1deg)',
                  boxShadow: `0 2px 4px rgba(0,0,0,0.1), 0 3px 6px rgba(0,0,0,0.08)`,
                  clipPath: `polygon(
                    3% 0%, 
                    97% 0%, 
                    100% 8%, 
                    98% 18%, 
                    100% 35%, 
                    97% 50%, 
                    100% 65%, 
                    98% 82%, 
                    100% 92%, 
                    97% 100%, 
                    3% 100%, 
                    0% 92%, 
                    2% 82%, 
                    0% 65%, 
                    3% 50%, 
                    0% 35%, 
                    2% 18%, 
                    0% 8%
                  )`,
                }}
              >
                {priority}
                {/* Paper fiber texture */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                      repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 1px,
                        rgba(0,0,0,0.015) 1px,
                        rgba(0,0,0,0.015) 2px
                      ),
                      repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 1px,
                        rgba(255,255,255,0.03) 1px,
                        rgba(255,255,255,0.03) 2px
                      )
                    `,
                    pointerEvents: 'none',
                    opacity: 0.8,
                  }}
                />
                {/* Subtle paper grain */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    opacity: 0.05,
                    mixBlendMode: 'multiply',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              {/* Status dropdown badge */}
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
              {task.completed_at && (
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
              style={{ color: colors.text, opacity: 0.7, fontFamily: typography.fontFamily }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={4}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none resize-none font-medium"
              style={{
                background: `${colors.text}08`,
                border: `2px solid ${colors.text}20`,
                color: colors.text,
                fontFamily: typography.fontFamily,
              }}
              placeholder="Add a description..."
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Assignee */}
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: colors.text, opacity: 0.7, fontFamily: typography.fontFamily }}
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
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
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
                style={{ color: colors.text, opacity: 0.7, fontFamily: typography.fontFamily }}
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

          {/* Comments Section */}
          <div>
            <h3
              className="text-base font-bold mb-4"
              style={{ color: colors.text, fontFamily: typography.fontFamily }}
            >
              💬 Comments ({comments.length})
            </h3>

            {/* Comment List */}
            <div className="space-y-3 mb-4">
              {comments.map((comment: any) => (
                <div
                  key={comment.id}
                  className="rounded-lg p-3 relative group"
                  style={{
                    background: `${colors.text}08`,
                    border: `2px solid ${colors.text}15`,
                  }}
                >
                  {/* Delete button - shows on hover */}
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                    style={{
                      background: '#EF444415',
                      color: '#EF4444',
                    }}
                    title="Delete comment"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-bold"
                      style={{ color: colors.text, fontFamily: typography.fontFamily }}
                    >
                      {comment.author_name}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: colors.text, opacity: 0.5, fontFamily: typography.fontFamily }}
                    >
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: colors.text, opacity: 0.85, fontFamily: typography.fontFamily }}
                  >
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none font-medium"
                style={{
                  background: `${colors.text}08`,
                  border: `2px solid ${colors.text}20`,
                  color: colors.text,
                  fontFamily: typography.fontFamily,
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || createCommentMutation.isPending}
                className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:scale-105"
                style={{
                  background: commentText.trim() ? colors.text : `${colors.text}20`,
                  color: colors.bg,
                  fontFamily: typography.fontFamily,
                }}
              >
                {createCommentMutation.isPending ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

