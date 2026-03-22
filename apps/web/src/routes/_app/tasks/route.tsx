import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { TaskFilters } from '@/components/TaskFilters'
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
import { moduleBackgrounds, typography, colors } from '@/design/tokens'
import { apiClient } from '@/lib/api/client'
import { formatDateLocal } from '@/lib/utils/date'
import { 
  useTaskLists, 
  useTasks, 
  useMoveTask, 
  useCreateTask,
} from '@/lib/hooks/useTasks'
import { useEmployees, useEmployeeWorkload } from '@/lib/hooks/useEmployees'
import { useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import type { TaskWithDetails, TaskPriority, Employee, EmployeeWorkload } from '@/types/api'

// URL search params for filters
type TasksSearch = {
  search?: string
  assignee?: string
  priority?: string
  showCompleted: boolean
}

export const Route = createFileRoute('/_app/tasks')({
  validateSearch: (search: Record<string, unknown>): TasksSearch => {
    return {
      search: typeof search.search === 'string' ? search.search : undefined,
      assignee: typeof search.assignee === 'string' ? search.assignee : undefined,
      priority: typeof search.priority === 'string' ? search.priority : undefined,
      showCompleted: search.showCompleted === false || search.showCompleted === 'false' ? false : true,
    }
  },
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
  const navigate = useNavigate({ from: Route.fullPath })
  const searchParams = Route.useSearch()
  
  const { data: taskLists = [], isLoading: listsLoading } = useTaskLists()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: employeesData } = useEmployees({ status: 'active' })
  const employees = employeesData?.data || []
  const { data: workloadData = [] } = useEmployeeWorkload()
  
  // Filter state from URL
  const searchQuery = searchParams.search || ''
  const selectedAssignee = searchParams.assignee || ''
  const selectedPriority = searchParams.priority || ''
  const showCompleted = searchParams.showCompleted
  
  // Update URL params
  const updateSearchParam = useCallback((key: keyof TasksSearch, value: string | boolean) => {
    navigate({
      search: (prev) => ({
        ...prev,
        [key]: typeof value === 'boolean' ? value : (value || undefined), // Handle booleans separately
      }),
      replace: true, // Don't create history entries for filters
    })
  }, [navigate])
  
  const clearAllFilters = useCallback(() => {
    navigate({
      search: { showCompleted: true },
      replace: true,
    })
  }, [navigate])
  
  const moveMutation = useMoveTask()
  const createMutation = useCreateTask()
  const approveLeaveRequest = useApproveRequest()
  const approveClaimMutation = useApproveClaim()

  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [activeTaskOriginalListId, setActiveTaskOriginalListId] = useState<string | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithDetails[]>([])
  const [creatingInListId, setCreatingInListId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)
  const [createModalListId, setCreateModalListId] = useState<string | null>(null)
  const [expandedWorkloadStatus, setExpandedWorkloadStatus] = useState<string | null>(null)

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks || []
    
    // Search filter (title + description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((task) => {
        const matchTitle = task.title.toLowerCase().includes(query)
        const matchDesc = task.description?.toLowerCase().includes(query)
        return matchTitle || matchDesc
      })
    }
    
    // Assignee filter
    if (selectedAssignee) {
      if (selectedAssignee === 'unassigned') {
        filtered = filtered.filter((task) => !task.assignee_id)
      } else {
        filtered = filtered.filter((task) => task.assignee_id === selectedAssignee)
      }
    }
    
    // Priority filter
    if (selectedPriority) {
      filtered = filtered.filter((task) => task.priority === selectedPriority)
    }
    
    // Show/hide completed
    if (!showCompleted) {
      filtered = filtered.filter((task) => !task.completed_at)
    }
    
    return filtered
  }, [tasks, searchQuery, selectedAssignee, selectedPriority, showCompleted])
  
  // Sync with server data and apply filters
  useEffect(() => {
    setOptimisticTasks(filteredTasks || [])
  }, [filteredTasks])

  // Close workload dropdown when clicking outside
  useEffect(() => {
    if (!expandedWorkloadStatus) return
    
    const handleClickOutside = () => setExpandedWorkloadStatus(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [expandedWorkloadStatus])
  
  // Only render first 3 lists (To Do, In Progress, Done)
  const visibleLists = useMemo(() => {
    const lists = taskLists || []
    return lists
      .filter((list) => list.is_active)
      .sort((a, b) => a.position - b.position)
      .slice(0, 3)
  }, [taskLists])
  
  // Check if any filters are active (showCompleted=true is the default, so only count it if false)
  const hasActiveFilters = !!(searchQuery || selectedAssignee || selectedPriority || showCompleted === false)

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

      // Auto-approve approval tasks when moved to Done (final state)
      if (draggedTask.approval_type && targetList?.is_final_state && !draggedTask.completed_at) {
        const approvalId = draggedTask.approval_id
        if (approvalId) {
          if (draggedTask.approval_type === 'leave') {
            approveLeaveRequest.mutate({ id: approvalId })
          } else if (draggedTask.approval_type === 'claim') {
            approveClaimMutation.mutate({ id: approvalId })
          }
        }
      }

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
  }, [activeTask, activeTaskOriginalListId, findListId, moveMutation, optimisticTasks, visibleLists, approveLeaveRequest, approveClaimMutation])

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
  const allTasksCount = (tasks || []).length
  const completedTasks = (optimisticTasks || []).filter((t) => t.completed_at).length
  const inProgressList = visibleLists[1]
  const inProgressCount = inProgressList ? (optimisticTasks || []).filter(
    (t) => t.task_list_id === inProgressList.id && !t.completed_at
  ).length : 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.tasks, paddingBottom: '160px' }}  // Use design tokens
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="font-extrabold"
              style={{ 
                fontSize: typography.display.size, 
                letterSpacing: typography.display.tracking, 
                color: '#2C3E50', 
                lineHeight: typography.display.lineHeight,
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
            {hasActiveFilters && totalTasks !== allTasksCount
              ? `${totalTasks} of ${allTasksCount} tasks`
              : `${totalTasks} total`} · {inProgressCount} in progress · {completedTasks} done
          </p>
          </div>
          
          <div className="flex items-center gap-4">
            <DateTime 
              textColor="#2C3E50"
              textMutedColor="#7F8C8D"
              borderColor="#E8ECF0"
            />
            {/* Notification Placeholder */}
            <div
              style={{
                minWidth: 36,
                height: 36,
                background: '#FFFFFF',
                borderRadius: 10,
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: '1px solid #E8ECF0',
              }}
              title="No notifications"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accent, flexShrink: 0 }}>
                <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Unified control row: Team + Search/Filters */}
      <div className="mb-6 relative">
        <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* Team Workload - Compact View */}
        {workloadData.length > 0 && (() => {
          const counts = {
            available: workloadData.filter(e => e.workload.status === 'available').length,
            warning: workloadData.filter(e => e.workload.status === 'warning').length,
            overloaded: workloadData.filter(e => e.workload.status === 'overloaded').length,
            on_leave: workloadData.filter(e => e.workload.status === 'on_leave').length,
          }
          const statusConfig = [
            { key: 'available', icon: '?', label: 'available', color: '#10B981' },
            { key: 'warning', icon: '⚡', label: 'busy', color: '#F59E0B' },
            { key: 'overloaded', icon: '🔥', label: 'overloaded', color: '#EF4444' },
            { key: 'on_leave', icon: '✈', label: 'onleave', color: '#8B5CF6' },
          ]

          return (
            <div className="flex items-center gap-2 relative">
              <span
                className="text-xs font-bold"
                style={{
                  color: '#64748B',
                  fontFamily: typography.fontFamily,
                  letterSpacing: '0.3px',
                }}
              >
                Team ({workloadData.length})
              </span>
              <div className="flex items-center gap-2">
                {statusConfig.map((status, idx) => {
                  const count = counts[status.key as keyof typeof counts]
                  if (count === 0) return null
                  const rotation = ((idx * 3) % 4) - 2
                  const isExpanded = expandedWorkloadStatus === status.key
                  const employeesInStatus = workloadData.filter(e => e.workload.status === status.key)

                  return (
                    <div key={status.key} className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedWorkloadStatus(isExpanded ? null : status.key)
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-all"
                        style={{
                          background: isExpanded ? `${status.color}20` : `${status.color}10`,
                          borderRadius: '4px',
                          transform: isExpanded ? 'rotate(0deg) scale(1.05)' : `rotate(${rotation}deg)`,
                          boxShadow: isExpanded ? `3px 3px 0 ${status.color}30` : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          className="text-sm"
                          style={{ fontFamily: typography.fontFamily }}
                        >
                          {status.icon}
                        </span>
                        <span
                          className="text-xs font-bold"
                          style={{
                            color: status.color,
                            fontFamily: typography.fontFamily,
                          }}
                        >
                          {count}
                        </span>
                        <span
                          className="text-xs"
                          style={{
                            color: '#64748B',
                            fontFamily: typography.fontFamily,
                          }}
                        >
                          {status.label}
                        </span>
                      </button>

                      {/* Dropdown with employee list */}
                      {isExpanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-3 z-50 min-w-[260px] max-w-[340px]"
                          style={{
                            background: '#FFF9E6',
                            borderLeft: `3px solid ${status.color}25`,
                            borderTop: `1px solid #E5DCC5`,
                            borderRight: `1px solid #E5DCC5`,
                            borderBottom: `2px solid #D4CAB3`,
                            boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                            transform: 'rotate(-0.8deg)',
                            padding: '18px 16px',
                          }}
                        >
                          {/* Notebook header */}
                          <div
                            className="text-xs font-bold mb-4 pb-2"
                            style={{
                              color: status.color,
                              fontFamily: typography.fontFamily,
                              borderBottom: `1px solid ${status.color}20`,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              transform: 'rotate(0.5deg)',
                            }}
                          >
                            {status.icon} {status.label} — {count} people
                          </div>
                          
                          {/* Handwritten-style entries */}
                          <div className="max-h-[380px] overflow-y-auto">
                            {employeesInStatus.map((emp, idx) => (
                              <div
                                key={emp.employee_id}
                                className="mb-3"
                                style={{
                                  transform: `rotate(${((idx % 3) - 1) * 0.4}deg)`,
                                  marginLeft: `${(idx % 2) * 4}px`,
                                }}
                              >
                                <div
                                  className="text-sm font-bold"
                                  style={{
                                    color: '#2C3E50',
                                    fontFamily: typography.fontFamily,
                                    letterSpacing: '0.3px',
                                  }}
                                >
                                  {emp.full_name}
                                </div>
                                {emp.workload.status !== 'on_leave' && (
                                  <div
                                    className="text-xs mt-1"
                                    style={{
                                      color: '#64748B',
                                      fontFamily: typography.fontFamily,
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: status.color,
                                        fontWeight: 600,
                                        textDecoration: 'underline',
                                        textDecorationStyle: 'wavy',
                                        textDecorationColor: `${status.color}40`,
                                      }}
                                    >
                                      {emp.workload.active_tasks} tasks
                                    </span>
                                    {emp.workload.overdue_tasks > 0 && (
                                      <span
                                        style={{
                                          color: '#DC2626',
                                          fontWeight: 600,
                                          marginLeft: '8px',
                                        }}
                                      >
                                        ({emp.workload.overdue_tasks} overdue!)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {emp.leave.is_on_leave && emp.leave.leave_end && (
                                  <div
                                    className="text-xs mt-1"
                                    style={{
                                      color: status.color,
                                      fontFamily: typography.fontFamily,
                                      fontStyle: 'italic',
                                      fontWeight: 600,
                                    }}
                                  >
                                    back on {new Date(emp.leave.leave_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
        
        {/* Search + Filters - Inline controls */}
        <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={(value) => updateSearchParam('search', value)}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={(value) => updateSearchParam('assignee', value)}
        selectedPriority={selectedPriority}
        onPriorityChange={(value) => updateSearchParam('priority', value)}
        showCompleted={showCompleted}
        onShowCompletedChange={(value) => updateSearchParam('showCompleted', value)}
        employees={employees}
        getEmployeeWorkload={getEmployeeWorkload}
        onClearFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
      />
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
              .sort((a, b) => {
                // Pin approval tasks to the top
                const aIsApproval = a.approval_type && !a.completed_at
                const bIsApproval = b.approval_type && !b.completed_at
                
                if (aIsApproval && !bIsApproval) return -1
                if (!aIsApproval && bIsApproval) return 1
                
                // Within same group (both approval or both regular), sort by position
                return a.position - b.position
              })
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
                  onStartCreateModal={setCreateModalListId}
                  onStartCreateInline={setCreatingInListId}
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
      
      {/* Task Detail Modal - Used for both create and edit */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          employees={employees}
          taskLists={visibleLists}
          getEmployeeWorkload={getEmployeeWorkload}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Create Task Modal */}
      {createModalListId && (
        <TaskDetailModal
          mode="create"
          listId={createModalListId}
          employees={employees}
          taskLists={visibleLists}
          getEmployeeWorkload={getEmployeeWorkload}
          onClose={() => {
            setCreateModalListId(null)
            setNewTaskTitle('')
            setNewTaskAssignee('')
          }}
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
  onStartCreateModal,
  onStartCreateInline,
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
  onStartCreateModal: (listId: string) => void
  onStartCreateInline: (listId: string) => void
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
        <div className="flex items-start justify-between gap-3">
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
          {/* Add Task Button in Header */}
          <button
            onClick={() => onStartCreateModal(listId)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-black/10"
            style={{
              background: 'rgba(0,0,0,0.03)',
              color: '#64748B',
              fontFamily: typography.fontFamily,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
            title="Add new task"
          >
            + Add
          </button>
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
              onClick={() => onStartCreateInline(listId)}
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
      
      {/* Tape label at top center - Always shows priority */}
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
      
      {/* Approval ribbon - Bottom right corner */}
      {task.approval_type && !task.completed_at && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '-4px',
            zIndex: 11,
          }}
        >
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold uppercase"
            style={{
              background: '#6357E8',
              color: '#FFFFFF',
              fontFamily: typography.fontFamily,
              letterSpacing: '0.5px',
              transform: 'rotate(2deg)',
              boxShadow: '0 2px 6px rgba(99,87,232,0.4), 0 4px 8px rgba(0,0,0,0.15)',
              borderRadius: '3px 0 0 3px',
              border: '1.5px solid #4A3FBF',
              borderRight: 'none',
            }}
          >
            <span style={{ fontSize: '12px' }}>📋</span>
            Approval
          </div>
          {/* Triangle fold effect */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              width: 0,
              height: 0,
              borderLeft: '6px solid #2E2580',
              borderBottom: '6px solid transparent',
            }}
          />
        </div>
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

