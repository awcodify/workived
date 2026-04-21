import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, Type, Hash, Calendar, CheckSquare, ChevronDown, Link as LinkIcon, User, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import type { DropdownOption } from '@/components/workived/shared/Dropdown'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { colors, typography, moduleBackgrounds, radius, spacing } from '@/design/tokens'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { 
  useTaskLists, 
  useCreateTaskList, 
  useUpdateTaskList, 
  useDeleteTaskList, 
  useReorderTaskLists,
  useFieldDefinitions,
  useCreateFieldDefinition,
  useUpdateFieldDefinition,
  useDeactivateFieldDefinition,
} from '@/lib/hooks/useTasks'
import { useCanEditOrgSettings } from '@/lib/hooks/useRole'
import { extractApiError } from '@/lib/utils/errors'
import type { TaskList, FieldDefinition, FieldType, CreateFieldDefinitionInput, UpdateFieldDefinitionInput } from '@/types/api'

export const Route = createFileRoute('/_app/tasks/settings')({
  component: TaskBoardSettingsPage,
})

// ── Page palette (matching tasks page design) ──────────────────────────────

const pageBg = moduleBackgrounds.tasks  // '#F5F5F0' - warm paper beige
const surfaceBg = '#FFFFFF'
const cardBg = '#FFFFFF'
const text = '#2C3E50'
const textSec = '#7F8C8D'
const textDim = '#A0AEC0'
const border = '#E8ECF0'
const inputBg = '#FFFFFF'
const inputBdr = '#DFE1E6'

const C = {
  err: colors.err,
  errText: colors.errText,
  ok: colors.ok,
  accent: colors.accent,
  warn: colors.warn,
}

// ── Custom Fields Constants ─────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: LucideIcon }[] = [
  { value: 'text',         label: 'Text',         icon: Type },
  { value: 'number',       label: 'Number',       icon: Hash },
  { value: 'date',         label: 'Date',         icon: Calendar },
  { value: 'boolean',      label: 'Yes/No',       icon: CheckSquare },
  { value: 'select',       label: 'Select',       icon: ChevronDown },
  { value: 'multi_select', label: 'Multi-select', icon: ChevronDown },
  { value: 'url',          label: 'URL',          icon: LinkIcon },
  { value: 'employee',     label: 'Employee',     icon: User },
  { value: 'rating',       label: 'Rating',       icon: Star },
]

const TYPES_NEEDING_OPTIONS: FieldType[] = ['select', 'multi_select']

// ── Sortable List Item ──────────────────────────────────────────────────────

function SortableListItem({ list, onUpdate, onDelete, disabled }: {
  list: TaskList
  onUpdate: (id: string, updates: { name?: string; is_final_state?: boolean }) => void
  onDelete: (id: string) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: list.id })
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(list.name)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    if (editedName.trim() && editedName !== list.name) {
      onUpdate(list.id, { name: editedName.trim() })
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedName(list.name)
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: cardBg,
        borderRadius: radius.lg,
        border: `1px solid ${border}`,
        padding: spacing[4],
        marginBottom: spacing[3],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'default',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
      data-testid={`task-list-item-${list.id}`}
      className="transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="cursor-grab active:cursor-grabbing disabled:cursor-not-allowed hover:text-gray-700 transition-colors"
          style={{ color: textDim, fontSize: '18px', flexShrink: 0 }}
          data-testid={`task-list-drag-handle-${list.id}`}
        >
          ⠿
        </button>

        {/* List name */}
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              style={{
                background: inputBg,
                border: `1px solid ${inputBdr}`,
                color: text,
                borderRadius: radius.md,
                padding: '6px 10px',
                width: '100%',
                fontSize: typography.body.size,
                fontFamily: typography.fontFamily,
              }}
              data-testid={`task-list-name-input-${list.id}`}
            />
          ) : (
            <button
              onClick={() => !disabled && setIsEditing(true)}
              disabled={disabled}
              style={{
                color: text,
                fontSize: typography.body.size,
                fontWeight: 500,
                background: 'none',
                border: 'none',
                padding: '6px 10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
              className="hover:bg-gray-50 rounded transition-colors disabled:hover:bg-transparent"
              data-testid={`task-list-name-button-${list.id}`}
            >
              {list.name}
            </button>
          )}
        </div>

        {/* Final state toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={list.is_final_state}
            onChange={(e) => !disabled && onUpdate(list.id, { is_final_state: e.target.checked })}
            disabled={disabled}
            style={{
              accentColor: C.accent,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            data-testid={`task-list-final-state-${list.id}`}
          />
          <span style={{ color: textSec, fontSize: typography.label.size }}>
            Mark complete
          </span>
        </label>

        {/* Delete button */}
        <button
          onClick={() => !disabled && onDelete(list.id)}
          disabled={disabled}
          style={{
            color: C.err,
            fontSize: typography.label.size,
            background: 'none',
            border: 'none',
            padding: '6px 10px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          className="hover:bg-red-50 rounded transition-colors disabled:hover:bg-transparent"
          data-testid={`task-list-delete-button-${list.id}`}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

function TaskBoardSettingsPage() {
  const canEdit = useCanEditOrgSettings()
  const { data: org } = useOrganisation()
  const { data: taskLists = [], isLoading } = useTaskLists()
  const { data: fieldDefinitions = [], isLoading: isLoadingFields } = useFieldDefinitions()
  const createList = useCreateTaskList()
  const updateList = useUpdateTaskList()
  const deleteList = useDeleteTaskList()
  const reorderLists = useReorderTaskLists()
  const createField = useCreateFieldDefinition()
  const updateField = useUpdateFieldDefinition()
  const deleteField = useDeactivateFieldDefinition()

  const [localLists, setLocalLists] = useState<TaskList[]>([])
  const [newListName, setNewListName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Custom field form state
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldDescription, setNewFieldDescription] = useState('')

  // Sync server lists to local state
  useState(() => {
    if (taskLists.length > 0) {
      setLocalLists(taskLists)
    }
  })

  // Update local state when server lists change
  if (taskLists.length > 0 && JSON.stringify(taskLists.map(l => l.id)) !== JSON.stringify(localLists.map(l => l.id))) {
    setLocalLists(taskLists)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setLocalLists((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)

      const reordered = arrayMove(items, oldIndex, newIndex)

      // Persist to server
      reorderLists.mutate(reordered.map(l => l.id), {
        onSuccess: () => {
          setSuccess('Board columns reordered successfully')
          setTimeout(() => setSuccess(null), 3000)
        },
        onError: (err) => {
          setError(extractApiError(err) ?? 'Failed to reorder columns')
          setLocalLists(taskLists) // Revert on error
        },
      })

      return reordered
    })
  }, [reorderLists, taskLists])

  const handleCreateList = () => {
    if (!newListName.trim()) {
      setError('List name cannot be empty')
      return
    }

    createList.mutate(
      { name: newListName.trim() },
      {
        onSuccess: () => {
          setNewListName('')
          setSuccess('Board column created successfully')
          setTimeout(() => setSuccess(null), 3000)
          setError(null)
        },
        onError: (err) => {
          setError(extractApiError(err) ?? 'Failed to create column')
        },
      },
    )
  }

  const handleUpdateList = (id: string, updates: { name?: string; is_final_state?: boolean }) => {
    // Optimistic update for immediate UI feedback
    setLocalLists((items) => 
      items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    )

    updateList.mutate(
      { id, data: updates },
      {
        onSuccess: () => {
          setSuccess('Board column updated successfully')
          setTimeout(() => setSuccess(null), 3000)
        },
        onError: (err) => {
          setError(extractApiError(err) ?? 'Failed to update column')
          // Revert optimistic update on error
          setLocalLists(taskLists)
        },
      },
    )
  }

  const handleDeleteList = (id: string) => {
    if (!confirm('Are you sure you want to delete this column? All tasks in this column will need to be moved.')) {
      return
    }

    deleteList.mutate(id, {
      onSuccess: () => {
        setSuccess('Board column deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
      },
      onError: (err) => {
        setError(extractApiError(err) ?? 'Failed to delete column')
      },
    })
  }

  const handleCreateField = () => {
    if (!newFieldName.trim()) {
      setError('Field name cannot be empty')
      return
    }

    createField.mutate(
      {
        name: newFieldName.trim(),
        field_type: newFieldType,
        description: newFieldDescription.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewFieldName('')
          setNewFieldType('text')
          setNewFieldDescription('')
          setShowFieldForm(false)
          setSuccess('Custom field created successfully')
          setTimeout(() => setSuccess(null), 3000)
          setError(null)
        },
        onError: (err) => {
          setError(extractApiError(err) ?? 'Failed to create field')
        },
      },
    )
  }

  const handleDeleteField = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the field "${name}"? This will remove it from all tasks.`)) {
      return
    }

    deleteField.mutate(id, {
      onSuccess: () => {
        setSuccess('Custom field deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
      },
      onError: (err) => {
        setError(extractApiError(err) ?? 'Failed to delete field')
      },
    })
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div style={{ color: textSec, fontSize: typography.body.size }}>
          You don't have permission to edit organization settings.
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: pageBg, paddingBottom: '160px' }}
    >
      {/* Header — same layout as tasks page */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="font-extrabold"
              style={{
                fontSize: typography.display.size,
                letterSpacing: typography.display.tracking,
                color: text,
                lineHeight: typography.display.lineHeight,
                fontFamily: typography.fontFamily,
              }}
              data-testid="task-board-settings-title"
            >
              Board Settings
            </h1>
            <p
              className="mt-3"
              style={{
                fontSize: 13,
                color: textSec,
                fontFamily: typography.fontFamily,
                fontWeight: 500,
              }}
            >
              {localLists.length} columns · {fieldDefinitions.length} custom fields
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/tasks"
              search={{ showCompleted: true }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/80"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8ECF0',
                color: text,
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: typography.fontFamily,
                textDecoration: 'none',
              }}
              data-testid="back-to-tasks-link"
            >
              <ArrowLeft size={14} />
              <span>Back to Tasks</span>
            </Link>
            <DateTime
              textColor="#2C3E50"
              textMutedColor="#7F8C8D"
              borderColor="#E8ECF0"
            />
            {org?.plan === 'pro' && (
              <div
                className="flex items-center px-3 py-1.5 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: '#FFFFFF', letterSpacing: '0.05em' }}
                >
                  ⭐ PRO
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

      {/* Error/Success Messages */}
      {error && (
        <div
          className="mb-4 rounded-lg px-4 py-3 flex items-center gap-2"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
          data-testid="task-board-error-message"
        >
          <span style={{ color: '#DC2626', fontSize: typography.body.size, fontFamily: typography.fontFamily }}>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
            <Trash2 size={12} style={{ color: '#DC2626' }} />
          </button>
        </div>
      )}

      {success && (
        <div
          className="mb-4 rounded-lg px-4 py-3"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
          data-testid="task-board-success-message"
        >
          <span style={{ color: '#16A34A', fontSize: typography.body.size, fontFamily: typography.fontFamily }}>{success}</span>
        </div>
      )}

      {/* Two-column grid on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left Column: Board Columns ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Section header */}
          <div
            className="rounded-xl"
            style={{
              background: surfaceBg,
              border: `1px solid ${border}`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
              <div>
                <h2 style={{ color: text, fontSize: typography.h2.size, fontWeight: typography.h2.weight, fontFamily: typography.fontFamily }}>
                  Board Columns
                </h2>
                <p style={{ color: textDim, fontSize: typography.label.size, marginTop: '4px' }}>
                  Drag to reorder · Click to rename
                </p>
              </div>
              <span
                className="px-2.5 py-1 rounded-md text-xs font-bold"
                style={{ background: C.accent, color: '#fff' }}
              >
                PRO
              </span>
            </div>

            {/* Add column inline */}
            <div className="px-5 py-3 flex gap-2" style={{ borderBottom: `1px solid ${border}` }}>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                placeholder="New column name…"
                style={{
                  flex: 1,
                  background: inputBg,
                  border: `1px solid ${inputBdr}`,
                  color: text,
                  borderRadius: radius.md,
                  padding: '8px 12px',
                  fontSize: typography.body.size,
                  fontFamily: typography.fontFamily,
                }}
                data-testid="task-board-new-list-input"
              />
              <button
                onClick={handleCreateList}
                disabled={createList.isPending || !newListName.trim()}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: C.accent, color: '#fff' }}
                data-testid="task-board-add-list-button"
              >
                <Plus size={14} />
                {createList.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>

            {/* Column list */}
            <div className="px-5 py-3" data-testid="task-board-lists-container">
              {isLoading ? (
                <div style={{ color: textDim, fontSize: typography.body.size, padding: spacing[6], textAlign: 'center' }}>
                  Loading…
                </div>
              ) : localLists.length === 0 ? (
                <div style={{ color: textDim, fontSize: typography.body.size, padding: spacing[6], textAlign: 'center' }}>
                  No columns yet. Add your first column above.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={localLists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {localLists.map((list) => (
                      <SortableListItem
                        key={list.id}
                        list={list}
                        onUpdate={handleUpdateList}
                        onDelete={handleDeleteList}
                        disabled={updateList.isPending || deleteList.isPending}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="px-5 py-3" style={{ borderTop: `1px solid ${border}`, background: '#F8F9FA', borderRadius: `0 0 ${radius.lg} ${radius.lg}` }}>
              <p style={{ color: textSec, fontSize: typography.label.size, fontFamily: typography.fontFamily }}>
                💡 Check "Mark complete" for columns like Done or Shipped to auto-complete tasks moved there.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Column: Custom Fields ────────────────────────────── */}
        <div className="space-y-4">
          <div
            className="rounded-xl"
            style={{
              background: surfaceBg,
              border: `1px solid ${border}`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
              <div>
                <h2 style={{ color: text, fontSize: typography.h2.size, fontWeight: typography.h2.weight, fontFamily: typography.fontFamily }}>
                  Custom Fields
                </h2>
                <p style={{ color: textDim, fontSize: typography.label.size, marginTop: '4px' }}>
                  Extra data on every task
                </p>
              </div>
              {!showFieldForm && (
                <button
                  onClick={() => setShowFieldForm(true)}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: C.accent, color: '#fff' }}
                  data-testid="add-custom-field-button"
                >
                  <Plus size={14} />
                  Add Field
                </button>
              )}
            </div>

            {/* Inline create form */}
            {showFieldForm && (
              <div className="px-5 py-4 space-y-3" style={{ borderBottom: `1px solid ${border}`, background: '#FAFBFC' }}>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: textSec, fontFamily: typography.fontFamily }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="e.g. Priority, Story Points"
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, fontFamily: typography.fontFamily }}
                    data-testid="custom-field-name-input"
                  />
                </div>
                <div>
                  <Dropdown
                    label="Type"
                    value={newFieldType}
                    onChange={(v) => setNewFieldType(v as FieldType)}
                    options={FIELD_TYPES.map(t => ({ value: t.value, label: t.label, icon: t.icon }))}
                    fullWidth
                    theme={{
                      text,
                      textMuted: textSec,
                      input: inputBg,
                      inputBorder: inputBdr,
                      surface: surfaceBg,
                      border,
                      hoverBg: '#F9FAFB',
                    }}
                    labelStyle={{ color: textSec, fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500 }}
                    style={{ fontFamily: typography.fontFamily, fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: textSec, fontFamily: typography.fontFamily }}>
                    Description <span style={{ color: textDim, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newFieldDescription}
                    onChange={(e) => setNewFieldDescription(e.target.value)}
                    placeholder="Help text for this field"
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, fontFamily: typography.fontFamily }}
                    data-testid="custom-field-description-input"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreateField}
                    disabled={createField.isPending || !newFieldName.trim()}
                    className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: C.accent, color: '#fff' }}
                    data-testid="save-custom-field-button"
                  >
                    {createField.isPending ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowFieldForm(false); setNewFieldName(''); setNewFieldType('text'); setNewFieldDescription('') }}
                    className="rounded-md px-4 py-2 text-sm font-semibold transition-all hover:bg-gray-50"
                    style={{ color: textSec, border: `1px solid ${border}` }}
                    data-testid="cancel-custom-field-button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Field list */}
            <div className="px-5 py-3" data-testid="custom-fields-container">
              {isLoadingFields ? (
                <div style={{ color: textDim, fontSize: typography.body.size, padding: spacing[4], textAlign: 'center' }}>
                  Loading…
                </div>
              ) : fieldDefinitions.length === 0 && !showFieldForm ? (
                <div style={{ color: textDim, fontSize: typography.body.size, padding: spacing[6], textAlign: 'center' }}>
                  No custom fields yet.
                </div>
              ) : (
                <ul className="space-y-2" role="list">
                  {fieldDefinitions.map((field) => {
                    const typeInfo = FIELD_TYPES.find((t) => t.value === field.field_type)
                    const TypeIcon = typeInfo?.icon
                    return (
                      <li
                        key={field.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-shadow hover:shadow-sm"
                        style={{ background: cardBg, border: `1px solid ${border}`, fontFamily: typography.fontFamily }}
                        data-testid={`custom-field-item-${field.id}`}
                      >
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1"
                          style={{ background: C.accent + '18', color: C.accent }}
                        >
                          {TypeIcon && <TypeIcon size={12} />}
                          {typeInfo?.label ?? field.field_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block" style={{ color: text }}>
                            {field.name}
                          </span>
                          {field.description && (
                            <span className="text-xs truncate block" style={{ color: textDim }}>
                              {field.description}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteField(field.id, field.name)}
                          disabled={deleteField.isPending}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label={`Delete ${field.name}`}
                          data-testid={`delete-custom-field-${field.id}`}
                        >
                          <Trash2 size={13} style={{ color: '#EF4444' }} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-3" style={{ borderTop: `1px solid ${border}`, background: '#F8F9FA', borderRadius: `0 0 ${radius.lg} ${radius.lg}` }}>
              <p style={{ color: textSec, fontSize: typography.label.size, fontFamily: typography.fontFamily }}>
                💡 Custom fields appear on all tasks. Use them for priority, effort, or workflow-specific data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
