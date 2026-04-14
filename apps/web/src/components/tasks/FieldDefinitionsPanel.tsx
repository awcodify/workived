/**
 * FieldDefinitionsPanel — slide-over panel to manage custom field definitions.
 * Visible on the tasks page; restricted to admin/owner via useCanEditOrgSettings.
 */

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { X, Plus, Pencil, Trash2, GripVertical, AlertTriangle } from 'lucide-react'
import {
  useFieldDefinitions,
  useCreateFieldDefinition,
  useUpdateFieldDefinition,
  useDeactivateFieldDefinition,
} from '@/lib/hooks/useTasks'
import { typography } from '@/design/tokens'
import type { FieldDefinition, FieldType, CreateFieldDefinitionInput, UpdateFieldDefinitionInput } from '@/types/api'

// ── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text',         label: 'Text',         icon: '𝖳' },
  { value: 'number',       label: 'Number',       icon: '#' },
  { value: 'date',         label: 'Date',         icon: '📅' },
  { value: 'boolean',      label: 'Yes/No',       icon: '☑' },
  { value: 'select',       label: 'Select',       icon: '▾' },
  { value: 'multi_select', label: 'Multi-select', icon: '▾▾' },
  { value: 'url',          label: 'URL',          icon: '🔗' },
  { value: 'employee',     label: 'Employee',     icon: '👤' },
  { value: 'rating',       label: 'Rating',       icon: '★' },
]

const TYPES_NEEDING_OPTIONS: FieldType[] = ['select', 'multi_select']

// ── Zod schema ───────────────────────────────────────────────────────────────

const optionSchema = z.object({
  value: z.string().min(1, 'Option value required'),
  label: z.string().min(1, 'Option label required'),
  color: z.string().optional(),
})

const fieldSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  field_type:  z.enum(['text','number','date','boolean','select','multi_select','url','employee','rating'] as const),
  description: z.string().max(255).optional(),
  options:     z.array(optionSchema).optional(),
})

type FieldForm = z.infer<typeof fieldSchema>

// ── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function FieldDefinitionsPanel({ onClose }: Props) {
  const { data: fields = [], isLoading } = useFieldDefinitions()
  const [formOpen, setFormOpen]     = useState(false)
  const [editing, setEditing]       = useState<FieldDefinition | null>(null)
  const [deleting, setDeleting]     = useState<FieldDefinition | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (fd: FieldDefinition) => {
    setEditing(fd)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md h-full overflow-y-auto flex flex-col"
        style={{ background: '#FFFDF5' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
          style={{
            background: '#FFFDF5',
            borderBottom: '1px solid rgba(201,123,42,0.15)',
          }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
            >
              Custom Fields
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: '#64748B', fontFamily: typography.fontFamily }}
            >
              Add extra data to every task
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Close panel"
          >
            <X size={18} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="p-5 flex-1 space-y-4">
          {/* Add button */}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors shadow-sm w-full justify-center"
            style={{
              background: '#C97B2A',
              color: '#FFFFFF',
              fontFamily: typography.fontFamily,
            }}
          >
            <Plus size={16} />
            Add Field
          </button>

          {/* Form */}
          {formOpen && (
            <FieldForm
              editing={editing}
              onClose={closeForm}
            />
          )}

          {/* List */}
          {isLoading ? (
            <LoadingState />
          ) : fields.length === 0 && !formOpen ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2" role="list">
              {fields.map((fd) => (
                <FieldRow
                  key={fd.id}
                  fd={fd}
                  onEdit={() => openEdit(fd)}
                  onDelete={() => setDeleting(fd)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Delete confirm */}
        {deleting && (
          <DeleteConfirm
            fd={deleting}
            onCancel={() => setDeleting(null)}
            onConfirm={() => setDeleting(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({
  fd,
  onEdit,
  onDelete,
}: {
  fd: FieldDefinition
  onEdit: () => void
  onDelete: () => void
}) {
  const typeInfo = FIELD_TYPES.find((t) => t.value === fd.field_type)

  return (
    <li
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(201,123,42,0.12)',
        fontFamily: typography.fontFamily,
      }}
    >
      <GripVertical
        size={14}
        className="opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
        style={{ color: '#64748B', cursor: 'grab' }}
        aria-hidden
      />

      {/* Type badge */}
      <span
        className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
        style={{
          background: 'rgba(201,123,42,0.10)',
          color: '#C97B2A',
        }}
      >
        {typeInfo?.icon} {typeInfo?.label ?? fd.field_type}
      </span>

      {/* Name */}
      <span
        className="flex-1 text-sm font-medium truncate"
        style={{ color: '#2C3E50' }}
      >
        {fd.name}
      </span>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-black/5 transition-colors"
          aria-label={`Edit ${fd.name}`}
        >
          <Pencil size={13} style={{ color: '#64748B' }} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 transition-colors"
          aria-label={`Delete ${fd.name}`}
        >
          <Trash2 size={13} style={{ color: '#EF4444' }} />
        </button>
      </div>
    </li>
  )
}

// ── FieldForm ─────────────────────────────────────────────────────────────────

function FieldForm({
  editing,
  onClose,
}: {
  editing: FieldDefinition | null
  onClose: () => void
}) {
  const createMutation    = useCreateFieldDefinition()
  const updateMutation    = useUpdateFieldDefinition()

  const defaultOptions = editing?.config?.options ?? []

  const {
    register,
    handleSubmit,
    watch,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FieldForm>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name:        editing?.name ?? '',
      field_type:  editing?.field_type ?? 'text',
      description: editing?.description ?? '',
      options:     defaultOptions.map((o) => ({ value: o.value, label: o.label, color: o.color ?? '' })),
    },
  })

  const { fields: optionFields, append, remove } = useFieldArray({
    control,
    name: 'options',
  })

  const selectedType = watch('field_type') as FieldType
  const needsOptions = TYPES_NEEDING_OPTIONS.includes(selectedType)

  const onSubmit = (data: FieldForm) => {
    if (needsOptions && (!data.options || data.options.length === 0)) {
      setError('options', { type: 'manual', message: 'At least one option is required' })
      return
    }

    const config = needsOptions && data.options?.length
      ? { options: data.options.map((o) => ({ value: o.value, label: o.label, color: o.color || undefined })) }
      : undefined

    if (editing) {
      const payload: UpdateFieldDefinitionInput = {
        name:        data.name,
        description: data.description || undefined,
        config,
      }
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: onClose })
    } else {
      const payload: CreateFieldDefinitionInput = {
        name:        data.name,
        field_type:  data.field_type,
        description: data.description || undefined,
        config,
      }
      createMutation.mutate(payload, { onSuccess: onClose })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isError   = createMutation.isError   || updateMutation.isError

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg p-4 space-y-3"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(201,123,42,0.20)',
      }}
    >
      <h3
        className="text-sm font-bold"
        style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
      >
        {editing ? 'Edit Field' : 'New Field'}
      </h3>

      {/* Name */}
      <div>
        <label
          className="block text-xs font-semibold mb-1"
          style={{ color: '#64748B', fontFamily: typography.fontFamily }}
        >
          Name
        </label>
        <input
          {...register('name')}
          placeholder="e.g. Story Points"
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{
            background: '#F9FAFB',
            border: errors.name ? '1px solid #EF4444' : '1px solid #DFE1E6',
            color: '#2C3E50',
            fontFamily: typography.fontFamily,
          }}
        />
        {errors.name && (
          <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Type — only shown when creating */}
      {!editing && (
        <div>
          <label
            className="block text-xs font-semibold mb-1"
            style={{ color: '#64748B', fontFamily: typography.fontFamily }}
          >
            Type
          </label>
          <select
            {...register('field_type')}
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: '#F9FAFB',
              border: '1px solid #DFE1E6',
              color: '#2C3E50',
              fontFamily: typography.fontFamily,
            }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div>
        <label
          className="block text-xs font-semibold mb-1"
          style={{ color: '#64748B', fontFamily: typography.fontFamily }}
        >
          Description <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          {...register('description')}
          placeholder="Help text shown on the task"
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{
            background: '#F9FAFB',
            border: '1px solid #DFE1E6',
            color: '#2C3E50',
            fontFamily: typography.fontFamily,
          }}
        />
      </div>

      {/* Options — shown for select / multi_select */}
      {needsOptions && (
        <div>
          <label
            className="block text-xs font-semibold mb-1"
            style={{ color: '#64748B', fontFamily: typography.fontFamily }}
          >
            Options
          </label>
          <div className="space-y-2">
            {optionFields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  {...register(`options.${idx}.value`)}
                  placeholder="value"
                  className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
                  style={{
                    background: '#F9FAFB',
                    border: errors.options?.[idx]?.value
                      ? '1px solid #EF4444'
                      : '1px solid #DFE1E6',
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                />
                <input
                  {...register(`options.${idx}.label`)}
                  placeholder="label"
                  className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
                  style={{
                    background: '#F9FAFB',
                    border: errors.options?.[idx]?.label
                      ? '1px solid #EF4444'
                      : '1px solid #DFE1E6',
                    color: '#2C3E50',
                    fontFamily: typography.fontFamily,
                  }}
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1 rounded hover:bg-red-50 transition-colors"
                  aria-label="Remove option"
                >
                  <X size={12} style={{ color: '#EF4444' }} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ value: '', label: '' })}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors"
              style={{
                background: 'rgba(201,123,42,0.08)',
                color: '#C97B2A',
                fontFamily: typography.fontFamily,
              }}
            >
              <Plus size={12} />
              Add option
            </button>
          </div>
          {(errors.options?.root?.message ?? errors.options?.message) && (
            <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
              {errors.options?.root?.message ?? errors.options?.message}
            </p>
          )}
        </div>
      )}

      {/* Error banner */}
      {isError && (
        <p className="text-xs" style={{ color: '#EF4444', fontFamily: typography.fontFamily }}>
          Failed to save. Please try again.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending || isSubmitting}
          className="flex-1 py-2 rounded-md text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{
            background: '#C97B2A',
            color: '#FFFFFF',
            fontFamily: typography.fontFamily,
          }}
        >
          {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Field'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-black/5"
          style={{
            color: '#64748B',
            fontFamily: typography.fontFamily,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({
  fd,
  onCancel,
  onConfirm,
}: {
  fd: FieldDefinition
  onCancel: () => void
  onConfirm: () => void
}) {
  const deactivate = useDeactivateFieldDefinition()

  const handleConfirm = () => {
    deactivate.mutate(fd.id, { onSuccess: onConfirm })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-sm rounded-xl p-6 space-y-4"
        style={{ background: '#FFFFFF' }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}
            >
              Hide &ldquo;{fd.name}&rdquo;?
            </h3>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: '#64748B', fontFamily: typography.fontFamily }}
            >
              Field will be hidden from new tasks. Existing values are preserved and
              can be restored by re-activating the field.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirm}
            disabled={deactivate.isPending}
            className="flex-1 py-2 rounded-md text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              fontFamily: typography.fontFamily,
            }}
          >
            {deactivate.isPending ? 'Hiding…' : 'Hide Field'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-black/5 transition-colors"
            style={{
              color: '#64748B',
              fontFamily: typography.fontFamily,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Loading / Empty ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2 pt-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-10 rounded-lg animate-pulse"
          style={{ background: 'rgba(201,123,42,0.08)' }}
        />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-lg px-4 py-8 text-center"
      style={{ border: '1px dashed rgba(201,123,42,0.30)' }}
    >
      <p
        className="text-sm font-medium"
        style={{ color: '#C97B2A', fontFamily: typography.fontFamily }}
      >
        No custom fields yet
      </p>
      <p
        className="text-xs mt-1"
        style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}
      >
        Add fields to track extra data on every task.
      </p>
    </div>
  )
}
