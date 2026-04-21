import { useState } from 'react'
import { Link2, Ban, ShieldAlert, RefreshCw, Copy, Files, ArrowRight, ArrowLeft, Plus, X, CheckCircle2, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { typography, colors } from '@/design/tokens'
import { Dropdown } from './workived/shared/Dropdown'
import { useTaskLinks, useCreateTaskLink, useDeleteTaskLink, tasksKeys } from '@/lib/hooks/useTasks'
import { tasksApi } from '@/lib/api/tasks'
import type { TaskLinkType, TaskWithDetails } from '@/types/api'

interface TaskLinksSectionProps {
  task: TaskWithDetails
  onTaskNavigate?: (taskId: string) => void
}

const LINK_TYPE_CONFIG: Record<TaskLinkType, { label: string; icon: React.ReactNode }> = {
  blocks: { label: 'Blocks', icon: <Ban size={14} /> },
  blocked_by: { label: 'Blocked by', icon: <ShieldAlert size={14} /> },
  related_to: { label: 'Related to', icon: <RefreshCw size={14} /> },
  duplicates: { label: 'Duplicates', icon: <Copy size={14} /> },
  duplicate_of: { label: 'Duplicate of', icon: <Files size={14} /> },
  follows: { label: 'Follows', icon: <ArrowRight size={14} /> },
  precedes: { label: 'Precedes', icon: <ArrowLeft size={14} /> },
}

export function TaskLinksSection({ task, onTaskNavigate }: TaskLinksSectionProps) {
  const [showAddLink, setShowAddLink] = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<TaskLinkType>('related_to')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')

  const { data: linksData } = useTaskLinks(task.id)
  const createLinkMutation = useCreateTaskLink()
  const deleteLinkMutation = useDeleteTaskLink()
  
  // Search for tasks by title - only search when query has 2+ characters
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: tasksKeys.taskList({ search: searchQuery, limit: 20 }),
    queryFn: () => tasksApi.listTasks({ search: searchQuery, limit: 20 }).then((r) => r.data.data || []),
    enabled: searchQuery.length >= 2,
    staleTime: 60 * 1000,
  })

  const links = linksData || []
  const filteredResults = searchQuery.length >= 2 
    ? (searchResults || []).filter(t => t.id !== task.id)
    : []

  const handleAddLink = () => {
    if (!selectedTaskId.trim()) return

    createLinkMutation.mutate(
      {
        taskId: task.id,
        data: {
          target_task_id: selectedTaskId,
          link_type: selectedLinkType,
        },
      },
      {
        onSuccess: () => {
          setSelectedTaskId('')
          setSearchQuery('')
          setShowAddLink(false)
        },
      }
    )
  }

  const handleDeleteLink = (linkId: string) => {
    if (!confirm('Remove this link?')) return

    deleteLinkMutation.mutate({
      taskId: task.id,
      linkId,
    })
  }

  // Group links by type
  const groupedLinks = links.reduce((acc, link) => {
    if (!acc[link.link_type]) {
      acc[link.link_type] = []
    }
    acc[link.link_type].push(link)
    return acc
  }, {} as Record<TaskLinkType, typeof links>)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-base font-bold flex items-center gap-2"
          style={{ color: colors.ink900, fontFamily: typography.fontFamily }}
        >
          <Link2 size={18} />
          Task Links
        </h3>
        <button
          onClick={() => setShowAddLink(!showAddLink)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 flex items-center gap-1.5"
          style={{
            background: `${colors.ink900}10`,
            color: colors.ink900,
            fontFamily: typography.fontFamily,
          }}
        >
          {showAddLink ? <X size={16} /> : <Plus size={16} />}
          {showAddLink ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {/* Add Link Form */}
      {showAddLink && (
        <div
          className="p-4 rounded-lg mb-4"
          style={{ background: `${colors.ink900}05`, border: `1px solid ${colors.ink900}15` }}
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: colors.ink500 }}
              >
                Link Type
              </label>
              <Dropdown
                value={selectedLinkType}
                onChange={(value) => setSelectedLinkType(value as TaskLinkType)}
                options={Object.entries(LINK_TYPE_CONFIG).map(([type, { label }]) => ({
                  value: type,
                  label: label,
                }))}
                fullWidth
                style={{
                  background: colors.ink0,
                  color: colors.ink900,
                  border: `1px solid ${colors.ink150}`,
                  fontFamily: typography.fontFamily,
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: colors.ink500 }}
              >
                Search Task
              </label>
              <div className="relative">
                <Search 
                  size={16} 
                  className="absolute left-3 top-1/2 -translate-y-1/2" 
                  style={{ color: colors.ink500 }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by task name..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg text-sm"
                  style={{
                    background: colors.ink0,
                    color: colors.ink900,
                    border: `1px solid ${colors.ink150}`,
                    fontFamily: typography.fontFamily,
                  }}
                />
              </div>
              
              {/* Search Results Dropdown */}
              {searchQuery.length > 0 && (
                <div
                  className="mt-2 max-h-60 overflow-y-auto rounded-lg border"
                  style={{
                    background: colors.ink0,
                    borderColor: colors.ink150,
                  }}
                >
                  {searchQuery.length < 2 ? (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: colors.ink500 }}>
                      Type at least 2 characters to search...
                    </div>
                  ) : isSearching ? (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: colors.ink500 }}>
                      Searching...
                    </div>
                  ) : filteredResults.length > 0 ? (
                    filteredResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          createLinkMutation.mutate(
                            {
                              taskId: task.id,
                              data: {
                                target_task_id: result.id,
                                link_type: selectedLinkType,
                              },
                            },
                            {
                              onSuccess: () => {
                                setSelectedTaskId('')
                                setSearchQuery('')
                                setShowAddLink(false)
                              },
                            }
                          )
                        }}
                        disabled={createLinkMutation.isPending}
                        className="w-full text-left px-3 py-2 hover:bg-opacity-50 transition-colors border-b last:border-b-0 disabled:opacity-50"
                        style={{
                          background: selectedTaskId === result.id ? `${colors.ink900}10` : 'transparent',
                          borderColor: colors.ink100,
                        }}
                      >
                        <div
                          className="font-semibold text-sm mb-1"
                          style={{ color: colors.ink900 }}
                        >
                          {result.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: colors.ink500 }}>
                          <span
                            className="px-1.5 py-0.5 rounded uppercase font-bold"
                            style={{
                              background: colors.ink100,
                              fontSize: '10px',
                            }}
                          >
                            {result.priority}
                          </span>
                          {result.list_name && (
                            <>
                              <span>•</span>
                              <span>{result.list_name}</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: colors.ink500 }}>
                      No tasks found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Links List */}
      {links.length > 0 ? (
        <div className="space-y-2">
          {Object.entries(groupedLinks).map(([linkType, typeLinks]) => {
            const { label, icon } = LINK_TYPE_CONFIG[linkType as TaskLinkType]
            return (
              <div key={linkType}>
                <div
                  className="text-xs font-semibold mb-2 flex items-center gap-1.5"
                  style={{ color: colors.ink500 }}
                >
                  {icon} {label}
                </div>
                {typeLinks.map((link) => (
                  <div
                    key={link.id}
                    onClick={() => onTaskNavigate?.(link.target_task_id)}
                    className="flex items-center justify-between p-3 rounded-lg group hover:shadow-sm transition-all cursor-pointer"
                    style={{
                      background: `${colors.ink900}05`,
                      border: `1px solid ${colors.ink900}10`,
                    }}
                  >
                    <div className="flex-1">
                      <div
                        className="font-semibold mb-1"
                        style={{ color: colors.ink900, fontSize: '14px' }}
                      >
                        {link.target_task.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: colors.ink500 }}>
                        <span
                          className="px-2 py-0.5 rounded uppercase font-bold"
                          style={{
                            background: `${colors.ink900}10`,
                            fontSize: '10px',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {link.target_task.priority}
                        </span>
                        <span>•</span>
                        <span>{link.target_task.list_name}</span>
                        {link.target_task.completed_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              Completed
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-sm p-2"
                      style={{ color: '#EF4444' }}
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="text-center py-8 text-sm"
          style={{ color: colors.ink500 }}
        >
          No links yet. Create one to connect related tasks.
        </div>
      )}
    </div>
  )
}
