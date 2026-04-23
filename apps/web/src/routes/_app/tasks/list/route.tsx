import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import { Settings, Check, Zap, Flame, Plane, Star, List, Search, X } from 'lucide-react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { AllIssuesTable } from '@/components/tasks/AllIssuesTable'
import { Dropdown, type DropdownOption } from '@/components/workived/shared/Dropdown'
import { moduleBackgrounds, typography, colors } from '@/design/tokens'
import { apiClient } from '@/lib/api/client'
import { useEmployees, useEmployeeWorkload } from '@/lib/hooks/useEmployees'
import { useMemo, useCallback, useState, useEffect } from 'react'
import type { TaskWithDetails, EmployeeWorkload } from '@/types/api'
import { useTasks, useTaskLists, useFieldDefinitions } from '@/lib/hooks/useTasks'
import { useCanEditOrgSettings } from '@/lib/hooks/useRole'

// URL search params for task modal
type TasksListSearch = {
  task?: string // Active task ID (for shareable URLs)
}

export const Route = createFileRoute('/_app/tasks/list')({
  validateSearch: (search: Record<string, unknown>): TasksListSearch => {
    return {
      task: typeof search.task === 'string' ? search.task : undefined,
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
  component: TasksListPage,
})

function TasksListPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const searchParams = Route.useSearch()
  const { data: org } = useOrganisation()
  
  // Fetch employees for table display
  const employeeQueryOptions = useMemo(() => ({ status: 'active' as const, limit: 100 }), [])
  const { data: employeesData } = useEmployees(employeeQueryOptions)
  const employees = employeesData?.data || []
  
  // Fetch task lists for modal
  const { data: taskLists = [] } = useTaskLists()
  
  // Fetch workload data for modal
  const { data: workloadData = [] } = useEmployeeWorkload()
  
  // Fetch all tasks for modal (AllIssuesTable fetches its own data internally)
  const { data: tasks = [] } = useTasks({ include_completed: true })
  
  // Helper: Get workload for an employee
  const getEmployeeWorkload = useCallback((employeeId: string): EmployeeWorkload | undefined => {
    return workloadData.find((w) => w.employee_id === employeeId)
  }, [workloadData])
  
  // Permissions
  const canEditOrgSettings = useCanEditOrgSettings()
  
  // Workload dropdown state
  const [expandedWorkloadStatus, setExpandedWorkloadStatus] = useState<string | null>(null)
  
  // Filter state for table
  const [searchQuery, setSearchQuery] = useState('')
  const [taskListFilter, setTaskListFilter] = useState<string[]>([])  // Multi-select task lists
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])  // Multi-select assignees
  const [priorityFilter, setPriorityFilter] = useState('')
  
  // Column picker state
  const { data: fieldDefs = [] } = useFieldDefinitions()
  const activeFields = fieldDefs.filter((fd) => fd.is_active)
  const DEFAULT_CUSTOM_COLUMNS = 2
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string> | null>(null)
  
  const toggleFieldColumn = (fdId: string) => {
    setVisibleFieldIds((prev) => {
      const base = prev ?? new Set(activeFields.slice(0, DEFAULT_CUSTOM_COLUMNS).map((f) => f.id))
      const next = new Set(base)
      if (next.has(fdId)) next.delete(fdId)
      else next.add(fdId)
      return next
    })
  }
  
  // Close workload dropdown when clicking outside
  useEffect(() => {
    if (!expandedWorkloadStatus) return
    
    const handleClickOutside = () => setExpandedWorkloadStatus(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [expandedWorkloadStatus])
  
  // Task modal state from URL query params
  const taskParam = searchParams.task
  
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

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.tasks, paddingBottom: '160px' }}
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

        {/* Navigation Bar with Table Filters - All in one row */}
        <div 
          className="mb-6 -mx-6 px-6 md:-mx-11 md:px-11 py-4"
          style={{
            background: 'transparent',
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Board view tabs (All / Tasks / Approvals) */}
            <div className="flex items-center gap-1.5 rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
              <Link
                to="/tasks"
                search={{ showCompleted: true }}
                className="px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={{
                  background: 'transparent',
                  color: '#64748B',
                  boxShadow: 'none',
                  fontFamily: typography.fontFamily,
                  textDecoration: 'none',
                }}
              >
                All
              </Link>
              <Link
                to="/tasks"
                search={{ view: 'tasks', showCompleted: true }}
                className="px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={{
                  background: 'transparent',
                  color: '#64748B',
                  boxShadow: 'none',
                  fontFamily: typography.fontFamily,
                  textDecoration: 'none',
                }}
              >
                Tasks
              </Link>
              <Link
                to="/tasks"
                search={{ view: 'approvals', showCompleted: true }}
                className="px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={{
                  background: 'transparent',
                  color: '#64748B',
                  boxShadow: 'none',
                  fontFamily: typography.fontFamily,
                  textDecoration: 'none',
                }}
              >
                Approvals
              </Link>
            </div>

            {/* Divider */}
            <div className="w-px h-6 self-center" style={{ background: 'rgba(0,0,0,0.12)' }} />

            {/* All Issues — active state */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold"
              style={{
                background: '#2C3E50',
                color: 'white',
                fontFamily: typography.fontFamily,
              }}
            >
              <List size={14} />
              All Tasks
            </div>

            {/* Divider before filters */}
            <div className="w-px h-6 self-center" style={{ background: 'rgba(0,0,0,0.12)' }} />

            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-[500px]">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(0,0,0,0.12)',
                }}
              >
                <Search size={14} style={{ color: '#64748B' }} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="flex-1 bg-transparent border-none outline-none text-xs"
                  style={{
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="flex items-center justify-center rounded transition-opacity hover:opacity-70"
                    style={{ color: '#64748B' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <Dropdown
              value={taskListFilter}
              onChange={(val) => setTaskListFilter(val as string[])}
              options={taskLists.map((list) => ({
                value: list.id,
                label: list.name,
              }))}
              placeholder="All statuses"
              multiple={true}
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.12)',
                fontSize: '12px',
                minWidth: '140px',
                maxWidth: '280px',
              }}
            />

            {/* Assignee */}
            <Dropdown
              value={assigneeFilter}
              onChange={(val) => setAssigneeFilter(val as string[])}
              options={employees.map((e) => ({
                value: e.id,
                label: e.full_name,
              }))}
              placeholder="All assignees"
              multiple={true}
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.12)',
                fontSize: '12px',
                minWidth: '140px',
                maxWidth: '320px',
              }}
            />

            {/* Priority */}
            <Dropdown
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val as string)}
              options={[
                { value: '', label: 'All priorities' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              placeholder="All priorities"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.12)',
                fontSize: '12px',
                minWidth: '140px',
                maxWidth: '240px',
              }}
            />

            {/* Column picker — only shown when custom fields exist */}
            {activeFields.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowColumnPicker((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    background: showColumnPicker ? '#2C3E50' : 'rgba(0,0,0,0.06)',
                    color: showColumnPicker ? 'white' : '#64748B',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  <span>⊞</span> Columns
                  {visibleFieldIds !== null && visibleFieldIds.size !== DEFAULT_CUSTOM_COLUMNS && (
                    <span className="ml-1 px-1 rounded text-xs" style={{ background: '#C97B2A', color: 'white' }}>
                      {visibleFieldIds.size}
                    </span>
                  )}
                </button>

                {showColumnPicker && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-xl p-3 min-w-[200px]"
                    style={{ background: 'white', border: '1px solid #E2E8F0' }}
                  >
                    <p className="text-xs font-bold mb-2" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>
                      Custom field columns
                    </p>
                    {activeFields.map((fd) => {
                      const checked = visibleFieldIds === null
                        ? activeFields.indexOf(fd) < DEFAULT_CUSTOM_COLUMNS
                        : visibleFieldIds.has(fd.id)
                      return (
                        <label key={fd.id} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFieldColumn(fd.id)}
                            className="w-3.5 h-3.5 accent-amber-500"
                          />
                          <span className="text-xs font-medium" style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}>
                            {fd.name}
                          </span>
                          <span className="text-xs opacity-50 ml-auto" style={{ fontFamily: typography.fontFamily }}>
                            {fd.field_type}
                          </span>
                        </label>
                      )
                    })}
                    <button
                      onClick={() => setVisibleFieldIds(null)}
                      className="mt-2 w-full text-xs py-1 rounded-md transition-colors"
                      style={{ background: '#F1F5F9', color: '#64748B', fontFamily: typography.fontFamily }}
                    >
                      Reset to default
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Table View (filters hidden since we render them above) */}
        <div className="flex-1 min-h-0 px-1 pb-6">
          <AllIssuesTable
            employees={employees}
            taskLists={taskLists}
            onTaskClick={(task) => navigate({ search: (prev) => ({ ...prev, task: task.code || task.id }), replace: false })}
            hideFilters={true}
            externalFilters={{
              search: searchQuery,
              task_list_id: taskListFilter.join(','),  // Convert array to comma-separated string
              status: '',  // Not using completion status filter in this view
              assignee_id: assigneeFilter.join(','),  // Convert array to comma-separated string
              priority: priorityFilter,
            }}
          />
        </div>

        {/* Task Detail Modal */}
        {selectedTaskId && (
          <TaskDetailModal
            taskId={selectedTaskId}
            employees={employees}
            taskLists={taskLists}
            getEmployeeWorkload={getEmployeeWorkload}
            onClose={() => navigate({ search: (prev) => ({ ...prev, task: undefined }), replace: false })}
          />
        )}
      </div>
    </div>
  )
}
