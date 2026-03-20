import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
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
import { moduleBackgrounds, typography, colors } from '@/design/tokens'
import { apiClient } from '@/lib/api/client'
import { useTaskLists, useTasks, useMoveTask } from '@/lib/hooks/useTasks'
import type { TaskWithDetails, TaskPriority } from '@/types/api'

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

// ── Priority Colors ──────────────────────────────────────────────

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: colors.err,
  high: colors.err,
  medium: colors.warn,
  low: colors.accent,
}

// ── Main Component ──────────────────────────────────────────────

function TasksPage() {
  const { data: taskLists = [], isLoading: listsLoading } = useTaskLists()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const moveMutation = useMoveTask()

  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithDetails[]>([])

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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

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
    if (task) setActiveTask(task)
  }, [optimisticTasks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeListId = findListId(activeId)
    const overListId = findListId(overId)

    if (!activeListId || !overListId || activeListId === overListId) return

    // Optimistically move to new list
    setOptimisticTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, task_list_id: overListId } : t)),
    )
  }, [findListId])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const draggedTask = activeTask
    setActiveTask(null)
    if (!over || !draggedTask) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeListId = findListId(activeId)
    const overListId = findListId(overId)

    if (!activeListId || !overListId) return

    // Same list: reorder within list
    if (activeListId === overListId) {
      setOptimisticTasks((prev) => {
        const listTasks = prev.filter((t) => t.task_list_id === activeListId)
        const otherTasks = prev.filter((t) => t.task_list_id !== activeListId)
        const oldIdx = listTasks.findIndex((t) => t.id === activeId)
        const newIdx = listTasks.findIndex((t) => t.id === overId)
        if (oldIdx === -1 || newIdx === -1) return prev
        const reordered = arrayMove(listTasks, oldIdx, newIdx)
        
        // Calculate new position based on neighbors
        const targetTask = reordered[newIdx]
        const prevTask = reordered[newIdx - 1]
        const nextTask = reordered[newIdx + 1]
        
        let newPosition: number
        if (!prevTask && nextTask) {
          // Moving to top
          newPosition = nextTask.position - 1000
        } else if (prevTask && !nextTask) {
          // Moving to bottom
          newPosition = prevTask.position + 1000
        } else if (prevTask && nextTask) {
          // Moving between two tasks
          newPosition = Math.floor((prevTask.position + nextTask.position) / 2)
        } else {
          // Only task in list
          newPosition = 0
        }
        
        // Persist to backend
        moveMutation.mutate({
          id: activeId,
          data: {
            task_list_id: activeListId,
            position: newPosition,
          },
        })
        
        return [...otherTasks, ...reordered]
      })
    } else {
      // Different list: persist move
      const targetList = visibleLists.find((l) => l.id === overListId)
      if (!targetList) return

      // Calculate position (put at end)
      const listTasks = (optimisticTasks || []).filter((t) => t.task_list_id === overListId)
      const maxPosition = listTasks.length > 0 ? Math.max(...listTasks.map((t) => t.position)) : 0
      const newPosition = maxPosition + 1000

      moveMutation.mutate({
        id: activeId,
        data: {
          task_list_id: overListId,
          position: newPosition,
        },
      })
    }
  }, [activeTask, findListId, moveMutation, optimisticTasks, visibleLists])

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
      style={{ background: moduleBackgrounds.tasks }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: '#F0F0FF', lineHeight: 1 }}
          >
            Tasks
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {totalTasks} tasks · {inProgressCount} in progress · {completedTasks} completed
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-4">
          {columnConfig.map((col) => {
            const columnTasks = (optimisticTasks || [])
              .filter((t) => t.task_list_id === col.id)
              .sort((a, b) => a.position - b.position)
            return (
              <KanbanColumn
                key={col.id}
                listId={col.id}
                label={col.name}
                accent={col.accent!}
                headerBg={col.headerBg!}
                count={columnTasks.length}
                tasks={columnTasks}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── Kanban Column ───────────────────────────────────────────────

function KanbanColumn({
  listId,
  label,
  accent,
  headerBg,
  count,
  tasks,
}: {
  listId: string
  label: string
  accent: string
  headerBg: string
  count: number
  tasks: TaskWithDetails[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: listId })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-2xl min-h-[420px] transition-all overflow-hidden"
      style={{
        background: isOver ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: isOver ? '2px dashed ' + accent + '60' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: headerBg }}
      >
        <span
          className="text-xs font-extrabold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span
          className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-md"
          style={{ background: accent + '20', color: accent }}
        >
          {count}
        </span>
      </div>

      {/* Sortable Task List */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 p-3 flex-1">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Sortable Task Card Wrapper ──────────────────────────────────

function SortableTaskCard({ task }: { task: TaskWithDetails }) {
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
      <TaskCard task={task} />
    </div>
  )
}

// ── Task Card ───────────────────────────────────────────────────

function TaskCard({ task, isDragging }: { task: TaskWithDetails; isDragging?: boolean }) {
  const isDone = !!task.completed_at

  return (
    <div
      className="rounded-xl px-4 py-3.5 cursor-grab active:cursor-grabbing transition-all"
      style={{
        background: isDone ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
        border: '1px solid ' + (isDone ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'),
        boxShadow: isDragging
          ? '0 16px 32px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)'
          : '0 1px 2px rgba(0,0,0,0.2)',
        transform: isDragging ? 'rotate(2deg) scale(1.02)' : undefined,
      }}
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2.5">
        <div className="pt-1 shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: PRIORITY_COLORS[task.priority],
              boxShadow: `0 0 0 2px ${PRIORITY_COLORS[task.priority]}30`,
            }}
            title={`${task.priority} priority`}
          />
        </div>
        <p
          className="font-semibold leading-snug text-[13px]"
          style={{
            color: isDone ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.88)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-2.5 ml-[18px]">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {task.list_name}
        </span>
        {task.assignee_name && (
          <span
            className="text-[11px] font-medium"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            {task.assignee_name}
          </span>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <div className="mt-2 ml-[18px]">
          <span
            className="text-[10px] font-medium"
            style={{ color: 'rgba(255,255,255,0.25)', fontFamily: typography.fontMono }}
          >
            Due {task.due_date}
          </span>
        </div>
      )}
    </div>
  )
}

