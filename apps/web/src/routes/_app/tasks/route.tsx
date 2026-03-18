import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
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
import { typography, colors } from '@/design/tokens'

export const Route = createFileRoute('/_app/tasks')({
  component: TasksPage,
})

// ── Types ───────────────────────────────────────────────────────

type Priority = 'high' | 'medium' | 'low'
type Status = 'todo' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  project: string
  priority: Priority
  status: Status
  assignee: string
  dueDate: string
}

// ── Column Config ───────────────────────────────────────────────

const TASKS_BG = '#0E0E1A'

const COLUMNS: { id: Status; label: string; accent: string; accentDim: string; headerBg: string }[] = [
  { id: 'todo', label: 'To Do', accent: '#A0A0C0', accentDim: '#1A1A2E', headerBg: 'rgba(255,255,255,0.04)' },
  { id: 'in_progress', label: 'In Progress', accent: '#818CF8', accentDim: '#1E1B4B', headerBg: 'rgba(129,140,248,0.08)' },
  { id: 'done', label: 'Done', accent: '#34D399', accentDim: '#0D2818', headerBg: 'rgba(52,211,153,0.06)' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  high: colors.err,
  medium: colors.warn,
  low: colors.accent,
}

// ── Initial Data ────────────────────────────────────────────────

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Review Q1 budget proposal', project: 'Finance', priority: 'high', status: 'in_progress', assignee: 'Ahmad', dueDate: '2026-03-20' },
  { id: '2', title: 'Update employee handbook', project: 'HR Operations', priority: 'medium', status: 'todo', assignee: 'Sarah', dueDate: '2026-03-22' },
  { id: '3', title: 'Prepare onboarding docs for new hire', project: 'Recruitment', priority: 'low', status: 'todo', assignee: 'Ahmad', dueDate: '2026-03-25' },
  { id: '4', title: 'Submit monthly expense report', project: 'Finance', priority: 'high', status: 'done', assignee: 'Budi', dueDate: '2026-03-15' },
  { id: '5', title: 'Schedule team building event', project: 'Culture', priority: 'low', status: 'in_progress', assignee: 'Sarah', dueDate: '2026-03-28' },
  { id: '6', title: 'Review leave policy for Ramadan', project: 'HR Operations', priority: 'medium', status: 'todo', assignee: 'Ahmad', dueDate: '2026-03-30' },
  { id: '7', title: 'Set up project tracking board', project: 'Operations', priority: 'medium', status: 'done', assignee: 'Budi', dueDate: '2026-03-12' },
  { id: '8', title: 'Draft partnership proposal', project: 'Business Dev', priority: 'high', status: 'in_progress', assignee: 'Ahmad', dueDate: '2026-03-21' },
]

// ── Main Component ──────────────────────────────────────────────

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const findColumn = useCallback((id: string): Status | undefined => {
    // Check if id is a column id
    if (['todo', 'in_progress', 'done'].includes(id)) return id as Status
    // Otherwise find the task's column
    return tasks.find((t) => t.id === id)?.status
  }, [tasks])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }, [tasks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeColumn = findColumn(activeId)
    const overColumn = findColumn(overId)

    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: overColumn } : t)),
    )
  }, [findColumn])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeColumn = findColumn(activeId)
    const overColumn = findColumn(overId)

    if (!activeColumn || !overColumn) return

    if (activeColumn === overColumn) {
      // Reorder within the same column
      setTasks((prev) => {
        const columnTasks = prev.filter((t) => t.status === activeColumn)
        const otherTasks = prev.filter((t) => t.status !== activeColumn)
        const oldIdx = columnTasks.findIndex((t) => t.id === activeId)
        const newIdx = columnTasks.findIndex((t) => t.id === overId)
        if (oldIdx === -1 || newIdx === -1) return prev
        return [...otherTasks, ...arrayMove(columnTasks, oldIdx, newIdx)]
      })
    }
  }, [findColumn])

  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: TASKS_BG }}
    >
      {/* Header — matches People / Attendance pattern */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: '#F0F0FF', lineHeight: 1 }}
          >
            Tasks
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {tasks.length} tasks · {inProgressCount} in progress · {doneCount} completed
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
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id)
            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                accent={col.accent}
                headerBg={col.headerBg}
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
  id,
  label,
  accent,
  headerBg,
  count,
  tasks,
}: {
  id: Status
  label: string
  accent: string
  headerBg: string
  count: number
  tasks: Task[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

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

function SortableTaskCard({ task }: { task: Task }) {
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

function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const isDone = task.status === 'done'

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
          {task.project}
        </span>
        <span
          className="text-[11px] font-medium"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {task.assignee}
        </span>
      </div>

      {/* Due date */}
      <div className="mt-2 ml-[18px]">
        <span
          className="text-[10px] font-medium"
          style={{ color: 'rgba(255,255,255,0.25)', fontFamily: typography.fontMono }}
        >
          Due {task.dueDate}
        </span>
      </div>
    </div>
  )
}
