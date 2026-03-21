import { createFileRoute, redirect } from '@tanstack/react-router'
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { RichTextEditor } from '@/components/RichTextEditor'
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
import { formatDateLocal } from '@/lib/utils/date'
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
import { useEmployees, useEmployeeWorkload } from '@/lib/hooks/useEmployees'
import type { TaskWithDetails, TaskPriority, Employee, EmployeeWorkload } from '@/types/api'

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
  const { data: workloadData = [] } = useEmployeeWorkload()
  
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

  // Helper: Get workload for an employee
  const getEmployeeWorkload = useCallback((employeeId: string) => {
    return workloadData.find((w) => w.employee_id === employeeId)
  }, [workloadData])

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
                  getEmployeeWorkload={getEmployeeWorkload}
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
          getEmployeeWorkload={getEmployeeWorkload}
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
  getEmployeeWorkload,
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
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
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
                    <option key={emp.id} value={emp.id} style={{ background: '#FFFFFF' }}>
                      {emp.full_name} {badge}
                    </option>
                  )
                })}
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
                    📅 {formatDateLocal(task.due_date)}
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
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
  onClose: () => void
}

function TaskDetailModal({ task, employees, taskLists, getEmployeeWorkload, onClose }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [listId, setListId] = useState(task.task_list_id)
  const [commentText, setCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const moveMutation = useMoveTask()
  const { data: commentsData } = useTaskComments(task.id)
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
              placeholder="Task title"
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
                style={{ color: '#64748B', fontFamily: typography.fontFamily }}
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
        </div>
      </div>
    </div>
  )
}

