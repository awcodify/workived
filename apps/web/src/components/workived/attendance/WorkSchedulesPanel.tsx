import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import {
  useWorkSchedules,
  useCreateWorkSchedule,
  useUpdateWorkSchedule,
  useDeactivateWorkSchedule,
} from '@/lib/hooks/useAttendance'
import { moduleThemes, colors } from '@/design/tokens'
import { X, Plus, Pencil, Trash2, Clock, AlertTriangle } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import type { WorkScheduleListItem } from '@/types/api'

const t = moduleThemes.attendance
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const scheduleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  work_days: z.array(z.number()).min(1, 'Select at least one work day'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
})

type ScheduleForm = z.infer<typeof scheduleSchema>

// ── Panel (main export) ──────────────────────────────────────────────────────

export function WorkSchedulesPanel({ onClose }: { onClose: () => void }) {
  const { data: schedules = [], isLoading } = useWorkSchedules()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WorkScheduleListItem | null>(null)
  const [deactivating, setDeactivating] = useState<WorkScheduleListItem | null>(null)
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (ws: WorkScheduleListItem) => {
    setEditing(ws)
    setFormOpen(true)
  }

  const openDeactivate = async (ws: WorkScheduleListItem) => {
    setDeactivating(ws)
    try {
      const res = await attendanceApi.countEmployeesBySchedule(ws.id)
      setEmployeeCount(res.data.data.count)
    } catch {
      setEmployeeCount(0)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md h-full overflow-y-auto"
        style={{ background: t.surface }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <h2 className="text-base font-bold" style={{ color: t.text }}>Work Schedules</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
            <X size={18} style={{ color: t.textMuted }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-accent text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-accent-text transition-colors shadow-sm w-full justify-center"
          >
            <Plus size={16} />
            Add Schedule
          </button>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: t.border }} />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ border: `1px solid ${t.border}` }}>
              <Clock size={28} className="mx-auto mb-2" style={{ color: t.textMuted }} />
              <p className="text-sm font-medium" style={{ color: t.text }}>No work schedules yet</p>
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>Create your first schedule above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((ws) => (
                <ScheduleCard
                  key={ws.id}
                  schedule={ws}
                  onEdit={() => openEdit(ws)}
                  onDeactivate={() => openDeactivate(ws)}
                />
              ))}
            </div>
          )}

          <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
            Assign schedules to individual employees from People &rarr; Edit employee.
          </p>
        </div>
      </div>

      {formOpen && (
        <ScheduleFormModal
          schedule={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      {deactivating && (
        <DeactivateConfirm
          schedule={deactivating}
          employeeCount={employeeCount}
          onClose={() => { setDeactivating(null); setEmployeeCount(null) }}
        />
      )}
    </div>
  )
}

// ── Schedule Card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onEdit,
  onDeactivate,
}: {
  schedule: WorkScheduleListItem
  onEdit: () => void
  onDeactivate: () => void
}) {
  const dayNames = [...schedule.work_days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ')

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between"
      style={{ border: `1px solid ${t.border}` }}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: t.text }}>
            {schedule.name}
          </span>
          {schedule.is_default && (
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${colors.accent}20`, color: colors.accent }}
            >
              Default
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
          {dayNames} &middot; {schedule.start_time.slice(0, 5)} &ndash; {schedule.end_time.slice(0, 5)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
          title="Edit schedule"
        >
          <Pencil size={14} style={{ color: t.textMuted }} />
        </button>
        {!schedule.is_default && (
          <button
            onClick={onDeactivate}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            title="Deactivate schedule"
          >
            <Trash2 size={14} style={{ color: colors.err }} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Schedule Form Modal ──────────────────────────────────────────────────────

function ScheduleFormModal({
  schedule,
  onClose,
}: {
  schedule: WorkScheduleListItem | null
  onClose: () => void
}) {
  const isEdit = !!schedule
  const createMutation = useCreateWorkSchedule()
  const updateMutation = useUpdateWorkSchedule()
  const isPending = createMutation.isPending || updateMutation.isPending

  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: schedule?.name ?? '',
      work_days: schedule?.work_days ?? [1, 2, 3, 4, 5],
      start_time: schedule?.start_time?.slice(0, 5) ?? '09:00',
      end_time: schedule?.end_time?.slice(0, 5) ?? '17:00',
    },
  })

  const workDays = form.watch('work_days')

  const toggleDay = (day: number) => {
    const current = form.getValues('work_days')
    if (current.includes(day)) {
      form.setValue('work_days', current.filter((d) => d !== day), { shouldValidate: true })
    } else {
      form.setValue('work_days', [...current, day], { shouldValidate: true })
    }
  }

  const onSubmit = (data: ScheduleForm) => {
    if (isEdit && schedule) {
      updateMutation.mutate({ id: schedule.id, data }, { onSuccess: onClose })
    } else {
      createMutation.mutate(data, { onSuccess: onClose })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <h2 className="text-base font-bold mb-4" style={{ color: t.text }}>
          {isEdit ? 'Edit Schedule' : 'New Schedule'}
        </h2>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>Name</label>
            <input
              className="form-input-dark w-full"
              placeholder="e.g., Night Shift"
              style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-err mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>Work Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className="w-10 h-10 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: workDays.includes(idx) ? colors.accent : t.input,
                    color: workDays.includes(idx) ? '#fff' : t.textMuted,
                    border: `1px solid ${workDays.includes(idx) ? colors.accent : t.inputBorder}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.formState.errors.work_days && (
              <p className="text-xs text-err mt-1">{form.formState.errors.work_days.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>Start Time</label>
              <input type="time" className="form-input-dark w-full" style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }} {...form.register('start_time')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>End Time</label>
              <input type="time" className="form-input-dark w-full" style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }} {...form.register('end_time')} />
            </div>
          </div>

          {(createMutation.isError || updateMutation.isError) && (
            <div className="rounded-lg bg-err/10 border border-err/20 p-3">
              <p className="text-xs text-err font-medium">Something went wrong. Please try again.</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-accent text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Schedule'}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2.5" style={{ color: t.textMuted }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Deactivate Confirm ───────────────────────────────────────────────────────

function DeactivateConfirm({
  schedule,
  employeeCount,
  onClose,
}: {
  schedule: WorkScheduleListItem
  employeeCount: number | null
  onClose: () => void
}) {
  const deactivateMutation = useDeactivateWorkSchedule()

  const handleConfirm = () => {
    deactivateMutation.mutate(schedule.id, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} style={{ color: colors.warn }} />
          <h2 className="text-base font-bold" style={{ color: t.text }}>Deactivate Schedule</h2>
        </div>

        <p className="text-sm mb-3" style={{ color: t.textMuted }}>
          Are you sure you want to deactivate <strong style={{ color: t.text }}>{schedule.name}</strong>?
        </p>

        {employeeCount !== null && employeeCount > 0 && (
          <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{ background: `${colors.warn}15`, color: colors.warn }}>
            {employeeCount} employee{employeeCount !== 1 ? 's' : ''} currently assigned to this schedule. They will revert to the org default.
          </div>
        )}

        {deactivateMutation.isError && (
          <div className="rounded-lg bg-err/10 border border-err/20 p-3 mb-3">
            <p className="text-xs text-err font-medium">Failed to deactivate. Please try again.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={deactivateMutation.isPending}
            className="font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: colors.err, color: '#fff' }}
          >
            {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
          </button>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2.5" style={{ color: t.textMuted }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
