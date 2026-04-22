import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Settings, Flame, TrendingUp, Minus, TrendingDown, Search, Check, Zap, Plane, Menu, List, Star, X, MoreVertical, Filter, Download, Tag } from 'lucide-react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { ColumnTabNav } from '@/components/tasks/ColumnTabNav'
import { TaskCard as EnhancedTaskCard } from '@/components/tasks/TaskCard'
import { AllIssuesTable } from '@/components/tasks/AllIssuesTable'
import { Dropdown, type DropdownOption } from '@/components/workived/shared/Dropdown'
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
import { useCanEditOrgSettings } from '@/lib/hooks/useRole'
import type { TaskWithDetails, TaskPriority, Employee, EmployeeWorkload } from '@/types/api'

// URL search params for filters
type ViewMode = 'all' | 'tasks' | 'approvals' | 'all-issues'

type TasksSearch = {
  view?: ViewMode
  search?: string
  assignee?: string
  priority?: string
  label?: string
  showCompleted: boolean
  column?: string // Mobile: active column ID
  task?: string // Active task ID (for shareable URLs)
  create?: string // List ID for creating new task
}

export const Route = createFileRoute('/_app/tasks/')({
  validateSearch: (search: Record<string, unknown>): TasksSearch => {
    const view = search.view
    return {
      view: view === 'tasks' || view === 'approvals' || view === 'all-issues' ? view : undefined,
      search: typeof search.search === 'string' ? search.search : undefined,
      assignee: typeof search.assignee === 'string' ? search.assignee : undefined,
      priority: typeof search.priority === 'string' ? search.priority : undefined,
      label: typeof search.label === 'string' ? search.label : undefined,
      column: typeof search.column === 'string' ? search.column : undefined,
      task: typeof search.task === 'string' ? search.task : undefined,
      create: typeof search.create === 'string' ? search.create : undefined,
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
  const { data: org } = useOrganisation()
  
  const { data: taskLists = [], isLoading: listsLoading } = useTaskLists()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks({ include_completed: true })
  
  // Memoize employee query options to prevent React Query from reconfiguring on every render
  const employeeQueryOptions = useMemo(() => ({ status: 'active' as const, limit: 100 }), [])
  const { data: employeesData } = useEmployees(employeeQueryOptions)
  const employees = employeesData?.data || []
  const { data: workloadData = [] } = useEmployeeWorkload()
  
  // Filter state from URL
  const viewMode: ViewMode = searchParams.view || 'all'
  const searchQuery = searchParams.search || ''
  const selectedAssignee = searchParams.assignee || ''
  const selectedPriority = searchParams.priority || ''
  const selectedLabel = searchParams.label || ''
  const showCompleted = searchParams.showCompleted
  const activeColumnId = searchParams.column // Mobile: current active column
  
  // Parse multi-select values from comma-separated strings
  const selectedPriorities = selectedPriority ? selectedPriority.split(',') : []
  const selectedLabels = selectedLabel ? selectedLabel.split(',') : []
  
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

  const canEditOrgSettings = useCanEditOrgSettings()

  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [activeTaskOriginalListId, setActiveTaskOriginalListId] = useState<string | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithDetails[]>([])
  const [creatingInListId, setCreatingInListId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('')
  
  // Task modal state is now managed via URL query params for shareability
  // URL param can be either task code (e.g., "WOR-123") or task ID (UUID)
  const taskParam = searchParams.task
  const createModalListId = searchParams.create
  
  // Resolve task param to task ID
  const selectedTaskId = useMemo(() => {
    if (!taskParam) return null
    
    // Check if it's a UUID (has dashes and correct length)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskParam)
    if (isUUID) return taskParam
    
    // Otherwise, treat as code and search in tasks list
    const task = tasks.find(t => t.code === taskParam)
    return task?.id || null
  }, [taskParam, tasks])
  
  const [expandedWorkloadStatus, setExpandedWorkloadStatus] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showPriorityPicker, setShowPriorityPicker] = useState(false)
  
  // Local state for search input to prevent race conditions with URL updates
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  
  // Column visibility state (persisted to localStorage)
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const stored = localStorage.getItem('workived:hiddenColumns')
    return stored ? new Set(JSON.parse(stored)) : new Set()
  })
  const [showColumnToggle, setShowColumnToggle] = useState(false)
  const columnToggleRef = useRef<HTMLDivElement>(null)
  
  // Track if we've initialized mobile column to prevent infinite loops
  const mobileColumnInitialized = useRef(false)
  
  // Track previous tasks data to prevent unnecessary optimistic updates
  const prevTasksRef = useRef<TaskWithDetails[]>([])
  
  // Track if user is currently dragging to prevent flicker from background refetches
  const isDraggingRef = useRef(false)
  
  // Sync local search to URL params with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        updateSearchParam('search', localSearchQuery)
      }
    }, 300) // 300ms debounce
    
    return () => clearTimeout(timer)
  }, [localSearchQuery, searchQuery, updateSearchParam])
  
  // Sync URL search param back to local state (for when URL changes externally, e.g., clear button)
  useEffect(() => {
    if (searchQuery !== localSearchQuery && searchQuery === '') {
      setLocalSearchQuery('')
    }
  }, [searchQuery])

  // Apply filters to optimistic tasks (for display only)
  const displayTasks = useMemo(() => {
    let filtered = optimisticTasks || []

    // View mode filter (tasks vs approvals)
    if (viewMode === 'tasks') {
      filtered = filtered.filter((task) => !task.approval_type)
    } else if (viewMode === 'approvals') {
      filtered = filtered.filter((task) => !!task.approval_type)
    }

    // Search filter (title + description) - use localSearchQuery for instant filtering
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase()
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
    
    // Priority filter (multi-select)
    if (selectedPriorities.length > 0) {
      filtered = filtered.filter((task) => selectedPriorities.includes(task.priority))
    }

    // Label filter (multi-select)
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((task) => 
        task.labels && task.labels.some(label => selectedLabels.includes(label))
      )
    }
    
    // Show/hide completed
    if (!showCompleted) {
      filtered = filtered.filter((task) => !task.completed_at)
    }
    
    return filtered
  }, [optimisticTasks, viewMode, localSearchQuery, selectedAssignee, selectedPriorities, selectedLabels, showCompleted])
  
  // Sync optimistic state with server data (only when data genuinely changes)
  useEffect(() => {
    const currentTasks = tasks || []
    
    // Don't update during drag operations to prevent flicker
    if (isDraggingRef.current) {
      return
    }
    
    // Create a signature of the current data (IDs + updated_at timestamps)
    const createSignature = (taskList: TaskWithDetails[]) => 
      taskList.map(t => `${t.id}:${t.updated_at || ''}`).sort().join('|')
    
    const currentSig = createSignature(currentTasks)
    const prevSig = createSignature(prevTasksRef.current)
    
    if (currentSig !== prevSig) {
      prevTasksRef.current = currentTasks
      setOptimisticTasks(currentTasks)
    }
  }, [tasks])

  // Close workload dropdown when clicking outside
  useEffect(() => {
    if (!expandedWorkloadStatus) return
    
    const handleClickOutside = () => setExpandedWorkloadStatus(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [expandedWorkloadStatus])
  
  // Close column toggle dropdown when clicking outside
  useEffect(() => {
    if (!showColumnToggle) return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (columnToggleRef.current && !columnToggleRef.current.contains(event.target as Node)) {
        setShowColumnToggle(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColumnToggle])
  
  // Persist hidden columns to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('workived:hiddenColumns', JSON.stringify([...hiddenColumnIds]))
  }, [hiddenColumnIds])
  
  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnId: string) => {
    setHiddenColumnIds(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }, [])
  
  // Render all active lists in position order, excluding hidden columns
  const visibleLists = useMemo(() => {
    const lists = taskLists || []
    return lists
      .filter((list) => list.is_active && !hiddenColumnIds.has(list.id))
      .sort((a, b) => a.position - b.position)
  }, [taskLists, hiddenColumnIds])
  
  // Extract all unique labels from tasks
  const allLabels = useMemo(() => {
    const labelSet = new Set<string>()
    optimisticTasks.forEach(task => {
      if (task.labels) {
        task.labels.forEach(label => labelSet.add(label))
      }
    })
    return Array.from(labelSet).sort()
  }, [optimisticTasks])
  
  // Check if any filters are active (showCompleted=true is the default, so only count it if false)
  const hasActiveFilters = !!(localSearchQuery || selectedAssignee || selectedPriorities.length > 0 || selectedLabels.length > 0 || showCompleted === false)

  // Mobile: Set default active column to first list if not specified (run only once)
  useEffect(() => {
    if (
      !mobileColumnInitialized.current &&
      typeof window !== 'undefined' && 
      window.innerWidth < 640 && 
      visibleLists.length > 0 && 
      !activeColumnId
    ) {
      const firstList = visibleLists[0]
      if (firstList) {
        mobileColumnInitialized.current = true
        updateSearchParam('column', firstList.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLists, activeColumnId])

  // Handler for mobile column switching
  const handleColumnChange = useCallback((columnId: string) => {
    updateSearchParam('column', columnId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate task counts per column (using filtered tasks)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    visibleLists.forEach((list) => {
      counts[list.id] = (displayTasks || []).filter(
        (t) => t.task_list_id === list.id
      ).length
    })
    return counts
  }, [visibleLists, displayTasks])

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
    isDraggingRef.current = true
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
    isDraggingRef.current = false
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
        data-testid="tasks-skeleton"
        className="min-h-screen px-6 py-8 md:px-11 md:py-10 flex items-center justify-center"
        style={{ background: moduleBackgrounds.tasks }}
      >
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading tasks...</p>
      </div>
    )
  }

  const totalTasks = (displayTasks || []).length
  const allTasksCount = (tasks || []).length
  const finalStateListIds = new Set(visibleLists.filter((l) => l.is_final_state).map((l) => l.id))
  const completedTasks = (tasks || []).filter(
    (t) => t.completed_at || finalStateListIds.has(t.task_list_id)
  ).length
  const inProgressList = visibleLists.find((l) => !l.is_final_state && l !== visibleLists[0])
  const inProgressCount = inProgressList ? (displayTasks || []).filter(
    (t) => t.task_list_id === inProgressList.id && !t.completed_at
  ).length : 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.tasks, paddingBottom: '160px' }}  // Use design tokens
    >
      {/* Max-width container for content */}
      <div className="max-w-[1600px] mx-auto">
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
            
            {/* Team Workload - Below Header */}
            {workloadData.length > 0 && (() => {
              const counts = {
                available: workloadData.filter(e => e.workload.status === 'available').length,
                warning: workloadData.filter(e => e.workload.status === 'warning').length,
                overloaded: workloadData.filter(e => e.workload.status === 'overloaded').length,
                on_leave: workloadData.filter(e => e.workload.status === 'on_leave').length,
              }
              const statusConfig = [
                { key: 'available', icon: Check, label: 'available', color: '#10B981' },
                { key: 'warning', icon: Zap, label: 'busy', color: '#F59E0B' },
                { key: 'overloaded', icon: Flame, label: 'overloaded', color: '#EF4444' },
                { key: 'on_leave', icon: Plane, label: 'on leave', color: '#8B5CF6' },
              ]

              return (
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: '#64748B',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                  </span>
                  <div className="flex items-center gap-1.5">
                    {statusConfig.map((status) => {
                      const count = counts[status.key as keyof typeof counts]
                      if (count === 0) return null
                      const isExpanded = expandedWorkloadStatus === status.key
                      const employeesInStatus = workloadData.filter(e => e.workload.status === status.key)

                      return (
                        <div key={status.key} className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedWorkloadStatus(isExpanded ? null : status.key)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-all"
                            style={{
                              background: isExpanded ? `${status.color}15` : 'white',
                              border: `1px solid ${isExpanded ? status.color : '#DFE1E6'}`,
                              cursor: 'pointer',
                            }}
                          >
                            <status.icon size={12} style={{ color: status.color }} />
                            <span
                              className="text-xs font-semibold"
                              style={{
                                color: status.color,
                                fontFamily: typography.fontFamily,
                              }}
                            >
                              {count}
                            </span>
                            <span
                              className="text-[10px] font-medium"
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
                              className="absolute left-0 top-full mt-2 z-50 min-w-[280px]"
                              style={{
                                background: 'white',
                                border: '1px solid #DFE1E6',
                                borderRadius: '8px',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                                padding: '12px',
                              }}
                            >
                              <div
                                className="text-xs font-semibold mb-3 pb-2"
                                style={{
                                  color: status.color,
                                  fontFamily: typography.fontFamily,
                                  borderBottom: '1px solid #F4F5F7',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                <status.icon size={14} style={{ color: status.color, display: 'inline-block', marginRight: '4px' }} />
                                {status.label} ({count})
                              </div>
                              
                              <div className="max-h-[320px] overflow-y-auto space-y-2">
                                {employeesInStatus.map((emp) => (
                                  <div
                                    key={emp.employee_id}
                                    className="p-2 rounded hover:bg-gray-50 transition-colors"
                                  >
                                    <div
                                      className="text-sm font-medium"
                                      style={{
                                        color: '#2C3E50',
                                        fontFamily: typography.fontFamily,
                                      }}
                                    >
                                      {emp.full_name}
                                    </div>
                                    {emp.workload.status !== 'on_leave' && (
                                      <div
                                        className="text-xs mt-0.5"
                                        style={{
                                          color: '#64748B',
                                          fontFamily: typography.fontFamily,
                                        }}
                                      >
                                        {emp.workload.active_tasks} tasks
                                        {emp.workload.overdue_tasks > 0 && (
                                          <span style={{ color: '#DC2626', marginLeft: '4px' }}>
                                            · {emp.workload.overdue_tasks} overdue
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {emp.leave.is_on_leave && emp.leave.leave_end && (
                                      <div
                                        className="text-xs mt-0.5"
                                        style={{
                                          color: status.color,
                                          fontFamily: typography.fontFamily,
                                        }}
                                      >
                                        Back {new Date(emp.leave.leave_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
          </div>
          
          <div className="flex items-center gap-4">
            {/* Task Board Settings Button */}
            {canEditOrgSettings && (
              <Link
                to="/tasks/settings"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/80"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8ECF0',
                  color: '#2C3E50',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: typography.fontFamily,
                  textDecoration: 'none',
                }}
                data-testid="task-board-settings-link"
              >
                <Settings size={14} />
                <span>Board Settings</span>
              </Link>
            )}
            <DateTime 
              textColor="#2C3E50"
              textMutedColor="#7F8C8D"
              borderColor="#E8ECF0"
            />
            {org?.plan === 'pro' && (
              <div
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Star size={10} fill="white" style={{ color: 'white' }} />
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: '#FFFFFF', letterSpacing: '0.05em' }}
                >
                  PRO
                </span>
              </div>
            )}
            <NotificationBell
              surfaceColor="#FFFFFF"
              borderColor="#E8ECF0"
              accentColor={colors.accent}
              textColor="#2C3E50"
              textMutedColor="#7F8C8D"
            />
          </div>
        </div>
      </div>

      {/* Jira-style Filter Bar */}
      <div 
        className="mb-6 -mx-6 px-6 md:-mx-11 md:px-11 py-4 md:sticky relative"
        style={{
          top: 0,
          zIndex: 40,
          background: 'transparent',
          marginBottom: '24px',
        }}
      >
        {/* Solid background for mobile */}
        <div
          className="absolute inset-0 -z-10 md:hidden"
          style={{
            background: moduleBackgrounds.tasks,
          }}
        />
        {/* Blur effect overlay - desktop only for performance */}
        <div
          className="absolute inset-0 -z-10 hidden md:block"
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            background: moduleBackgrounds.tasks,
            opacity: 0.92,
          }}
        />
        
        {/* Single unified filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Board view tabs (All / Tasks / Approvals) */}
          <div className="flex items-center gap-1.5 rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
            {([['all', 'All'], ['tasks', 'Tasks'], ['approvals', 'Approvals']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => updateSearchParam('view', mode === 'all' ? '' : mode)}
                className="px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={{
                  background: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals' && viewMode !== 'all-issues')) ? 'white' : 'transparent',
                  color: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals' && viewMode !== 'all-issues')) ? '#2C3E50' : '#64748B',
                  boxShadow: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals' && viewMode !== 'all-issues')) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: typography.fontFamily,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-6 self-center" style={{ background: 'rgba(0,0,0,0.12)' }} />

          {/* All Issues — separate view (table, not board) */}
          <button
            onClick={() => updateSearchParam('view', viewMode === 'all-issues' ? '' : 'all-issues')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all"
            style={{
              background: viewMode === 'all-issues' ? '#2C3E50' : 'rgba(0,0,0,0.05)',
              color: viewMode === 'all-issues' ? 'white' : '#64748B',
              fontFamily: typography.fontFamily,
            }}
          >
            <List size={14} />
            All Issues
          </button>

          {/* Board-only filters — hidden in All Issues view */}
          {viewMode !== 'all-issues' && <>

          {/* Search box - centered and prominent */}
          <div className="flex-1 min-w-[280px] max-w-[600px]">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
              style={{
                background: 'white',
                border: '1px solid #DFE1E6',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
            >
              <Search size={16} style={{ color: '#64748B' }} />
              <input
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{
                  color: '#2C3E50',
                  fontFamily: typography.fontFamily,
                }}
              />
              {localSearchQuery && (
                <button
                  onClick={() => setLocalSearchQuery('')}
                  className="flex items-center justify-center p-1 rounded transition-opacity hover:opacity-70"
                  style={{
                    color: '#64748B',
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Avatar-based Assignee Selector */}
          {(() => {
            const maxVisibleAvatars = 5
            // If selected assignee is outside visible range, move them into it
            const orderedEmployees = (() => {
              if (!selectedAssignee) return employees
              const idx = employees.findIndex(e => e.id === selectedAssignee)
              if (idx < maxVisibleAvatars || idx === -1) return employees
              // Move selected employee to end of visible list
              const copy = [...employees]
              const selected = copy.splice(idx, 1)[0]!
              copy.splice(maxVisibleAvatars - 1, 0, selected)
              return copy
            })()
            const visibleEmployees = orderedEmployees.slice(0, maxVisibleAvatars)
            const remainingCount = Math.max(0, orderedEmployees.length - maxVisibleAvatars)
            const remainingEmployees = orderedEmployees.slice(maxVisibleAvatars)
            
            // Calculate workload stats for remaining employees
            const remainingStats = remainingEmployees.reduce((acc, emp) => {
              const workload = getEmployeeWorkload(emp.id)
              const status = workload?.workload.status || 'available'
              acc[status] = (acc[status] || 0) + 1
              return acc
            }, {} as Record<string, number>)

            const getInitials = (name: string) => {
              return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            }

            const getWorkloadColor = (status: string) => {
              switch (status) {
                case 'available': return '#10B981'
                case 'warning': return '#F59E0B'
                case 'overloaded': return '#EF4444'
                case 'on_leave': return '#8B5CF6'
                default: return '#94A3B8'
              }
            }

            return (
              <div className="flex items-center gap-1.5">
                {visibleEmployees.map((emp) => {
                  const workload = getEmployeeWorkload(emp.id)
                  const status = workload?.workload.status || 'available'
                  const workloadColor = getWorkloadColor(status)
                  const isSelected = selectedAssignee === emp.id
                  
                  return (
                    <button
                      key={emp.id}
                      onClick={() => updateSearchParam('assignee', isSelected ? '' : emp.id)}
                      className="relative transition-all hover:scale-110"
                      title={`${emp.full_name} - ${status}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          background: isSelected ? workloadColor : '#F4F5F7',
                          color: isSelected ? 'white' : '#2C3E50',
                          border: `2px solid ${workloadColor}`,
                          fontFamily: typography.fontFamily,
                        }}
                      >
                        {getInitials(emp.full_name)}
                      </div>
                      {/* Workload indicator dot */}
                      {!isSelected && (
                        <div
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                          style={{ background: workloadColor }}
                        />
                      )}
                    </button>
                  )
                })}

                {/* +N More with employee list */}
                {remainingCount > 0 && (
                  <div className="relative group">
                    <button
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110"
                      style={{
                        background: '#F4F5F7',
                        color: '#64748B',
                        border: '2px solid #DFE1E6',
                        fontFamily: typography.fontFamily,
                      }}
                    >
                      +{remainingCount}
                    </button>
                    
                    {/* Tooltip with employee list and workload */}
                    <div
                      className="absolute right-0 top-full pt-2 z-[100] min-w-[240px] max-w-[280px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto"
                    >
                    <div
                      style={{
                        background: 'white',
                        border: '1px solid #DFE1E6',
                        borderRadius: '8px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                        padding: '12px',
                      }}
                    >
                      <div
                        className="text-xs font-semibold mb-3 pb-2"
                        style={{
                          color: '#2C3E50',
                          fontFamily: typography.fontFamily,
                          borderBottom: '1px solid #F4F5F7',
                        }}
                      >
                        +{remainingCount} more team members
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {remainingEmployees.map((emp) => {
                          const workload = getEmployeeWorkload(emp.id)
                          const status = workload?.workload.status || 'available'
                          const workloadColor = getWorkloadColor(status)
                          const activeTasks = workload?.workload.active_tasks || 0
                          const overdueTasks = workload?.workload.overdue_tasks || 0
                          
                          return (
                            <div
                              key={emp.id}
                              className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => updateSearchParam('assignee', emp.id)}
                            >
                              {/* Avatar */}
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                                style={{
                                  background: '#F4F5F7',
                                  color: '#2C3E50',
                                  border: `2px solid ${workloadColor}`,
                                  fontFamily: typography.fontFamily,
                                }}
                              >
                                {getInitials(emp.full_name)}
                              </div>
                              
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-xs font-medium truncate"
                                  style={{
                                    color: '#2C3E50',
                                    fontFamily: typography.fontFamily,
                                  }}
                                >
                                  {emp.full_name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: workloadColor }}
                                  />
                                  <span
                                    className="text-[10px]"
                                    style={{
                                      color: '#64748B',
                                      fontFamily: typography.fontFamily,
                                    }}
                                  >
                                    {status === 'on_leave' ? 'On leave' : `${activeTasks} task${activeTasks !== 1 ? 's' : ''}`}
                                    {overdueTasks > 0 && (
                                      <span style={{ color: '#DC2626', marginLeft: '4px' }}>
                                        · {overdueTasks} overdue
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div
                  className="w-px h-6 mx-1"
                  style={{ background: '#DFE1E6' }}
                />
              </div>
            )
          })()}

          {/* Column visibility toggle */}
          <div ref={columnToggleRef} className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all"
              style={{
                background: showColumnToggle ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.05)',
                color: showColumnToggle ? '#6366F1' : '#64748B',
                fontFamily: typography.fontFamily,
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <Menu size={14} />
              Columns
              {hiddenColumnIds.size > 0 && (
                <span
                  className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                  style={{
                    background: '#6366F1',
                    color: 'white',
                  }}
                >
                  {(taskLists || []).filter(l => l.is_active).length - hiddenColumnIds.size}
                </span>
              )}
            </button>
            
            {showColumnToggle && (
              <div
                className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-lg border z-50"
                style={{
                  border: '1px solid #DFE1E6',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                <div
                  className="px-3 py-2 border-b text-xs font-bold"
                  style={{
                    borderColor: '#DFE1E6',
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  Show/Hide Columns
                </div>
                <div className="py-1">
                  {(taskLists || [])
                    .filter((list) => list.is_active)
                    .sort((a, b) => a.position - b.position)
                    .map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenColumnIds.has(list.id)}
                          onChange={() => toggleColumnVisibility(list.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{
                            accentColor: '#6366F1',
                          }}
                        />
                        <span
                          className="text-sm flex-1"
                          style={{
                            color: '#2C3E50',
                            fontFamily: typography.fontFamily,
                          }}
                        >
                          {list.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          {/* Priority Filter (Multi-select) */}
          <div className="relative">
            {(() => {
              const priorityConfig = [
                { value: 'urgent', label: 'Urgent', icon: Flame, color: '#EF4444' },
                { value: 'high', label: 'High', icon: TrendingUp, color: '#F59E0B' },
                { value: 'medium', label: 'Medium', icon: Minus, color: '#3B82F6' },
                { value: 'low', label: 'Low', icon: TrendingDown, color: '#64748B' },
              ]
              
              const singlePriority = selectedPriorities.length === 1 ? priorityConfig.find(p => p.value === selectedPriorities[0]) : null
              const buttonColor = singlePriority ? singlePriority.color : (selectedPriorities.length > 0 ? '#6366F1' : '#64748B')
              const buttonBg = singlePriority ? `${singlePriority.color}15` : (selectedPriorities.length > 0 ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.05)')
              
              return (
                <button
                  onClick={() => setShowPriorityPicker(!showPriorityPicker)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                  style={{
                    background: buttonBg,
                    border: '1px solid rgba(0,0,0,0.08)',
                    color: buttonColor,
                    fontSize: '12px',
                    fontWeight: '700',
                    fontFamily: typography.fontFamily,
                  }}
                  data-testid="priority-filter-button"
                >
                  {singlePriority && <singlePriority.icon size={14} />}
                  <span>
                    {selectedPriorities.length === 0
                      ? 'All Priority'
                      : selectedPriorities.length === 1 && singlePriority
                      ? singlePriority.label
                      : `${selectedPriorities.length} Priorities`}
                  </span>
                  {selectedPriorities.length > 0 && (
                    <X 
                      size={14} 
                      strokeWidth={3} 
                      onClick={(e) => {
                        e.stopPropagation()
                        updateSearchParam('priority', '')
                      }}
                      className="hover:opacity-70"
                    />
                  )}
                </button>
              )
            })()}
            
            {showPriorityPicker && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPriorityPicker(false)}
                />
                <div
                  className="absolute left-0 top-full mt-2 w-48 rounded-lg shadow-lg z-50"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E8ECF0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="py-2 px-2">
                    {[
                      { value: 'urgent', label: 'Urgent', icon: Flame, color: '#EF4444' },
                      { value: 'high', label: 'High', icon: TrendingUp, color: '#F59E0B' },
                      { value: 'medium', label: 'Medium', icon: Minus, color: '#3B82F6' },
                      { value: 'low', label: 'Low', icon: TrendingDown, color: '#64748B' },
                    ].map((priority) => {
                      const isSelected = selectedPriorities.includes(priority.value)
                      return (
                        <button
                          key={priority.value}
                          onClick={() => {
                            const newPriorities = isSelected
                              ? selectedPriorities.filter(p => p !== priority.value)
                              : [...selectedPriorities, priority.value]
                            updateSearchParam('priority', newPriorities.join(','))
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded transition-colors flex items-center gap-2"
                          style={{
                            color: '#2C3E50',
                            fontFamily: typography.fontFamily,
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          }}
                        >
                          <priority.icon size={14} style={{ color: priority.color }} />
                          <span className="flex-1">{priority.label}</span>
                          {isSelected && <Check size={14} style={{ color: colors.accent }} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active Label Filter Chips */}
          {selectedLabels.length > 0 && (
            <button
              onClick={() => updateSearchParam('label', '')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:opacity-80"
              style={{
                background: colors.accent,
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: typography.fontFamily,
                border: 'none',
              }}
              data-testid="active-label-filter-chip"
            >
              <Tag size={12} />
              <span>
                {selectedLabels.length === 1
                  ? selectedLabels[0]
                  : `${selectedLabels.length} Labels`}
              </span>
              <X size={14} strokeWidth={3} />
            </button>
          )}

          {/* More menu button */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.08)',
                width: '36px',
                height: '36px',
                color: '#64748B',
              }}
              data-testid="tasks-more-menu-button"
            >
              <MoreVertical size={16} />
            </button>
            
            {showMoreMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowLabelPicker(false)
                  }}
                />
                
                {/* Dropdown menu */}
                <div
                  className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E8ECF0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                  data-testid="tasks-more-menu-dropdown"
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        if (allLabels.length === 0) {
                          setShowMoreMenu(false)
                          alert('No labels found in your tasks yet. Add labels to tasks to use this filter.')
                          return
                        }
                        // Toggle label picker
                        setShowLabelPicker(!showLabelPicker)
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                      style={{
                        color: '#2C3E50',
                        fontSize: '14px',
                        fontFamily: typography.fontFamily,
                        background: showLabelPicker ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                      }}
                      data-testid="filter-by-label-option"
                    >
                      <Filter size={16} style={{ color: colors.accent }} />
                      <div className="flex-1">
                        <div className="font-medium">Filter by Label</div>
                        <div className="text-xs" style={{ color: '#A0AEC0' }}>
                          {selectedLabels.length > 0 ? `${selectedLabels.length} selected` : `${allLabels.length} available`}
                        </div>
                      </div>
                      {allLabels.length > 0 && (
                        <span style={{ color: '#A0AEC0', fontSize: '12px' }}>
                          {showLabelPicker ? '▲' : '▼'}
                        </span>
                      )}
                    </button>
                    
                    {/* Label picker inline view (multi-select) */}
                    {showLabelPicker && allLabels.length > 0 && (
                      <div 
                        className="px-4 py-3 bg-gray-50 border-t border-gray-200"
                        style={{
                          fontFamily: typography.fontFamily,
                        }}
                      >
                        <div className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>
                          Select labels (multi-select):
                        </div>
                        <div className="space-y-1">
                          {allLabels.map(label => {
                            const isSelected = selectedLabels.includes(label)
                            return (
                              <button
                                key={label}
                                onClick={() => {
                                  const newLabels = isSelected
                                    ? selectedLabels.filter(l => l !== label)
                                    : [...selectedLabels, label]
                                  updateSearchParam('label', newLabels.join(','))
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-white rounded transition-colors flex items-center gap-2"
                                style={{
                                  color: '#2C3E50',
                                  fontFamily: typography.fontFamily,
                                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                }}
                              >
                                <Tag size={14} style={{ color: colors.accent }} />
                                <span className="flex-1">{label}</span>
                                {isSelected && <Check size={14} style={{ color: colors.accent }} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div className="my-1" style={{ borderTop: '1px solid #E8ECF0' }} />
                    
                    <button
                      onClick={() => {
                        setShowMoreMenu(false)
                        // Export tasks as JSON
                        const exportData = {
                          tasks: tasks,
                          lists: taskLists,
                          exportedAt: new Date().toISOString(),
                        }
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `tasks-${new Date().toISOString().split('T')[0]}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                      style={{
                        color: '#2C3E50',
                        fontSize: '14px',
                        fontFamily: typography.fontFamily,
                      }}
                      data-testid="export-tasks-option"
                    >
                      <Download size={16} style={{ color: '#7F8C8D' }} />
                      <div>
                        <div className="font-medium">Export Tasks</div>
                        <div className="text-xs" style={{ color: '#A0AEC0' }}>Download as JSON</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          </> /* end board-only filters */}
        </div>
      </div>

      {/* All Issues — table/list view (non-board) */}
      {viewMode === 'all-issues' && (
        <div className="flex-1 min-h-0 px-1 pb-6">
          <AllIssuesTable
            employees={employees}
            onTaskClick={(task) => navigate({ search: (prev) => ({ ...prev, task: task.code || task.id }), replace: false })}
          />
        </div>
      )}

      {/* Mobile: Column Tab Navigation (<640px) */}
      {viewMode !== 'all-issues' && (
        <div className="block sm:hidden">
          <ColumnTabNav
            columns={visibleLists}
            activeColumnId={activeColumnId || visibleLists[0]?.id || ''}
            taskCounts={taskCounts}
            onColumnChange={handleColumnChange}
          />
        </div>
      )}

      {/* Unique Vertical Board */}
      {viewMode !== 'all-issues' && <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 pb-4 -mx-6 px-6 md:-mx-11 md:px-11 overflow-x-auto" style={{ minHeight: '400px', scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}>
          {columnConfig.map((col, idx) => {
            const columnTasks = (displayTasks || [])
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
            
            // Mobile: Only show active column, Desktop: show all
            const isMobileActive = activeColumnId === col.id || !activeColumnId || idx === 0
            const shouldShow = typeof window === 'undefined' || window.innerWidth >= 640 || isMobileActive
            
            if (!shouldShow) return null
            
            return (
              <React.Fragment key={col.id}>
                <div 
                  id={`column-${col.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${col.id}`}
                  className={typeof window !== 'undefined' && window.innerWidth < 640 && !isMobileActive ? 'hidden' : ''}
                  style={{ minWidth: '300px', flex: '1 0 0%' }}
                >
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
                    onStartCreateModal={(listId) => navigate({ search: (prev) => ({ ...prev, create: listId }), replace: false })}
                    onStartCreateInline={setCreatingInListId}
                    onTaskClick={(task) => navigate({ search: (prev) => ({ ...prev, task: task.code || task.id }), replace: false })}
                    isFinalState={col.is_final_state}
                  />
                </div>
                
                {/* Hand-drawn vertical divider between columns (desktop only) */}
                {idx < columnConfig.length - 1 && (
                  <div 
                    className="hidden sm:flex items-stretch flex-shrink-0"
                    style={{
                      width: '6px',
                      pointerEvents: 'none',
                      marginLeft: '-4px',
                      marginRight: '-4px',
                    }}
                  >
                    <svg
                      width="6"
                      height="100%"
                      style={{ overflow: 'visible' }}
                    >
                      <path
                        d="M 3 0 Q 4 40, 3 70 T 3 140 T 3 210 T 3 280 T 3 350 T 3 420 T 3 490 T 3 560"
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
          {activeTask ? (
            <EnhancedTaskCard 
              task={activeTask} 
              isDragging 
              employees={employees}
              getEmployeeWorkload={getEmployeeWorkload}
            />
          ) : null}
        </DragOverlay>
      </DndContext>}

      {/* Task Detail Modal - Used for viewing/editing */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          employees={employees}
          taskLists={visibleLists}
          getEmployeeWorkload={getEmployeeWorkload}
          onClose={() => navigate({ search: (prev) => { const { task, ...rest } = prev; return rest; }, replace: false })}
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
            navigate({ search: (prev) => { const { create, ...rest } = prev; return rest; }, replace: false })
            setNewTaskTitle('')
            setNewTaskAssignee('')
          }}
        />
      )}
      </div> {/* Close max-width container */}
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
                  fontFamily: typography.fontFamily,
                  letterSpacing: '0.5px',
                  transform: `rotate(${isFinalState ? -1 : 0}deg)`,
                }}
              >
                {label}
              </h3>
            </div>
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
            <SortableTaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task)}
              employees={employees}
              getEmployeeWorkload={getEmployeeWorkload}
            />
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
                      ? '(On Leave)' 
                      : workload.workload.status === 'overloaded' 
                        ? `(${workload.workload.active_tasks} tasks)` 
                        : workload.workload.status === 'warning'
                          ? `(${workload.workload.active_tasks} tasks)`
                          : ''
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
              onClick={() => onStartCreateModal(listId)}
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

function SortableTaskCard({ 
  task, 
  onClick,
  employees,
  getEmployeeWorkload
}: { 
  task: TaskWithDetails
  onClick: () => void
  employees: Employee[]
  getEmployeeWorkload: (employeeId: string) => EmployeeWorkload | undefined
}) {
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
      <EnhancedTaskCard 
        task={task} 
        onClick={onClick} 
        isDragging={isDragging}
        employees={employees}
        getEmployeeWorkload={getEmployeeWorkload}
      />
    </div>
  )
}

// ── Old TaskCard function removed - now using EnhancedTaskCard from components/tasks/TaskCard.tsx ──

