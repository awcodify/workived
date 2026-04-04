import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { useCreateDepartment, useUpdateDepartment } from '@/lib/hooks/useDepartments'
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock'
import { moduleThemes, typography } from '@/design/tokens'
import type { Department } from '@/types/api'

const t = moduleThemes.people

interface DepartmentModalProps {
  department?: Department  // If provided, edit mode; otherwise create mode
  onClose: () => void
  onSuccess: () => void
}

interface DepartmentFormData {
  name: string
}

export function DepartmentModal({ department, onClose, onSuccess }: DepartmentModalProps) {
  const createMutation = useCreateDepartment()
  const updateMutation = useUpdateDepartment(department?.id ?? '')

  const isEditMode = !!department

  // Lock body scroll when modal is open
  useBodyScrollLock()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DepartmentFormData>({
    defaultValues: isEditMode
      ? {
          name: department.name,
        }
      : {
          name: '',
        },
  })

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const onSubmit = async (data: DepartmentFormData) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ name: data.name })
      } else {
        await createMutation.mutateAsync({ name: data.name })
      }
      onSuccess()
    } catch (error) {
      // Error handled by mutation
    }
  }

  const mutation = isEditMode ? updateMutation : createMutation

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h2
            className="font-bold"
            style={{ fontSize: typography.h2.size, color: t.text }}
          >
            {isEditMode ? 'Edit Department' : 'New Department'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: t.textMuted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-4 space-y-4">
            {/* Name Field */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: t.text }}
              >
                Department Name
              </label>
              <input
                type="text"
                {...register('name', {
                  required: 'Department name is required',
                  maxLength: { value: 150, message: 'Name must be less than 150 characters' },
                })}
                className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 8,
                  color: t.text,
                }}
                placeholder="e.g., Engineering, Marketing, HR"
              />
              {errors.name && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: `1px solid ${t.border}` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-70"
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                color: t.text,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: t.accent,
                color: '#ffffff',
              }}
            >
              {mutation.isPending ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
