import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Flame, TrendingUp, Minus, TrendingDown, Search, Check, Zap, Plane, Menu, List, Star, X, MoreVertical, Filter, Download, Tag, ChevronLeft } from 'lucide-react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { ColumnTabNav } from '@/components/tasks/ColumnTabNav'
import { TaskCard as EnhancedTaskCard } from '@/components/tasks/TaskCard'
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
  useCreateTaskList,
  useFieldDefinitions,
  useCreateFieldDefinition,
} from '@/lib/hooks/useTasks'
import { useEmployees, useEmployeeWorkload } from '@/lib/hooks/useEmployees'
import { useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { useCanEditOrgSettings } from '@/lib/hooks/useRole'
import type { TaskWithDetails, TaskPriority, Employee, EmployeeWorkload, FieldDefinition, FieldType } from '@/types/api'

// URL search params for filters
type ViewMode = 'all' | 'tasks' | 'approvals'

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
      view: view === 'tasks' || view === 'approvals' ? view : undefined,
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
  const selectedAssignees = selectedAssignee ? selectedAssignee.split(',') : []
  
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
  const createListMutation = useCreateTaskList()
  const { data: fieldDefs = [] } = useFieldDefinitions()
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
  
  // Column visibility state — Fizzy-style: max N expanded, rest collapsed as vertical strips
  const [maxExpandedColumns, setMaxExpandedColumns] = useState<number>(() => {
    if (typeof window === 'undefined') return 2
    const stored = localStorage.getItem('workived:maxExpandedColumns')
    return stored ? parseInt(stored, 10) : 2
  })
  const [expandedColumnIds, setExpandedColumnIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const storedMax = typeof window !== 'undefined' ? localStorage.getItem('workived:maxExpandedColumns') : null
    const MAX_EXPANDED_COLUMNS = storedMax ? parseInt(storedMax, 10) : 2
    const stored = localStorage.getItem('workived:expandedColumns')
    if (stored) {
      try { return new Set(JSON.parse(stored)) } catch { /* fall through */ }
    }
    // Default: first N active columns expanded
    const activeLists = (taskLists || []).filter(l => l.is_active).sort((a, b) => a.position - b.position)
    return new Set(activeLists.slice(0, MAX_EXPANDED_COLUMNS).map(l => l.id))
  })
  const [showColumnToggle, setShowColumnToggle] = useState(false)
  const columnToggleRef = useRef<HTMLDivElement>(null)
  
  // Track recently auto-expanded columns for animation
  const [autoExpandedColumns, setAutoExpandedColumns] = useState<Set<string>>(new Set())
  
  // Assignee overflow dropdown
  const [showAssigneeOverflow, setShowAssigneeOverflow] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const assigneeOverflowRef = useRef<HTMLDivElement>(null)
  
  // Add Column modal
  const [showAddColumnModal, setShowAddColumnModal] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  
  // Sidebar expansion state
  const [showAllLabels, setShowAllLabels] = useState(false)
  const [showAllFields, setShowAllFields] = useState(false)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([])
  const [newFieldOptionInput, setNewFieldOptionInput] = useState('')
  const createFieldMutation = useCreateFieldDefinition()
  const [showAddLabelModal, setShowAddLabelModal] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  
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
    
    // Assignee filter (multi-select)
    if (selectedAssignees.length > 0) {
      if (selectedAssignees.includes('unassigned')) {
        filtered = filtered.filter((task) => !task.assignee_id)
      } else {
        filtered = filtered.filter((task) => task.assignee_id && selectedAssignees.includes(task.assignee_id))
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
  }, [optimisticTasks, viewMode, localSearchQuery, selectedAssignees, selectedPriorities, selectedLabels, showCompleted])
  
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
  
  // Close assignee overflow dropdown when clicking outside
  useEffect(() => {
    if (!showAssigneeOverflow) return
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeOverflowRef.current && !assigneeOverflowRef.current.contains(event.target as Node)) {
        setShowAssigneeOverflow(false)
        setAssigneeSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAssigneeOverflow])
  
  // Persist expanded columns and max to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('workived:expandedColumns', JSON.stringify([...expandedColumnIds]))
  }, [expandedColumnIds])
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('workived:maxExpandedColumns', maxExpandedColumns.toString())
  }, [maxExpandedColumns])
  
  // Adjust expanded columns when max changes
  useEffect(() => {
    if (expandedColumnIds.size > maxExpandedColumns) {
      const allLists = (taskLists || []).filter(l => l.is_active).sort((a, b) => a.position - b.position)
      const expandedInOrder = allLists.filter(l => expandedColumnIds.has(l.id))
      const toKeep = new Set(expandedInOrder.slice(0, maxExpandedColumns).map(l => l.id))
      setExpandedColumnIds(toKeep)
    } else if (expandedColumnIds.size < maxExpandedColumns && taskLists.length > 0) {
      const allLists = (taskLists || []).filter(l => l.is_active).sort((a, b) => a.position - b.position)
      const collapsedLists = allLists.filter(l => !expandedColumnIds.has(l.id))
      if (collapsedLists.length > 0) {
        const newSet = new Set(expandedColumnIds)
        const toAdd = collapsedLists.slice(0, maxExpandedColumns - expandedColumnIds.size)
        toAdd.forEach(l => newSet.add(l.id))
        setExpandedColumnIds(newSet)
      }
    }
  }, [maxExpandedColumns, taskLists])
  
  // Close modals with ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddColumnModal) {
          setShowAddColumnModal(false)
          setNewColumnName('')
        } else if (showAddFieldModal) {
          setShowAddFieldModal(false)
          setNewFieldName('')
          setNewFieldType('text')
          setNewFieldOptions([])
          setNewFieldOptionInput('')
        } else if (showAddLabelModal) {
          setShowAddLabelModal(false)
          setNewLabelName('')
        }
      }
    }
    
    if (showAddColumnModal || showAddFieldModal || showAddLabelModal) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showAddColumnModal, showAddFieldModal, showAddLabelModal])
  
  // Initialize expanded columns when taskLists load (if fewer than max or not yet set)
  useEffect(() => {
    if (taskLists.length > 0 && expandedColumnIds.size < maxExpandedColumns) {
      const activeLists = taskLists.filter(l => l.is_active).sort((a, b) => a.position - b.position)
      // Prioritize middle columns (active work) over first/last (backlog/done)
      const priorityOrder = activeLists.length <= maxExpandedColumns 
        ? activeLists
        : [
            // Show non-final, non-first columns first (active work)
            ...activeLists.filter((l, idx) => !l.is_final_state && idx > 0),
            // Then first column (backlog)
            ...activeLists.filter((l, idx) => idx === 0),
            // Then final columns (done)
            ...activeLists.filter(l => l.is_final_state),
          ]
      
      const newSet = new Set(expandedColumnIds)
      for (const list of priorityOrder) {
        if (newSet.size >= maxExpandedColumns) break
        newSet.add(list.id)
      }
      if (newSet.size !== expandedColumnIds.size) {
        setExpandedColumnIds(newSet)
      }
    }
  }, [taskLists, expandedColumnIds.size])
  
  // Toggle column expanded/collapsed — clicking a collapsed column expands it
  const toggleColumnExpanded = useCallback((columnId: string) => {
    setExpandedColumnIds(prev => {
      const next = new Set(prev)
      const allLists = (taskLists || []).filter(l => l.is_active).sort((a, b) => a.position - b.position)
      let autoExpandedId: string | null = null
      
      if (next.has(columnId)) {
        // Collapsing a column — must swap with a collapsed column to maintain max count
        const clickedIdx = allLists.findIndex(l => l.id === columnId)
        
        // Find the next collapsed column in order (wrapping around)
        let replacementId: string | null = null
        
        // First, try columns after the clicked one
        for (let i = clickedIdx + 1; i < allLists.length; i++) {
          const list = allLists[i]
          if (list && !next.has(list.id)) {
            replacementId = list.id
            break
          }
        }
        
        // If not found, wrap around and try from the beginning
        if (!replacementId) {
          for (let i = 0; i < clickedIdx; i++) {
            const list = allLists[i]
            if (list && !next.has(list.id)) {
              replacementId = list.id
              break
            }
          }
        }
        
        // Only allow collapse if we have a replacement to maintain the count
        if (!replacementId) {
          return prev // Can't collapse — no replacement available
        }
        
        // Perform the swap
        next.delete(columnId)
        next.add(replacementId)
        autoExpandedId = replacementId
      } else {
        // Expand this column — if already at max, remove the furthest expanded column
        if (next.size >= maxExpandedColumns) {
          const expandedInOrder = allLists.filter(l => next.has(l.id))
          const clickedIdx = allLists.findIndex(l => l.id === columnId)
          
          if (expandedInOrder.length > 0) {
            // Calculate distance from clicked column to each expanded column
            const distances = expandedInOrder.map(exp => {
              const expIdx = allLists.findIndex(l => l.id === exp.id)
              return { column: exp, distance: Math.abs(expIdx - clickedIdx) }
            })
            
            // Remove the expanded column with the maximum distance
            distances.sort((a, b) => b.distance - a.distance)
            const toRemove = distances[0]?.column
            if (toRemove && toRemove.id !== columnId) {
              next.delete(toRemove.id)
            }
          }
        }
        next.add(columnId)
      }
      
      // Mark auto-expanded column for animation
      if (autoExpandedId) {
        setAutoExpandedColumns(new Set([autoExpandedId]))
        // Clear animation after 1 second
        setTimeout(() => {
          setAutoExpandedColumns(prev => {
            const newSet = new Set(prev)
            newSet.delete(autoExpandedId!)
            return newSet
          })
        }, 1000)
      }
      
      return next
    })
  }, [taskLists, maxExpandedColumns])
  
  // All active lists in position order (for rendering both expanded + collapsed)
  const allActiveLists = useMemo(() => {
    const lists = taskLists || []
    return lists
      .filter((list) => list.is_active)
      .sort((a, b) => a.position - b.position)
  }, [taskLists])

  // Render all active lists in position order, excluding hidden columns
  const visibleLists = useMemo(() => {
    return allActiveLists.filter(list => expandedColumnIds.has(list.id))
  }, [allActiveLists, expandedColumnIds])
  
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
  const hasActiveFilters = !!(localSearchQuery || selectedAssignees.length > 0 || selectedPriorities.length > 0 || selectedLabels.length > 0 || showCompleted === false)

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

  // Calculate task counts per column (using filtered tasks — all active columns)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allActiveLists.forEach((list) => {
      counts[list.id] = (displayTasks || []).filter(
        (t) => t.task_list_id === list.id
      ).length
    })
    return counts
  }, [allActiveLists, displayTasks])

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
    // Check if id is a list ID (including collapsed columns)
    if (allActiveLists.some((list) => list.id === id)) return id
    // Find task and return its list_id
    const tasks = optimisticTasks || []
    return tasks.find((t) => t.id === id)?.task_list_id
  }, [optimisticTasks, allActiveLists])

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
      
      // Place moved task at the top of the target column
      const minPosition = listTasks.length > 0 
        ? Math.min(...listTasks.map((t) => t.position)) 
        : 1000
      const newPosition = Math.max(1, minPosition - 1000)

      // Check if we're moving FROM a final state list to a non-final state list
      const sourceList = allActiveLists.find((l) => l.id === activeListId)
      const targetList = allActiveLists.find((l) => l.id === overListId)
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
  }, [activeTask, activeTaskOriginalListId, findListId, moveMutation, optimisticTasks, allActiveLists, approveLeaveRequest, approveClaimMutation])

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
  const finalStateListIds = new Set(allActiveLists.filter((l) => l.is_final_state).map((l) => l.id))
  const completedTasks = (tasks || []).filter(
    (t) => t.completed_at || finalStateListIds.has(t.task_list_id)
  ).length
  const inProgressList = allActiveLists.find((l) => !l.is_final_state && l !== allActiveLists[0])
  const inProgressCount = inProgressList ? (displayTasks || []).filter(
    (t) => t.task_list_id === inProgressList.id && !t.completed_at
  ).length : 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.tasks, paddingBottom: '160px' }}  // Use design tokens
    >
      {/* CSS Animations for column transitions */}
      <style>{`
        @keyframes columnFlash {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
          15% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.2), 0 0 20px 0 rgba(99, 102, 241, 0.15); }
          50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.1), 0 0 20px 0 rgba(99, 102, 241, 0.05); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        @keyframes collapsePopIn {
          0% { transform: scaleX(0.3) scaleY(0.95); opacity: 0; }
          50% { transform: scaleX(1.08) scaleY(1); opacity: 1; }
          100% { transform: scaleX(1) scaleY(1); opacity: 1; }
        }
        .avatar-tooltip {
          position: relative;
        }
        .avatar-tooltip .avatar-tip {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1E293B;
          color: white;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          line-height: 1.4;
          white-space: nowrap;
          z-index: 50;
          pointer-events: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .avatar-tooltip .avatar-tip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #1E293B;
        }
        .avatar-tooltip:hover .avatar-tip {
          display: block;
        }
      `}</style>
      
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
        
        {/* Single unified filter row — slim top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Board view tabs (All / Tasks / Approvals) */}
          <div className="flex items-center gap-1.5 rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
            {([['all', 'All'], ['tasks', 'Tasks'], ['approvals', 'Approvals']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => updateSearchParam('view', mode === 'all' ? '' : mode)}
                className="px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={{
                  background: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals')) ? 'white' : 'transparent',
                  color: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals')) ? '#2C3E50' : '#64748B',
                  boxShadow: (viewMode === mode || (mode === 'all' && viewMode !== 'tasks' && viewMode !== 'approvals')) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: typography.fontFamily,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-6 self-center" style={{ background: 'rgba(0,0,0,0.15)' }} />

          {/* All Tasks — link to table view */}
          <Link
            to="/tasks/list"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: '#2C3E50',
              color: 'white',
              fontFamily: typography.fontFamily,
              textDecoration: 'none',
            }}
          >
            <List size={14} />
            All Tasks
          </Link>

          {/* Divider */}
          <div className="w-px h-6 self-center" style={{ background: 'rgba(0,0,0,0.15)' }} />

          {/* Search box */}
          <div className="flex-1 min-w-[100px]">
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
                  style={{ color: '#64748B' }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Assignee avatars */}
          <div className="flex items-center gap-1 relative" ref={assigneeOverflowRef}>
            {(() => {
              // Build visible list: first 5 employees, but swap in selected ones from overflow
              const first5 = employees.slice(0, 5)
              const selectedFromOverflow = selectedAssignees
                .map(id => employees.find(e => e.id === id))
                .filter((e): e is typeof employees[0] => !!e && !first5.some(f => f.id === e.id))
              
              let visibleEmployees = first5
              if (selectedFromOverflow.length > 0) {
                // Replace last N unselected slots with selected overflow employees
                const slotsNeeded = selectedFromOverflow.length
                const unselectedInFirst5 = first5.filter(e => !selectedAssignees.includes(e.id))
                const keepFromFirst5 = first5.filter(e => selectedAssignees.includes(e.id))
                const remainUnselected = unselectedInFirst5.slice(0, 5 - keepFromFirst5.length - slotsNeeded)
                visibleEmployees = [...keepFromFirst5, ...selectedFromOverflow, ...remainUnselected].slice(0, 5)
              }
              
              const overflowEmployees = employees.filter(e => !visibleEmployees.some(v => v.id === e.id))
              
              const toggleAssignee = (empId: string) => {
                const newAssignees = selectedAssignees.includes(empId)
                  ? selectedAssignees.filter(id => id !== empId)
                  : [...selectedAssignees, empId]
                updateSearchParam('assignee', newAssignees.join(','))
              }
              
              return (
                <>
                  {visibleEmployees.map((emp) => {
                    const workload = getEmployeeWorkload(emp.id)
                    const status = workload?.workload.status || 'available'
                    const workloadColor = status === 'available' ? '#10B981' : status === 'warning' ? '#F59E0B' : status === 'overloaded' ? '#EF4444' : status === 'on_leave' ? '#8B5CF6' : '#94A3B8'
                    const isSelected = selectedAssignees.includes(emp.id)
                    const initials = emp.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    const activeTasks = workload?.workload.active_tasks ?? 0
                    const overdueTasks = workload?.workload.overdue_tasks ?? 0
                    const statusLabel = status === 'available' ? 'Available' : status === 'warning' ? 'Busy' : status === 'overloaded' ? 'Overloaded' : status === 'on_leave' ? 'On Leave' : 'Unknown'
                    const tooltip = `${emp.full_name} · ${statusLabel}\n${activeTasks} active tasks${overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ''}`
                    
                    return (
                      <button
                        key={emp.id}
                        onClick={() => toggleAssignee(emp.id)}
                        className="relative transition-all hover:scale-110 avatar-tooltip"
                      >
                        <div className="avatar-tip">
                          <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                          <div style={{ color: workloadColor }}>{statusLabel}</div>
                          {status !== 'on_leave' && (
                            <div style={{ color: '#94A3B8' }}>
                              {activeTasks} tasks{overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ''}
                            </div>
                          )}
                        </div>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold"
                          style={{
                            background: isSelected ? workloadColor : '#F4F5F7',
                            color: isSelected ? 'white' : '#2C3E50',
                            border: `2px solid ${isSelected ? workloadColor : '#D1D5DB'}`,
                            fontFamily: typography.fontFamily,
                            boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${workloadColor}` : 'none',
                          }}
                        >
                          {initials}
                        </div>
                      </button>
                    )
                  })}
                  {overflowEmployees.length > 0 && (
                    <button
                      onClick={() => setShowAssigneeOverflow(!showAssigneeOverflow)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110"
                      style={{
                        background: 'rgba(0,0,0,0.06)',
                        color: '#64748B',
                        fontFamily: typography.fontFamily,
                      }}
                      title="Show more assignees"
                    >
                      +{overflowEmployees.length}
                    </button>
                  )}
                  {/* Overflow dropdown */}
                  {showAssigneeOverflow && overflowEmployees.length > 0 && (
                    <div
                      className="absolute top-full mt-2 right-0 rounded-xl z-50 min-w-[220px]"
                      style={{
                  background: 'white',
                  border: '1px solid #E8ECF0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }}
              >
                <div className="p-2 border-b" style={{ borderColor: '#E8ECF0' }}>
                  <input
                    type="text"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder="Search..."
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-md text-xs bg-transparent border-none outline-none"
                    style={{
                      background: '#F4F5F7',
                      color: '#2C3E50',
                      fontFamily: typography.fontFamily,
                    }}
                  />
                </div>
                <div className="py-1 max-h-[280px] overflow-y-auto">
                {overflowEmployees
                  .filter(emp => emp.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                  .map((emp) => {
                  const workload = getEmployeeWorkload(emp.id)
                  const status = workload?.workload.status || 'available'
                  const workloadColor = status === 'available' ? '#10B981' : status === 'warning' ? '#F59E0B' : status === 'overloaded' ? '#EF4444' : status === 'on_leave' ? '#8B5CF6' : '#94A3B8'
                  const statusLabel = status === 'available' ? 'Available' : status === 'warning' ? 'Busy' : status === 'overloaded' ? 'Overloaded' : status === 'on_leave' ? 'On Leave' : 'Unknown'
                  const isSelected = selectedAssignees.includes(emp.id)
                  const initials = emp.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  const activeTasks = workload?.workload.active_tasks ?? 0
                  const overdueTasks = workload?.workload.overdue_tasks ?? 0
                  
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        toggleAssignee(emp.id)
                        setShowAssigneeOverflow(false)
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-all hover:bg-gray-50"
                      style={{
                        fontFamily: typography.fontFamily,
                        background: isSelected ? `${workloadColor}08` : 'transparent',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                        style={{
                          background: isSelected ? workloadColor : '#F4F5F7',
                          color: isSelected ? 'white' : '#2C3E50',
                          border: `2px solid ${isSelected ? workloadColor : '#D1D5DB'}`,
                        }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="truncate font-medium" style={{ color: '#2C3E50' }}>{emp.full_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: workloadColor }} />
                          <span className="text-[10px]" style={{ color: workloadColor }}>{statusLabel}</span>
                          {status !== 'on_leave' && (
                            <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                              · {activeTasks} tasks{overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check size={12} style={{ color: workloadColor, flexShrink: 0 }} />}
                    </button>
                  )
                })}
                </div>
              </div>
            )}
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Mobile: Column Tab Navigation (<640px) — show all active columns */}
      <div className="block sm:hidden">
        <ColumnTabNav
          columns={allActiveLists}
          activeColumnId={activeColumnId || allActiveLists[0]?.id || ''}
          taskCounts={taskCounts}
          onColumnChange={handleColumnChange}
        />
      </div>

      {/* Unique Vertical Board — Two-column layout: Board + Right Sidebar */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-0 pb-4 -mx-6 px-6 md:-mx-11 md:px-11" style={{ minHeight: '400px' }}>
          {/* Left: Board with all columns (expanded + collapsed) in workflow order */}
          <div className="flex gap-0 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}>
          {/* Render all columns in their natural workflow order */}
          {allActiveLists.map((col, idx) => {
            const isExpanded = expandedColumnIds.has(col.id)
            const columnTasks = (displayTasks || [])
              .filter((t) => t.task_list_id === col.id)
              .sort((a, b) => {
                const aIsApproval = a.approval_type && !a.completed_at
                const bIsApproval = b.approval_type && !b.completed_at
                if (aIsApproval && !bIsApproval) return -1
                if (!aIsApproval && bIsApproval) return 1
                return a.position - b.position
              })
            const taskCount = columnTasks.length
            
            // Mobile: Only show active column
            const isMobileActive = activeColumnId === col.id || !activeColumnId || idx === 0
            const shouldShow = typeof window === 'undefined' || window.innerWidth >= 640 || isMobileActive
            if (!shouldShow) return null

            // Collapsed column - show as vertical strip
            if (!isExpanded) {
              return (
                <CollapsedColumn
                  key={col.id}
                  col={col}
                  taskCount={taskCount}
                  idx={idx}
                  onExpand={() => toggleColumnExpanded(col.id)}
                />
              )
            }
            
            // Expanded column
            const expandedColumns = allActiveLists.filter(c => expandedColumnIds.has(c.id))
            const colIdx = expandedColumns.indexOf(col)
            
            // Calculate fixed width based on number of expanded columns for consistent sizing
            const getColumnWidth = () => {
              const count = expandedColumns.length
              if (count === 2) return '400px'
              if (count === 3) return '350px'
              return '320px' // 4 or more
            }
            
            return (
              <React.Fragment key={col.id}>
                <div 
                  id={`column-${col.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${col.id}`}
                  className={typeof window !== 'undefined' && window.innerWidth < 640 && !isMobileActive ? 'hidden' : ''}
                  style={{ 
                    width: getColumnWidth(),
                    flexShrink: 0,
                    marginLeft: idx > 0 ? '4px' : '0',
                    animation: autoExpandedColumns.has(col.id) ? 'columnFlash 0.6s ease-out' : 'none',
                    transition: 'all 0.3s ease-in-out',
                  }}
                >
                  <StatusColumn
                    listId={col.id}
                    label={col.name}
                    count={taskCount}
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
                    onCollapse={() => toggleColumnExpanded(col.id)}
                    canCollapse={true}
                  />
                </div>
                
                {/* Hand-drawn vertical divider between expanded columns (desktop only) */}
                {colIdx < expandedColumns.length - 1 && (
                  <div 
                    className="hidden sm:flex items-stretch flex-shrink-0"
                    style={{
                      width: '6px',
                      pointerEvents: 'none',
                      marginLeft: '-2px',
                      marginRight: '-2px',
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

          {/* Add Column button */}
          {canEditOrgSettings && (
            <div
              className="flex-shrink-0 hidden sm:flex flex-col items-center justify-start cursor-pointer transition-all hover:opacity-80"
              onClick={() => setShowAddColumnModal(true)}
              style={{
                width: '44px',
                minHeight: '200px',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: '12px',
                marginLeft: '4px',
                border: '2px dashed rgba(0,0,0,0.1)',
                paddingTop: '16px',
                opacity: org?.plan !== 'pro' ? 0.5 : 1,
              }}
              title={org?.plan === 'pro' ? 'Add new column' : 'PRO feature — Upgrade to add columns'}
            >
              <div
                className="flex items-center justify-center rounded-full text-lg font-light"
                style={{
                  width: '28px',
                  height: '28px',
                  color: '#94A3B8',
                  background: 'rgba(0,0,0,0.04)',
                }}
              >
                +
              </div>
              {org?.plan !== 'pro' && (
                <div 
                  className="text-[10px] font-black mt-4 uppercase tracking-widest px-3 py-1.5"
                  style={{ 
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)', 
                    color: 'white', 
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.5), 0 0 0 2px rgba(255,255,255,0.3)',
                    fontWeight: 900,
                    letterSpacing: '0.5px'
                  }}
                >
                  PRO
                </div>
              )}
            </div>
          )}
          </div>

          {/* Right Sidebar: Collapsed columns + Filters */}
          <div className="hidden sm:flex flex-col gap-4 flex-shrink-0 ml-4" style={{ width: '220px' }}>
            {/* All columns - toggle expanded/collapsed */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
                  >
                    Columns
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-medium" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>Max:</span>
                  {[2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => setMaxExpandedColumns(num)}
                      className="w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-all"
                      style={{
                        background: maxExpandedColumns === num ? '#6366F1' : 'rgba(0,0,0,0.04)',
                        color: maxExpandedColumns === num ? 'white' : '#94A3B8',
                        border: `1px solid ${maxExpandedColumns === num ? '#6366F1' : 'rgba(0,0,0,0.1)'}`,
                      }}
                      title={`Show ${num} columns`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              {allActiveLists.map((col) => {
                const isExpanded = expandedColumnIds.has(col.id)
                const columnTasks = (displayTasks || []).filter((t) => t.task_list_id === col.id)
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumnExpanded(col.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all hover:bg-black/5"
                    style={{
                      background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.03)',
                      border: isExpanded ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(0,0,0,0.06)',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
                      style={{
                        width: '20px',
                        height: '20px',
                        background: isExpanded ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.06)',
                        color: isExpanded ? '#6366F1' : '#94A3B8',
                      }}
                    >
                      {columnTasks.length}
                    </div>
                    <span
                      className="truncate flex-1 text-left font-semibold"
                      style={{ color: isExpanded ? '#2C3E50' : '#94A3B8' }}
                    >
                      {col.name}
                    </span>
                    {isExpanded && (
                      <Check size={12} style={{ color: '#6366F1', flexShrink: 0 }} />
                    )}
                  </button>
                )
              })}
              {/* Add Column button */}
              {canEditOrgSettings && (
                <button
                  onClick={() => setShowAddColumnModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-black/5"
                  style={{
                    color: org?.plan === 'pro' ? '#94A3B8' : '#D1D5DB',
                    border: '2px dashed rgba(0,0,0,0.1)',
                    fontFamily: typography.fontFamily,
                  }}
                  title={org?.plan === 'pro' ? 'Add new column' : 'PRO feature — Upgrade to add columns'}
                >
                  <span>+</span>
                  <span>Add Column</span>
                  {org?.plan !== 'pro' && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#D97706' }}>PRO</span>}
                </button>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />

            {/* Filters section */}
            <div className="flex flex-col gap-3">
              <div
                className="text-[10px] font-bold uppercase tracking-wider px-2"
                style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
              >
                Filters
              </div>

              {/* Priority filter */}
              <div className="px-2">
                <div
                  className="text-[11px] font-semibold mb-2"
                  style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                >
                  Priority
                </div>
                <div className="flex flex-col gap-1">
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
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all hover:bg-black/5"
                        style={{
                          color: isSelected ? priority.color : '#64748B',
                          background: isSelected ? `${priority.color}10` : 'transparent',
                          fontFamily: typography.fontFamily,
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        <priority.icon size={12} style={{ color: priority.color }} />
                        <span className="flex-1 text-left">{priority.label}</span>
                        {isSelected && <Check size={12} style={{ color: priority.color }} />}
                      </button>
                    )
                  })}
                  {selectedPriorities.length > 0 && (
                    <button
                      onClick={() => updateSearchParam('priority', '')}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-[10px] transition-all hover:bg-black/5"
                      style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
                    >
                      <X size={10} />
                      Clear priority
                    </button>
                  )}
                </div>
              </div>

              {/* Labels filter */}
                <div className="px-2">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                    >
                      Labels
                    </span>
                    <button
                      onClick={() => setShowAddLabelModal(true)}
                      className="flex items-center justify-center w-5 h-5 rounded-md transition-all hover:bg-black/5"
                      style={{ color: '#94A3B8' }}
                      title="Add label"
                    >
                      <span className="text-sm leading-none">+</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {(showAllLabels ? allLabels : allLabels.slice(0, 5)).map(label => {
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
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all hover:bg-black/5"
                          style={{
                            color: isSelected ? colors.accent : '#64748B',
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            fontFamily: typography.fontFamily,
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          <Tag size={12} style={{ color: isSelected ? colors.accent : '#94A3B8' }} />
                          <span className="flex-1 text-left truncate">{label}</span>
                          {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                        </button>
                      )
                    })}
                    {allLabels.length > 5 && (
                      <button
                        onClick={() => setShowAllLabels(!showAllLabels)}
                        className="flex items-center gap-2 px-2 py-1 rounded-md text-[10px] transition-all hover:bg-black/5"
                        style={{ color: '#6366F1', fontFamily: typography.fontFamily, fontWeight: 600 }}
                      >
                        {showAllLabels ? 'Show less' : `+${allLabels.length - 5} more`}
                      </button>
                    )}
                    {selectedLabels.length > 0 && (
                      <button
                        onClick={() => updateSearchParam('label', '')}
                        className="flex items-center gap-2 px-2 py-1 rounded-md text-[10px] transition-all hover:bg-black/5"
                        style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
                      >
                        <X size={10} />
                        Clear labels
                      </button>
                    )}
                  </div>
                </div>

              {/* Custom Fields */}
              <>
                <div className="mx-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                <div className="px-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                      >
                        Custom Fields
                      </span>
                      <span
                        className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', boxShadow: '0 1px 3px rgba(245,158,11,0.3)' }}
                      >
                        PRO
                      </span>
                    </div>
                    {canEditOrgSettings && (
                      <button
                        onClick={() => setShowAddFieldModal(true)}
                        className="flex items-center justify-center w-5 h-5 rounded-md transition-all hover:bg-black/5"
                        style={{ color: '#94A3B8' }}
                        title={org?.plan === 'pro' ? 'Add custom field' : 'PRO feature'}
                      >
                        <span className="text-sm leading-none">+</span>
                      </button>
                    )}
                  </div>
                  {fieldDefs.filter(f => f.is_active).length > 0 && (
                    <div className="flex flex-col gap-1">
                      {(showAllFields ? fieldDefs.filter(f => f.is_active) : fieldDefs.filter(f => f.is_active).slice(0, 5)).map(field => (
                        <div
                          key={field.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                          style={{
                            color: '#64748B',
                            fontFamily: typography.fontFamily,
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#94A3B8' }} />
                          <span className="flex-1 truncate">{field.name}</span>
                          <span className="text-[10px]" style={{ color: '#94A3B8' }}>{field.field_type}</span>
                        </div>
                      ))}
                      {fieldDefs.filter(f => f.is_active).length > 5 && (
                        <button
                          onClick={() => setShowAllFields(!showAllFields)}
                          className="flex items-center gap-2 px-2 py-1 rounded-md text-[10px] transition-all hover:bg-black/5"
                          style={{ color: '#6366F1', fontFamily: typography.fontFamily, fontWeight: 600 }}
                        >
                          {showAllFields ? 'Show less' : `+${fieldDefs.filter(f => f.is_active).length - 5} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>

              {/* Divider */}
              <div className="mx-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />

              {/* Export */}
              <button
                onClick={() => {
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
                className="flex items-center gap-2 px-4 py-2 rounded-md text-xs transition-all hover:bg-black/5"
                style={{
                  color: '#64748B',
                  fontFamily: typography.fontFamily,
                }}
              >
                <Download size={12} />
                Export Tasks
              </button>
            </div>
          </div>
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
      </DndContext>

      {/* Task Detail Modal - Used for viewing/editing */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          employees={employees}
          taskLists={allActiveLists}
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
          taskLists={allActiveLists}
          getEmployeeWorkload={getEmployeeWorkload}
          onClose={() => {
            navigate({ search: (prev) => { const { create, ...rest } = prev; return rest; }, replace: false })
            setNewTaskTitle('')
            setNewTaskAssignee('')
          }}
        />
      )}

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowAddColumnModal(false); setNewColumnName('') }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm mx-4"
            style={{
              background: moduleBackgrounds.tasks,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
            >
              Add Column
            </h3>
            {org?.plan !== 'pro' ? (
              <div className="mt-4">
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4"
                  style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}
                >
                  <Zap size={16} style={{ color: '#D97706' }} />
                  <span className="text-xs font-medium" style={{ color: '#92400E', fontFamily: typography.fontFamily }}>
                    Custom columns are a PRO feature. Upgrade your plan to add more columns.
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddColumnModal(false); setNewColumnName('') }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                    style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => window.location.href = 'mailto:my@workived.com?subject=Upgrade%20to%20Pro%20Request'}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: '#F59E0B', color: 'white', fontFamily: typography.fontFamily }}
                  >
                    Upgrade to PRO
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                  Add a new status column to your task board.
                </p>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newColumnName.trim()) {
                      createListMutation.mutate({ name: newColumnName.trim() }, {
                        onSuccess: () => {
                          setShowAddColumnModal(false)
                          setNewColumnName('')
                        }
                      })
                    } else if (e.key === 'Escape') {
                      setShowAddColumnModal(false)
                      setNewColumnName('')
                    }
                  }}
                  placeholder="e.g. In Review, QA Testing..."
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg text-sm mb-4 outline-none"
                  style={{
                    background: '#F4F5F7',
                    border: '1px solid #DFE1E6',
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddColumnModal(false); setNewColumnName('') }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                    style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newColumnName.trim()) {
                        createListMutation.mutate({ name: newColumnName.trim() }, {
                          onSuccess: () => {
                            setShowAddColumnModal(false)
                            setNewColumnName('')
                          }
                        })
                      }
                    }}
                    disabled={!newColumnName.trim() || createListMutation.isPending}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: '#6366F1', color: 'white', fontFamily: typography.fontFamily }}
                  >
                    {createListMutation.isPending ? 'Creating...' : 'Create Column'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Custom Field Modal */}
      {showAddFieldModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowAddFieldModal(false); setNewFieldName(''); setNewFieldType('text'); setNewFieldOptions([]); setNewFieldOptionInput('') }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm mx-4"
            style={{
              background: moduleBackgrounds.tasks,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
            >
              Add Custom Field
            </h3>
            {org?.plan !== 'pro' ? (
              <div className="mt-4">
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4"
                  style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}
                >
                  <Zap size={16} style={{ color: '#D97706' }} />
                  <span className="text-xs font-medium" style={{ color: '#92400E', fontFamily: typography.fontFamily }}>
                    Custom fields are a PRO feature. Upgrade your plan to add custom fields.
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddFieldModal(false); setNewFieldName(''); setNewFieldType('text'); setNewFieldOptions([]); setNewFieldOptionInput('') }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                    style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => window.location.href = 'mailto:my@workived.com?subject=Upgrade%20to%20Pro%20Request'}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: '#F59E0B', color: 'white', fontFamily: typography.fontFamily }}
                  >
                    Upgrade to PRO
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                  Add a custom field to track additional information on tasks.
                </p>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFieldName.trim()) {
                      createFieldMutation.mutate({
                        name: newFieldName.trim(),
                        field_type: newFieldType,
                        ...(((newFieldType === 'select' || newFieldType === 'multi_select') && newFieldOptions.length > 0) ? {
                          options: newFieldOptions.map(o => ({ value: o.toLowerCase().replace(/\s+/g, '_'), label: o }))
                        } : {}),
                      }, {
                        onSuccess: () => {
                          setShowAddFieldModal(false)
                          setNewFieldName('')
                          setNewFieldType('text')
                          setNewFieldOptions([])
                          setNewFieldOptionInput('')
                        }
                      })
                    } else if (e.key === 'Escape') {
                      setShowAddFieldModal(false)
                      setNewFieldName('')
                      setNewFieldType('text')
                      setNewFieldOptions([])
                      setNewFieldOptionInput('')
                    }
                  }}
                  placeholder="e.g. Due Date, Priority Score..."
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg text-sm mb-3 outline-none"
                  style={{
                    background: '#F4F5F7',
                    border: '1px solid #DFE1E6',
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                />
                <div className="mb-4">
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>Field Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'url', 'rating'] as FieldType[]).map(ft => (
                      <button
                        key={ft}
                        onClick={() => setNewFieldType(ft)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                        style={{
                          background: newFieldType === ft ? 'rgba(99, 102, 241, 0.12)' : '#F4F5F7',
                          color: newFieldType === ft ? '#6366F1' : '#64748B',
                          border: newFieldType === ft ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #DFE1E6',
                          fontFamily: typography.fontFamily,
                        }}
                      >
                        {ft.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Options list for select/multi_select */}
                {(newFieldType === 'select' || newFieldType === 'multi_select') && (
                  <div className="mb-4">
                    <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>Options</label>
                    <div className="flex flex-col gap-1.5">
                      {newFieldOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'rgba(0,0,0,0.04)', color: '#2C3E50', fontFamily: typography.fontFamily }}
                          >
                            {opt}
                          </div>
                          <button
                            onClick={() => setNewFieldOptions(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded hover:bg-black/5 transition-all"
                            style={{ color: '#94A3B8' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newFieldOptionInput}
                          onChange={(e) => setNewFieldOptionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newFieldOptionInput.trim()) {
                              e.preventDefault()
                              e.stopPropagation()
                              setNewFieldOptions(prev => [...prev, newFieldOptionInput.trim()])
                              setNewFieldOptionInput('')
                            }
                          }}
                          placeholder="Type option and press Enter"
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                          style={{
                            background: 'rgba(0,0,0,0.04)',
                            border: '1px solid #DFE1E6',
                            color: '#2C3E50',
                            fontFamily: typography.fontFamily,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddFieldModal(false); setNewFieldName(''); setNewFieldType('text'); setNewFieldOptions([]); setNewFieldOptionInput('') }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                    style={{ color: '#64748B', fontFamily: typography.fontFamily }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newFieldName.trim()) {
                        createFieldMutation.mutate({
                          name: newFieldName.trim(),
                          field_type: newFieldType,
                          ...(((newFieldType === 'select' || newFieldType === 'multi_select') && newFieldOptions.length > 0) ? {
                            options: newFieldOptions.map(o => ({ value: o.toLowerCase().replace(/\s+/g, '_'), label: o }))
                          } : {}),
                        }, {
                          onSuccess: () => {
                            setShowAddFieldModal(false)
                            setNewFieldName('')
                            setNewFieldType('text')
                            setNewFieldOptions([])
                            setNewFieldOptionInput('')
                          }
                        })
                      }
                    }}
                    disabled={!newFieldName.trim() || createFieldMutation.isPending}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: '#6366F1', color: 'white', fontFamily: typography.fontFamily }}
                  >
                    {createFieldMutation.isPending ? 'Creating...' : 'Create Field'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Label Modal */}
      {showAddLabelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowAddLabelModal(false); setNewLabelName('') }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm mx-4"
            style={{
              background: moduleBackgrounds.tasks,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
            >
              Add Label
            </h3>
            <p className="text-xs mb-4" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
              Type a label name to filter tasks by.
            </p>
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabelName.trim()) {
                  const label = newLabelName.trim()
                  const newLabels = selectedLabels.includes(label)
                    ? selectedLabels
                    : [...selectedLabels, label]
                  updateSearchParam('label', newLabels.join(','))
                  setShowAddLabelModal(false)
                  setNewLabelName('')
                } else if (e.key === 'Escape') {
                  setShowAddLabelModal(false)
                  setNewLabelName('')
                }
              }}
              placeholder="e.g. Bug, Feature, Urgent..."
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg text-sm mb-4 outline-none"
              style={{
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid #DFE1E6',
                color: '#2C3E50',
                fontFamily: typography.fontFamily,
              }}
            />
            {/* Existing labels to quickly select */}
            {allLabels.length > 0 && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>Existing Labels</label>
                <div className="flex flex-wrap gap-1.5">
                  {allLabels.filter(l => !selectedLabels.includes(l)).slice(0, 10).map(label => (
                    <button
                      key={label}
                      onClick={() => {
                        const newLabels = [...selectedLabels, label]
                        updateSearchParam('label', newLabels.join(','))
                        setShowAddLabelModal(false)
                        setNewLabelName('')
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-black/5"
                      style={{
                        background: 'rgba(0,0,0,0.04)',
                        color: '#64748B',
                        border: '1px solid #DFE1E6',
                        fontFamily: typography.fontFamily,
                      }}
                    >
                      <Tag size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAddLabelModal(false); setNewLabelName('') }}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                style={{ color: '#64748B', fontFamily: typography.fontFamily }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newLabelName.trim()) {
                    const label = newLabelName.trim()
                    const newLabels = selectedLabels.includes(label)
                      ? selectedLabels
                      : [...selectedLabels, label]
                    updateSearchParam('label', newLabels.join(','))
                    setShowAddLabelModal(false)
                    setNewLabelName('')
                  }
                }}
                disabled={!newLabelName.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: '#6366F1', color: 'white', fontFamily: typography.fontFamily }}
              >
                Add to Filter
              </button>
            </div>
          </div>
        </div>
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
  onCollapse,
  canCollapse,
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
  onCollapse?: () => void
  canCollapse?: boolean
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
      className="flex flex-col min-h-[500px]"
      style={{
        background: 'transparent',
        borderRadius: '0',
        border: 'none',
        minHeight: '600px',
        transition: 'all 0.3s ease-in-out',
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
          <div className="flex items-center gap-1">
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
            {/* Collapse column button */}
            {canCollapse && onCollapse && (
              <button
                onClick={onCollapse}
                className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-black/10"
                style={{
                  color: '#94A3B8',
                  background: 'rgba(0,0,0,0.02)',
                }}
                title="Collapse column"
              >
                <ChevronLeft size={14} />
              </button>
            )}
          </div>
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

// ── Collapsed Column (droppable) ────────────────────────────────

function CollapsedColumn({
  col,
  taskCount,
  idx,
  onExpand,
}: {
  col: { id: string; name: string }
  taskCount: number
  idx: number
  onExpand: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      ref={setNodeRef}
      key={col.id}
      className="flex-shrink-0 hidden sm:flex flex-col items-center cursor-pointer hover:opacity-80 group"
      onClick={onExpand}
      style={{
        width: '44px',
        minHeight: '600px',
        background: isOver ? 'rgba(99, 102, 241, 0.12)' : 'rgba(0,0,0,0.03)',
        borderRadius: '12px',
        marginLeft: idx > 0 ? '4px' : '0',
        marginRight: '4px',
        border: isOver ? '2px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(0,0,0,0.06)',
        position: 'relative',
        animation: 'collapsePopIn 0.35s ease-out forwards',
        transformOrigin: 'center top',
      }}
      title={`${col.name} — ${taskCount} tasks (click to expand)`}
    >
      {/* Task count badge */}
      <div
        className="flex items-center justify-center rounded-full mt-3 mb-2 text-xs font-bold"
        style={{
          width: '24px',
          height: '24px',
          background: taskCount > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.06)',
          color: taskCount > 0 ? '#6366F1' : '#94A3B8',
          fontFamily: typography.fontFamily,
        }}
      >
        {taskCount}
      </div>
      {/* Vertical label */}
      <div
        className="text-xs font-bold uppercase tracking-wider"
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          color: '#64748B',
          fontFamily: typography.fontFamily,
          letterSpacing: '1.5px',
          padding: '8px 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxHeight: '200px',
        }}
      >
        {col.name}
      </div>
    </div>
  )
}

// ── Collapsed Column Horizontal (for right sidebar, droppable) ──

function CollapsedColumnHorizontal({
  col,
  taskCount,
  onExpand,
}: {
  col: { id: string; name: string }
  taskCount: number
  onExpand: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-black/5"
      onClick={onExpand}
      style={{
        background: isOver ? 'rgba(99, 102, 241, 0.12)' : 'rgba(0,0,0,0.03)',
        border: isOver ? '2px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(0,0,0,0.06)',
        transition: 'background 200ms, border 200ms',
      }}
      title={`${col.name} — ${taskCount} tasks (click to expand)`}
    >
      <div
        className="flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
        style={{
          width: '20px',
          height: '20px',
          background: taskCount > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.06)',
          color: taskCount > 0 ? '#6366F1' : '#94A3B8',
          fontFamily: typography.fontFamily,
        }}
      >
        {taskCount}
      </div>
      <span
        className="text-xs font-semibold truncate flex-1"
        style={{
          color: '#2C3E50',
          fontFamily: typography.fontFamily,
        }}
      >
        {col.name}
      </span>
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

