import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react'
import { useCustomHolidays, useCreateCustomHoliday, useDeleteCustomHoliday } from '@/lib/hooks/useCalendarHolidays'
import { useCanManageLeave } from '@/lib/hooks/useRole'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import type { CreateCustomHolidayInput } from '@/types/api'
import { DatePicker } from '@/components/ui'

const t = moduleThemes.calendar

export const Route = createFileRoute('/_app/calendar/holidays/')({
  component: CustomHolidaysPage,
})

// ── Main Component ───────────────────────────────────────────

function CustomHolidaysPage() {
  const canManage = useCanManageLeave()
  const { data: holidays, isLoading } = useCustomHolidays()
  const createMutation = useCreateCustomHoliday()
  const deleteMutation = useDeleteCustomHoliday()

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CreateCustomHolidayInput>({ date: '', name: '' })
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Holiday name is required')
      return
    }
    if (!formData.date) {
      setFormError('Date is required')
      return
    }
    try {
      await createMutation.mutateAsync(formData)
      setFormData({ date: '', name: '' })
      setShowForm(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create holiday'
      setFormError(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingId === id) {
      try {
        await deleteMutation.mutateAsync(id)
        setDeletingId(null)
      } catch {
        // Error handled by mutation
      }
    } else {
      setDeletingId(id)
    }
  }

  const sortedHolidays = [...(holidays ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date),
  )

  return (
    <div
      data-testid="holidays-page"
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.calendar, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/calendar"
            className="flex items-center gap-1.5 text-sm font-semibold mb-3 transition-opacity hover:opacity-70"
            style={{ color: t.accent }}
          >
            <ArrowLeft size={16} />
            Back to Calendar
          </Link>
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: t.text,
              lineHeight: typography.display.lineHeight,
            }}
          >
            Custom Holidays
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {sortedHolidays.length} custom holiday{sortedHolidays.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            data-testid="holidays-add-btn"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 12,
            }}
          >
            <Plus size={16} />
            Add Holiday
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div
          data-testid="holidays-form"
          className="mb-6 p-5"
          style={{
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
          }}
        >
          <h3
            className="font-bold mb-4"
            style={{ fontSize: typography.h3.size, color: t.text }}
          >
            Add Custom Holiday
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <DatePicker
                data-testid="holidays-date-input"
                label="Date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  outline: 'none',
                }}
                containerStyle={{ color: t.textMuted }}
              />
            </div>
            <div className="flex-[2]">
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: t.textMuted }}
              >
                Holiday Name
              </label>
              <input
                data-testid="holidays-name-input"
                type="text"
                placeholder="e.g. Company Anniversary"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  outline: 'none',
                }}
              />
            </div>
          </div>
          {formError && (
            <p className="text-sm mt-2" style={{ color: '#E85757' }}>
              {formError}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              data-testid="holidays-create-btn"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 10,
              }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              data-testid="holidays-cancel-btn"
              onClick={() => { setShowForm(false); setFormError('') }}
              className="text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
              style={{
                background: t.surface,
                color: t.textMuted,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Holiday List */}
      {isLoading ? (
        <HolidaySkeleton />
      ) : sortedHolidays.length === 0 ? (
        <EmptyState canManage={canManage} onAdd={() => setShowForm(true)} />
      ) : (
        <div
          style={{
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
          }}
        >
          {sortedHolidays.map((holiday, idx) => (
            <div
              key={holiday.id ?? idx}
              data-testid={`holidays-row-${holiday.id ?? idx}`}
              className="flex items-center justify-between px-5 py-4 transition-colors"
              style={{
                background: idx % 2 === 0 ? 'transparent' : 'rgba(217,119,6,0.02)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  idx % 2 === 0 ? 'transparent' : 'rgba(217,119,6,0.02)'
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(217,119,6,0.08)',
                  }}
                >
                  <CalendarIcon size={18} style={{ color: t.accent }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: t.text }}>
                    {holiday.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                    {formatHolidayDate(holiday.date)}
                  </p>
                </div>
              </div>
              {canManage && holiday.id && (
                <button
                  data-testid={`holidays-delete-btn-${holiday.id}`}
                  onClick={() => handleDelete(holiday.id!)}
                  className="p-2 transition-opacity hover:opacity-70"
                  style={{
                    color: deletingId === holiday.id ? '#E85757' : t.textMuted,
                    borderRadius: 8,
                    background: deletingId === holiday.id ? 'rgba(232,87,87,0.08)' : 'transparent',
                  }}
                  title={deletingId === holiday.id ? 'Click again to confirm' : 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────

function EmptyState({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  return (
    <div
      data-testid="holidays-empty"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
      }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'rgba(217,119,6,0.08)',
        }}
      >
        <CalendarIcon size={24} style={{ color: t.accent }} />
      </div>
      <p className="font-bold text-base mb-1" style={{ color: t.text }}>
        No custom holidays yet
      </p>
      <p className="text-sm mb-4" style={{ color: t.textMuted, maxWidth: '320px' }}>
        Add company-specific holidays like anniversaries or team events.
        They&apos;ll show up on the calendar and affect leave calculations.
      </p>
      {canManage && (
        <button
          data-testid="holidays-empty-add-btn"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 10,
          }}
        >
          <Plus size={16} />
          Add First Holiday
        </button>
      )}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────

function HolidaySkeleton() {
  return (
    <div
      data-testid="holidays-skeleton"
      className="animate-pulse"
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.border }} />
          <div className="flex-1">
            <div style={{ width: '40%', height: 14, borderRadius: 6, background: t.border }} />
            <div style={{ width: '25%', height: 10, borderRadius: 4, background: t.border, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function formatHolidayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
