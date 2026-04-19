import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useSubmitCorrection } from '@/lib/hooks/useAttendance'
import { orgTimeToUTC, formatDate } from '@/lib/utils/date'
import { moduleThemes } from '@/design/tokens'
import { X, Clock } from 'lucide-react'
import type { WeekDay } from '@/types/api'

const t = moduleThemes.attendance

const correctionSchema = z.object({
  requested_clock_in: z.string().optional(),
  requested_clock_out: z.string().optional(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
}).refine(
  (d) => d.requested_clock_in || d.requested_clock_out,
  { message: 'At least one of clock-in or clock-out is required', path: ['requested_clock_in'] }
)

type CorrectionForm = z.infer<typeof correctionSchema>

interface CorrectionModalProps {
  day: WeekDay
  onClose: () => void
  tz?: string
}

export function CorrectionModal({ day, onClose, tz = 'UTC' }: CorrectionModalProps) {
  const { mutate: submit, isPending } = useSubmitCorrection()
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<CorrectionForm>({
    resolver: zodResolver(correctionSchema),
  })

  const onSubmit = (data: CorrectionForm) => {
    const toISO = (localTime: string) => {
      if (!localTime) return undefined
      return orgTimeToUTC(day.date, localTime, tz)
    }

    submit(
      {
        date: day.date,
        requested_clock_in: data.requested_clock_in ? toISO(data.requested_clock_in) : undefined,
        requested_clock_out: data.requested_clock_out ? toISO(data.requested_clock_out) : undefined,
        reason: data.reason,
      },
      {
        onSuccess: () => setSubmitted(true),
      }
    )
  }

  return (
    <div
      data-testid="correction-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: t.text }}>Request Correction</h2>
            <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>{day.date} · {day.day_name}</p>
          </div>
          <button
            data-testid="correction-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 transition-all"
            style={{ color: t.textMuted }}
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div data-testid="correction-modal-success" className="px-6 py-8 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#DCFCE7' }}
            >
              <Clock size={24} style={{ color: '#10B981' }} />
            </div>
            <h3 className="font-bold text-base mb-2" style={{ color: t.text }}>Request Submitted</h3>
            <p className="text-sm" style={{ color: t.textMuted }}>
              Your manager will review and approve or reject your correction.
            </p>
            <button
              data-testid="correction-modal-done-btn"
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: t.accent, color: t.accentText }}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            data-testid="correction-form"
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-5 space-y-4"
          >
            {/* Current times */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textMuted }}>Current Record</p>
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase" style={{ color: t.textMuted }}>Clock In</p>
                  <p className="text-sm font-bold" style={{ color: t.text }}>
                    {day.clock_in_at ? formatDate(day.clock_in_at, tz, 'time') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase" style={{ color: t.textMuted }}>Clock Out</p>
                  <p className="text-sm font-bold" style={{ color: t.text }}>
                    {day.clock_out_at ? formatDate(day.clock_out_at, tz, 'time') : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Requested clock-in */}
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: t.textMuted }}>
                Corrected Clock In (optional)
              </label>
              <input
                data-testid="correction-clock-in-input"
                type="time"
                {...register('requested_clock_in')}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all outline-none"
                style={{
                  background: '#F9FAFB',
                  border: `1px solid ${errors.requested_clock_in ? '#EF4444' : '#E5E7EB'}`,
                  color: t.text,
                }}
              />
              {errors.requested_clock_in && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.requested_clock_in.message}</p>
              )}
            </div>

            {/* Requested clock-out */}
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: t.textMuted }}>
                Corrected Clock Out (optional)
              </label>
              <input
                data-testid="correction-clock-out-input"
                type="time"
                {...register('requested_clock_out')}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all outline-none"
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  color: t.text,
                }}
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: t.textMuted }}>
                Reason <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                data-testid="correction-reason-input"
                {...register('reason')}
                rows={3}
                placeholder="Explain why you need this correction (min 10 characters)"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all outline-none resize-none"
                style={{
                  background: '#F9FAFB',
                  border: `1px solid ${errors.reason ? '#EF4444' : '#E5E7EB'}`,
                  color: t.text,
                }}
              />
              {errors.reason && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.reason.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              data-testid="correction-submit-btn"
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: t.accent, color: t.accentText }}
            >
              {isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
