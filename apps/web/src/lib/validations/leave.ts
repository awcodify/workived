import { z } from 'zod'

// ── Policy Validation ────────────────────────────────────────
export const createPolicySchema = z.object({
  name: z
    .string()
    .min(1, 'Policy name is required')
    .max(100, 'Policy name must be less than 100 characters'),
  days_per_year: z
    .number({ message: 'Days per year is required' })
    .min(0, 'Days per year cannot be negative')
    .max(365, 'Days per year cannot exceed 365'),
  carry_over_days: z
    .number()
    .min(0, 'Carry over days cannot be negative')
    .max(365, 'Carry over days cannot exceed 365')
    .optional(),
  min_tenure_days: z
    .number()
    .int('Min tenure must be a whole number')
    .min(0, 'Min tenure cannot be negative')
    .optional(),
  requires_approval: z.boolean().optional(),
})

export const updatePolicySchema = createPolicySchema.partial()

export type CreatePolicyFormData = z.infer<typeof createPolicySchema>
export type UpdatePolicyFormData = z.infer<typeof updatePolicySchema>

// ── Request Validation ───────────────────────────────────────
export const submitRequestSchema = z
  .object({
    leave_policy_id: z.string().uuid('Please select a leave type'),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    reason: z
      .string()
      .max(1000, 'Reason cannot exceed 1000 characters')
      .optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const end = new Date(data.end_date)
      return end >= start
    },
    {
      message: 'End date must be on or after start date',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return start >= today
    },
    {
      message: 'Cannot request leave for past dates',
      path: ['start_date'],
    }
  )

export type SubmitRequestFormData = z.infer<typeof submitRequestSchema>

// ── Review Validation ────────────────────────────────────────
export const approveSchema = z.object({
  note: z
    .string()
    .max(1000, 'Note cannot exceed 1000 characters')
    .optional(),
})

export const rejectSchema = z.object({
  note: z
    .string()
    .min(10, 'Rejection reason is required (minimum 10 characters)')
    .max(1000, 'Reason cannot exceed 1000 characters'),
})

export type ApproveFormData = z.infer<typeof approveSchema>
export type RejectFormData = z.infer<typeof rejectSchema>
