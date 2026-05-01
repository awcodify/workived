import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useState, useEffect } from 'react'
import { useCreateEmployee } from '@/lib/hooks/useEmployees'
import { useUnlinkedMembers, useInviteMember } from '@/lib/hooks/useInvitations'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDepartments } from '@/lib/hooks/useDepartments'
import { useJobTitles } from '@/lib/hooks/useJobTitles'
import { useWorkSchedules } from '@/lib/hooks/useAttendance'
import { EmployeeDropdown } from '@/components/workived/shared/EmployeeDropdown'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import { moduleBackgrounds, moduleThemes, colors } from '@/design/tokens'
import { ArrowLeft, Check } from 'lucide-react'
import axios from 'axios'
import { AccessModeStep } from '@/components/workived/people/AccessModeStep'
import { PhotoUpload } from '@/components/workived/people/PhotoUpload'
import { DatePicker } from '@/components/ui'

const t = moduleThemes.people

export const Route = createFileRoute('/_app/people/new')({
  component: NewEmployeePage,
  validateSearch: (search: Record<string, unknown>) => ({
    user_id: typeof search.user_id === 'string' ? search.user_id : undefined,
    reporting_to: typeof search.reporting_to === 'string' ? search.reporting_to : undefined,
  }),
})

// ── Schema ──────────────────────────────────────────────────────────────────

const newSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  job_title: z.string().max(150).optional().or(z.literal('')),
  department_id: z.string().optional().or(z.literal('')),
  reporting_to: z.string().optional().or(z.literal('')),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date is required'),
  probation_end_date: z.string().optional().or(z.literal('')),
  work_schedule_id: z.string().min(1, 'Work schedule is required'),
  email_mode: z.enum(['member', 'new', 'skip']),
  selected_user_id: z.string().optional(),
  email: z.string().optional(),
  photo_preview: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.email_mode === 'new' && (!data.email || data.email.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email is required when inviting new person',
      path: ['email'],
    })
  }
  if (data.email_mode === 'member' && (!data.selected_user_id || data.selected_user_id.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a workspace member',
      path: ['selected_user_id'],
    })
  }
})

type NewForm = z.infer<typeof newSchema>

function apiErrorMessage(err: Error | null): string {
  if (!err) return 'Something went wrong. Please try again.'
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error?.message
    if (typeof msg === 'string' && msg.length > 0) return msg
  }
  return 'Something went wrong. Please try again.'
}

// ── Component ─────────────────────────────────────────────────────────────────

function NewEmployeePage() {
  const navigate = useNavigate()
  const { user_id: preselectedUserId, reporting_to: preselectedReportingTo } = Route.useSearch()
  const createMutation = useCreateEmployee()
  const inviteMutation = useInviteMember()
  const { data: org } = useOrganisation()
  const { data: unlinkedMembers = [] } = useUnlinkedMembers()
  const { data: departments } = useDepartments()
  const { data: jobTitles } = useJobTitles()
  const { data: workSchedules } = useWorkSchedules()

  const safeDepartments = departments ?? []
  const safeJobTitles = jobTitles ?? []
  const safeWorkSchedules = workSchedules ?? []

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const form = useForm<NewForm>({
    resolver: zodResolver(newSchema),
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      phone: '',
      job_title: '',
      department_id: '',
      reporting_to: preselectedReportingTo ?? '',
      employment_type: 'full_time',
      gender: '',
      start_date: '',
      probation_end_date: '',
      work_schedule_id: '',
      email_mode: preselectedUserId ? 'member' : 'new',
      selected_user_id: preselectedUserId ?? '',
      email: '',
      photo_preview: '',
    },
  })

  const emailMode = form.watch('email_mode')
  const selectedUserId = form.watch('selected_user_id')
  const startDate = form.watch('start_date')

  // Auto-fill probation_end_date when start_date changes and org has default_probation_days
  useEffect(() => {
    if (!startDate || !org?.default_probation_days) return
    const start = new Date(startDate)
    if (isNaN(start.getTime())) return
    start.setDate(start.getDate() + org.default_probation_days)
    form.setValue('probation_end_date', start.toISOString().split('T')[0])
  }, [startDate, org?.default_probation_days, form])

  // Auto-fill name when member is selected
  useEffect(() => {
    if (emailMode !== 'member' || !selectedUserId) return
    const member = unlinkedMembers.find((m) => m.user_id === selectedUserId)
    if (member && !form.getValues('full_name')) {
      form.setValue('full_name', member.full_name)
    }
  }, [selectedUserId, emailMode, unlinkedMembers, form])

  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        form.setValue('photo_preview', reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      form.setValue('photo_preview', '')
    }
  }

  const onSubmit = form.handleSubmit((data) => {
    const member =
      data.email_mode === 'member'
        ? unlinkedMembers.find((m) => m.user_id === data.selected_user_id)
        : undefined

    const payload = {
      full_name: data.full_name,
      email: data.email_mode === 'new' ? data.email : member?.email,
      user_id: data.email_mode === 'member' ? data.selected_user_id : undefined,
      reporting_to: data.reporting_to || undefined,
      phone: data.phone || undefined,
      job_title: data.job_title || undefined,
      department_id: data.department_id || undefined,
      employment_type: data.employment_type,
      gender: data.gender === 'male' || data.gender === 'female' ? data.gender : undefined,
      start_date: data.start_date,
      probation_end_date: data.probation_end_date || undefined,
      work_schedule_id: data.work_schedule_id,
    }

    createMutation.mutate(payload, {
      onSuccess: (employee) => {
        if (data.email_mode === 'new' && data.email) {
          inviteMutation.mutate(
            { 
              email: data.email, 
              role: 'member', 
              employee_id: employee.id,
            },
            { onSettled: () => navigate({ to: '/people' }) },
          )
        } else {
          navigate({ to: '/people' })
        }
      },
    })
  })

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      data-testid="people-new-page"
      style={{ background: moduleBackgrounds.people }}
    >
      {/* Back button */}
      <Link
        to="/people"
        className="flex items-center gap-1 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: t.textMuted }}
      >
        <ArrowLeft size={16} />
        Back to People
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: t.text }}>
          Add Employee
        </h1>
        <p className="text-sm" style={{ color: t.textMuted }}>
          Fill in the details below. Only name and start date are required.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-6" data-testid="people-new-form">
        {/* Access mode section */}
        <div>
          <AccessModeStep form={form} />
          
          {/* Role assignment info - only show for "Invite new person" mode */}
          {form.watch('email_mode') === 'new' && (
            <div
              className="mt-3 px-4 py-3 rounded-lg flex items-start gap-3 text-sm"
              style={{
                background: `${colors.accent}10`,
                border: `1px solid ${colors.accent}30`,
              }}
            >
              <svg
                className="w-5 h-5 mt-0.5 flex-shrink-0"
                style={{ color: colors.accent }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div style={{ color: t.text }}>
                This person will be invited as a <strong>Member</strong> (basic access). 
                You can adjust their role in <strong>Settings → Members</strong> after creation.
              </div>
            </div>
          )}
        </div>

        {/* Personal & Employment in a clean 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Info */}
          <div
            className="rounded-xl p-6 space-y-5"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <div>
              <h2 className="text-base font-bold mb-1" style={{ color: t.text }}>
                Personal Information
              </h2>
              <p className="text-xs" style={{ color: t.textMuted }}>
                Basic employee details
              </p>
            </div>

            {/* Photo */}
            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium" style={{ color: t.text }}>
                  Photo{' '}
                  <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                    (optional)
                  </span>
                </span>
              </label>
              <PhotoUpload
                value={form.watch('photo_preview')}
                onChange={handlePhotoChange}
              />
            </div>

            {/* Full name - Required */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Full name <span style={{ color: colors.err }}>*</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g., Ahmad Rahman"
                  data-testid="people-full-name-input"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{
                    background: t.input,
                    border: `1px solid ${form.formState.errors.full_name ? colors.err : t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('full_name')}
                />
                {form.formState.errors.full_name && (
                  <p className="text-xs mt-1.5" style={{ color: colors.err }}>
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </label>
            </div>

            {/* Phone */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Phone{' '}
                  <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                    (optional)
                  </span>
                </span>
                <input
                  type="tel"
                  placeholder="e.g., +62 812 3456 7890"
                  data-testid="people-phone-input"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('phone')}
                />
              </label>
            </div>

            {/* Gender */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Gender{' '}
                  <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                    (optional)
                  </span>
                </span>
                <select
                  data-testid="people-gender-select"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('gender')}
                >
                  <option value="">— Not specified —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
            </div>
          </div>

          {/* Employment Details */}
          <div
            className="rounded-xl p-6 space-y-5"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <div>
              <h2 className="text-base font-bold mb-1" style={{ color: t.text }}>
                Employment Details
              </h2>
              <p className="text-xs" style={{ color: t.textMuted }}>
                Job role and organizational structure
              </p>
            </div>

            {/* Start date - Required */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Start date <span style={{ color: colors.err }}>*</span>
                </span>
                <DatePicker
                  data-testid="people-start-date-input"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  style={{
                    background: t.input,
                    border: `1px solid ${form.formState.errors.start_date ? colors.err : t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('start_date')}
                  error={!!form.formState.errors.start_date}
                  errorMessage={form.formState.errors.start_date?.message as string}
                />
              </label>
            </div>

            {/* Probation end date */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Probation end date{' '}
                  <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                    (optional, auto-filled from start date)
                  </span>
                </span>
                <DatePicker
                  data-testid="people-probation-end-date-input"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('probation_end_date')}
                />
              </label>
            </div>

            {/* Employment type - Required but has default */}
            <div>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Employment type
                </span>
                <select
                  data-testid="people-employment-type-select"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('employment_type')}
                >
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </label>
            </div>

            {/* Work Schedule - Required */}
            <Controller
              name="work_schedule_id"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="block">
                    <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                      Work schedule <span style={{ color: colors.err }}>*</span>
                    </span>
                    {safeWorkSchedules.length === 0 ? (
                      <div
                        className="rounded-lg px-4 py-3 text-sm"
                        data-testid="people-work-schedule-empty"
                        style={{
                          background: `${colors.warn}10`,
                          border: `1px solid ${colors.warn}30`,
                          color: t.text,
                        }}
                      >
                        No work schedules found.{' '}
                        <Link
                          to="/attendance"
                          className="font-medium underline"
                          style={{ color: colors.accent }}
                        >
                          Create one in Attendance settings
                        </Link>{' '}
                        before adding employees.
                      </div>
                    ) : (
                      <div data-testid="people-work-schedule-select">
                        <Dropdown
                          value={field.value || ''}
                          onChange={field.onChange}
                          options={[
                            { value: '', label: '— Select work schedule —' },
                            ...safeWorkSchedules.map((ws) => ({
                              value: ws.id,
                              label: ws.name,
                            })),
                          ]}
                          placeholder="Select work schedule"
                          fullWidth
                          style={{
                            background: t.input,
                            border: `1px solid ${form.formState.errors.work_schedule_id ? colors.err : t.inputBorder}`,
                            color: t.text,
                          }}
                        />
                      </div>
                    )}
                    {form.formState.errors.work_schedule_id && (
                      <p className="text-xs mt-1.5" style={{ color: colors.err }}>
                        {form.formState.errors.work_schedule_id.message}
                      </p>
                    )}
                  </label>
                </div>
              )}
            />

            {/* Job title */}
            <Controller
              name="job_title"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="block">
                    <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                      Job title{' '}
                      <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                        (optional)
                      </span>
                    </span>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeJobTitles.map((jt) => ({
                          value: jt.name,
                          label: jt.name,
                        })),
                      ]}
                      placeholder="Select job title"
                      fullWidth
                      style={{
                        background: t.input,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.text,
                      }}
                    />
                  </label>
                </div>
              )}
            />

            {/* Department */}
            <Controller
              name="department_id"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="block">
                    <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                      Department{' '}
                      <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                        (optional)
                      </span>
                    </span>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeDepartments.map((dept) => ({
                          value: dept.id,
                          label: dept.name,
                        })),
                      ]}
                      placeholder="Select department"
                      fullWidth
                      style={{
                        background: t.input,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.text,
                      }}
                    />
                  </label>
                </div>
              )}
            />

            {/* Reports to */}
            <Controller
              name="reporting_to"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="block">
                    <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                      Reports to{' '}
                      <span className="text-xs font-normal" style={{ color: t.textMuted }}>
                        (optional)
                      </span>
                    </span>
                    <EmployeeDropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      fullWidth
                      style={{
                        background: t.input,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.text,
                      }}
                    />
                  </label>
                </div>
              )}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            to="/people"
            className="text-sm font-medium px-4 py-3 hover:opacity-70 transition-opacity"
            style={{ color: t.textMuted }}
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={createMutation.isPending || !form.formState.isValid}
            data-testid="people-submit-btn"
            className="flex items-center gap-2 text-sm font-semibold px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{
              background: colors.accent,
              color: '#FFFFFF',
            }}
          >
            <Check size={16} />
            {createMutation.isPending ? 'Adding…' : 'Add Employee'}
          </button>
        </div>

        {/* Error message */}
        {createMutation.isError && (
          <div
            className="rounded-lg p-4"
            data-testid="people-new-error"
            style={{
              background: colors.errDim,
              border: `1px solid ${colors.err}20`,
            }}
          >
            <p className="text-sm font-medium" style={{ color: colors.err }}>
              {apiErrorMessage(createMutation.error)}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
