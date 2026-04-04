import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useEffect } from 'react'
import { useEmployee, useCreateEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { useWorkSchedules } from '@/lib/hooks/useAttendance'
import { useUnlinkedMembers, useInviteMember } from '@/lib/hooks/useInvitations'
import { useDepartments } from '@/lib/hooks/useDepartments'
import { useJobTitles } from '@/lib/hooks/useJobTitles'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { EmployeeDropdown } from '@/components/workived/shared/EmployeeDropdown'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import { moduleBackgrounds, moduleThemes, colors } from '@/design/tokens'
import { ArrowLeft, UserCheck, UserPlus, Mail, AlertTriangle, Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import axios from 'axios'

const t = moduleThemes.people

export const Route = createFileRoute('/_app/people/$id')({
  component: EmployeeDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    user_id: typeof search.user_id === 'string' ? search.user_id : undefined,
  }),
})

// ── Schemas ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  job_title: z.string().max(150).optional().or(z.literal('')),
  department_id: z.string().optional().or(z.literal('')),
  reporting_to: z.string().optional().or(z.literal('')),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date is required'),
})

// Edit form adds status, end_date, and work_schedule_id fields
const editSchema = baseSchema.extend({
  status: z.enum(['active', 'probation', 'on_leave', 'inactive']),
  end_date: z.string().optional().or(z.literal('')),
  work_schedule_id: z.string().optional().or(z.literal('')),
})

// New employee form — email is optional; user_id links to an existing member
const newSchema = baseSchema.extend({
  // 'member' = link existing workspace member, 'new' = type a new email, 'skip' = no email
  email_mode: z.enum(['member', 'new', 'skip']),
  selected_user_id: z.string().optional(),
  email: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.email_mode === 'new' && (!data.email || data.email.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email should be filled',
      path: ['email'],
    })
  }
  if (data.email_mode === 'skip') {
    // No email validation needed
  }
})

type EditForm = z.infer<typeof editSchema>
type NewForm = z.infer<typeof newSchema>

function apiErrorMessage(err: Error | null): string {
  if (!err) return 'Something went wrong. Please try again.'
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error?.message
    if (typeof msg === 'string' && msg.length > 0) return msg
  }
  return 'Something went wrong. Please try again.'
}

// ── Page ─────────────────────────────────────────────────────────────────────

function EmployeeDetailPage() {
  const { id } = Route.useParams()
  const isNew = id === 'new'

  if (isNew) return <NewEmployeePage />
  return <EditEmployeePage id={id} />
}

// ── New Employee ─────────────────────────────────────────────────────────────

function NewEmployeePage() {
  const navigate = useNavigate()
  const { user_id: preselectedUserId } = Route.useSearch()
  const createMutation = useCreateEmployee()
  const inviteMutation = useInviteMember()
  const { data: unlinkedMembers = [], isLoading: loadingMembers } = useUnlinkedMembers()
  const { data: departments } = useDepartments()
  const { data: jobTitles } = useJobTitles()
  
  // Safely handle null/undefined data
  const safeDepartments = departments ?? []
  const safeJobTitles = jobTitles ?? []

  const form = useForm<NewForm>({
    resolver: zodResolver(newSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      job_title: '',
      department_id: '',
      reporting_to: '',
      employment_type: 'full_time',
      gender: '',
      start_date: '',
      // If arriving from Members page with a user_id, pre-select member mode
      email_mode: preselectedUserId ? 'member' : 'member',
      selected_user_id: preselectedUserId ?? '',
      email: '',
    },
  })

  const emailMode = form.watch('email_mode')
  const selectedUserId = form.watch('selected_user_id')

  // When a workspace member is selected, auto-fill their name
  useEffect(() => {
    if (emailMode !== 'member' || !selectedUserId) return
    const member = unlinkedMembers.find((m) => m.user_id === selectedUserId)
    if (member && !form.getValues('full_name')) {
      form.setValue('full_name', member.full_name)
    }
  }, [selectedUserId, emailMode, unlinkedMembers, form])

  const onSubmit = (data: NewForm) => {
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
    }

    createMutation.mutate(payload, {
      onSuccess: (employee) => {
        if (data.email_mode === 'new' && data.email) {
          // Send workspace invitation — employee_id links the invite to the new HR record
          inviteMutation.mutate(
            { email: data.email, role: 'member', employee_id: employee.id },
            { onSettled: () => navigate({ to: '/people' }) },
          )
        } else {
          navigate({ to: '/people' })
        }
      },
    })
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people }}
    >
      <Link
        to="/people"
        className="flex items-center gap-1 text-sm mb-6"
        style={{ color: t.textMuted }}
      >
        <ArrowLeft size={16} />
        Back to People
      </Link>

      <h1 className="text-xl font-extrabold tracking-tight mb-6" style={{ color: t.text }}>
        Add Employee
      </h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-6xl space-y-6">
        {/* ── Login access section (full width) ───────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h2 className="text-sm font-semibold" style={{ color: t.text }}>Login Access</h2>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: t.textMuted }}>
              Decide whether this employee needs workspace login access. <strong style={{ color: t.text }}>Workspace members</strong> (invited from Settings → Members) 
              can log in to Workived. <strong style={{ color: t.text }}>Employee profiles</strong> track attendance, leave, and HR data — they can exist with or without login access.
            </p>
          </div>

          <div className="p-5 space-y-4">
            <Controller
              control={form.control}
              name="email_mode"
              render={({ field }) => (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option A: link to an existing workspace member */}
                  <label
                    className="flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: field.value === 'member' ? colors.accent : t.border,
                      background: 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        value="member"
                        checked={field.value === 'member'}
                        onChange={() => {
                          field.onChange('member')
                          form.setValue('email', '')
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.text }}>
                        <UserCheck size={16} />
                        Link existing member
                      </span>
                    </div>
                    <p className="text-xs pl-7 leading-relaxed" style={{ color: t.textMuted }}>
                      Choose someone who already has a workspace account (invited from Settings → Members). This connects their login to this HR profile for tracking attendance, leave, and other HR data.
                    </p>
                  </label>

                  {/* Option B: invite by email */}
                  <label
                    className="flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: field.value === 'new' ? colors.accent : t.border,
                      background: 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        value="new"
                        checked={field.value === 'new'}
                        onChange={() => {
                          field.onChange('new')
                          form.setValue('selected_user_id', '')
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.text }}>
                        <Mail size={16} />
                        Invite new person
                      </span>
                    </div>
                    <p className="text-xs pl-7 leading-relaxed" style={{ color: t.textMuted }}>
                      Send an email invitation to someone new. They'll receive a link to create their account and will have both workspace access and a complete HR profile once they join.
                    </p>
                  </label>

                  {/* Option C: skip */}
                  <label
                    className="flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: field.value === 'skip' ? colors.accent : t.border,
                      background: 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        value="skip"
                        checked={field.value === 'skip'}
                        onChange={() => {
                          field.onChange('skip')
                          form.setValue('selected_user_id', '')
                          form.setValue('email', '')
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.text }}>
                        <UserPlus size={16} />
                        HR record only
                      </span>
                    </div>
                    <p className="text-xs pl-7 leading-relaxed" style={{ color: t.textMuted }}>
                      Create an HR profile without giving login access (ideal for contractors, part-time staff, or remote workers who don't need digital access). You can send an invite later if needed.
                    </p>
                  </label>
                </div>
              )}
            />

            {/* Member selector */}
            {emailMode === 'member' && (
              <div className="pt-2">
                {loadingMembers ? (
                  <p className="text-xs" style={{ color: t.textMuted }}>Loading workspace members…</p>
                ) : unlinkedMembers.length === 0 ? (
                  <div className="rounded-lg p-3 text-center" style={{ background: t.surface }}>
                    <p className="text-xs" style={{ color: t.textMuted }}>
                      All workspace members already have an HR record.
                    </p>
                  </div>
                ) : (
                  <Field
                    label="Select member"
                    error={form.formState.errors.selected_user_id?.message}
                  >
                    <select
                      className="form-input-dark"
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                      {...form.register('selected_user_id')}
                    >
                      <option value="">— choose —</option>
                      {unlinkedMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}

            {/* Free email input */}
            {emailMode === 'new' && (
              <div className="pt-2">
                <Field label="Email to invite" error={form.formState.errors.email?.message}>
                  <input
                    type="email"
                    className="form-input-dark"
                    placeholder="name@company.com"
                    style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    {...form.register('email')}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ── Personal & Employment details (two columns) ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Personal information */}
          <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-semibold" style={{ color: t.text }}>Personal Information</h2>
            </div>
            
            <div className="p-5 space-y-4">
              <Field label="Full name" error={form.formState.errors.full_name?.message}>
                <input 
                  className="form-input-dark" 
                  placeholder="e.g., Ahmad Rahman"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('full_name')} 
                />
              </Field>

              <Field label="Phone (optional)" error={form.formState.errors.phone?.message}>
                <input
                  className="form-input-dark"
                  placeholder="e.g., +62 812 3456 7890"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('phone')}
                />
              </Field>

              <Field label="Gender (optional)">
                <select
                  className="form-input-dark"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('gender')}
                >
                  <option value="">— Not specified —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Right column: Employment details */}
          <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-semibold" style={{ color: t.text }}>Employment Details</h2>
            </div>

            <div className="p-5 space-y-4">
              <Controller
                name="job_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Job title (optional)" error={fieldState.error?.message}>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeJobTitles.map((jt) => ({
                          value: jt.name,
                          label: jt.name,
                        }))
                      ]}
                      placeholder="Select job title"
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="department_id"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Department (optional)" error={fieldState.error?.message}>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeDepartments.map((dept) => ({
                          value: dept.id,
                          label: dept.name,
                        }))
                      ]}
                      placeholder="Select department"
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="reporting_to"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Reports to (optional)" error={fieldState.error?.message}>
                    <EmployeeDropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Field label="Employment type" error={form.formState.errors.employment_type?.message}>
                <select
                  className="form-input-dark"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('employment_type')}
                >
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </Field>

              <Field label="Start date" error={form.formState.errors.start_date?.message}>
                <input
                  type="date"
                  className="form-input-dark cursor-pointer"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('start_date')}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-accent text-white font-semibold text-sm px-8 py-3 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {createMutation.isPending ? 'Adding…' : 'Add Employee'}
          </button>
          
          <Link
            to="/people"
            className="text-sm font-medium px-4 py-3"
            style={{ color: t.textMuted }}
          >
            Cancel
          </Link>
        </div>

        {createMutation.isError && (
          <div className="rounded-lg bg-err/10 border border-err/20 p-4">
            <p className="text-sm text-err font-medium">
              {apiErrorMessage(createMutation.error)}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}

// ── Edit Employee ─────────────────────────────────────────────────────────────

function EditEmployeePage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: employee, isLoading } = useEmployee(id)
  const updateMutation = useUpdateEmployee(id)
  const { data: workSchedules = [] } = useWorkSchedules()
  const { data: departments } = useDepartments()
  const { data: jobTitles } = useJobTitles()
  
  // Safely handle null/undefined data
  const safeDepartments = departments ?? []
  const safeJobTitles = jobTitles ?? []

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      job_title: '',
      department_id: '',
      reporting_to: '',
      employment_type: 'full_time',
      gender: '',
      status: 'active',
      start_date: '',
      end_date: '',
      work_schedule_id: '',
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        full_name: employee.full_name,
        phone: employee.phone ?? '',
        job_title: employee.job_title ?? '',
        department_id: employee.department_id ?? '',
        reporting_to: employee.reporting_to ?? '',
        employment_type: employee.employment_type,
        gender: employee.gender ?? '',
        status: employee.status ?? 'active',
        start_date: employee.start_date,
        end_date: employee.end_date ?? '',
        work_schedule_id: employee.work_schedule_id ?? '',
      })
    }
  }, [employee, form])

  const watchedEmploymentType = form.watch('employment_type')
  const employmentTypeChanged = employee && watchedEmploymentType !== employee.employment_type

  const onSubmit = (data: EditForm) => {
    const clean = {
      ...data,
      phone: data.phone || undefined,
      job_title: data.job_title || undefined,
      department_id: data.department_id || undefined,
      reporting_to: data.reporting_to || undefined,
      gender: data.gender === 'male' || data.gender === 'female' ? data.gender : undefined,
      end_date: data.end_date || undefined,
      work_schedule_id: data.work_schedule_id || null, // null clears the override
    }
    updateMutation.mutate(clean, {
      onSuccess: () => navigate({ to: '/people' }),
    })
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen px-6 py-8"
        style={{ background: moduleBackgrounds.people }}
      >
        <p className="text-sm" style={{ color: t.textMuted }}>Loading…</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people }}
    >
      <Link
        to="/people"
        className="flex items-center gap-1 text-sm mb-6"
        style={{ color: t.textMuted }}
      >
        <ArrowLeft size={16} />
        Back to People
      </Link>

      {employee && (
        <div className="flex items-center gap-3 mb-6">
          <Avatar name={employee.full_name} id={employee.id} size={48} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color: t.text }}>
              {employee.full_name}
            </h1>
            <StatusSquare status={employee.invitation_pending ? 'pending' : employee.status} />
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left column: Personal information + Schedule info */}
          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
                <h2 className="text-sm font-semibold" style={{ color: t.text }}>Personal Information</h2>
              </div>

              <div className="p-5 space-y-4">
                <Field label="Full name" error={form.formState.errors.full_name?.message}>
                  <input
                    className="form-input-dark"
                    placeholder="e.g., Ahmad Rahman"
                    style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    {...form.register('full_name')}
                  />
                </Field>

                {employee?.email && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>Email</label>
                    <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: t.input, color: t.text }}>
                      {employee.email}
                    </div>
                    <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                      To change the email, update it in Settings → Members
                    </p>
                  </div>
                )}

                <Field label="Phone (optional)" error={form.formState.errors.phone?.message}>
                  <input
                    className="form-input-dark"
                    placeholder="e.g., +62 812 3456 7890"
                    style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    {...form.register('phone')}
                  />
                </Field>

                <Field label="Gender (optional)">
                  <select
                    className="form-input-dark"
                    style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    {...form.register('gender')}
                  >
                    <option value="">— Not specified —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
              </div>
            </div>

            <ScheduleInfoCard
              scheduleId={form.watch('work_schedule_id') || employee?.work_schedule_id || undefined}
              schedules={workSchedules}
            />
          </div>

          {/* Right column: Employment details */}
          <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <h2 className="text-sm font-semibold" style={{ color: t.text }}>Employment Details</h2>
            </div>

            <div className="p-5 space-y-4">
              <Controller
                name="job_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Job title (optional)" error={fieldState.error?.message}>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeJobTitles.map((jt) => ({
                          value: jt.name,
                          label: jt.name,
                        }))
                      ]}
                      placeholder="Select job title"
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="department_id"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Department (optional)" error={fieldState.error?.message}>
                    <Dropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: '— Not specified —' },
                        ...safeDepartments.map((dept) => ({
                          value: dept.id,
                          label: dept.name,
                        }))
                      ]}
                      placeholder="Select department"
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="reporting_to"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field label="Reports to (optional)" error={fieldState.error?.message}>
                    <EmployeeDropdown
                      value={field.value || ''}
                      onChange={field.onChange}
                      excludeEmployeeId={id}
                      fullWidth
                      style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    />
                  </Field>
                )}
              />

              <Field label="Employment type" error={form.formState.errors.employment_type?.message}>
                <select
                  className="form-input-dark"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('employment_type')}
                >
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
                {employmentTypeChanged && (
                  <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: `${colors.warn}15`, color: colors.warn }}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>Changing employment type may affect leave and claim eligibility. New policies will apply and ineligible balances will be deactivated.</span>
                  </div>
                )}
              </Field>

              <Field label="Work schedule (optional)">
                <select
                  className="form-input-dark"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('work_schedule_id')}
                >
                  <option value="">— Use org default —</option>
                  {workSchedules.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}{ws.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                {form.watch('work_schedule_id') && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: t.textMuted }}>
                    <Clock size={12} />
                    <span>This employee uses a custom work schedule for attendance tracking</span>
                  </div>
                )}
              </Field>

              <Field label="Employment status" error={form.formState.errors.status?.message}>
                <select
                  className="form-input-dark"
                  style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                  {...form.register('status')}
                >
                  <option value="active">Active — Currently employed</option>
                  <option value="probation">Probation — Trial period</option>
                  <option value="on_leave">On Leave — Temporary absence</option>
                  <option value="inactive">Inactive — Employment ended</option>
                </select>
              </Field>

              <Field label="Start date" error={form.formState.errors.start_date?.message}>
                <input
                  type="date"
                  className="form-input-dark cursor-pointer"
                  style={{ 
                    background: t.input, 
                    border: `1px solid ${t.inputBorder}`, 
                    color: t.text,
                  }}
                  {...form.register('start_date')}
                />
              </Field>

              <Field label="End date (optional)" error={form.formState.errors.end_date?.message}>
                <input
                  type="date"
                  className="form-input-dark cursor-pointer"
                  style={{ 
                    background: t.input, 
                    border: `1px solid ${t.inputBorder}`, 
                    color: t.text,
                  }}
                  {...form.register('end_date')}
                />
                <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                  Set this when changing status to Inactive
                </p>
              </Field>
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-accent text-white font-semibold text-sm px-8 py-3 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          
          <Link
            to="/people"
            className="text-sm font-medium px-4 py-3"
            style={{ color: t.textMuted }}
          >
            Cancel
          </Link>
        </div>

        {updateMutation.isError && (
          <div className="rounded-lg bg-err/10 border border-err/20 p-4">
            <p className="text-sm text-err font-medium">
              {apiErrorMessage(updateMutation.error)}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ScheduleInfoCard({
  scheduleId,
  schedules,
}: {
  scheduleId?: string
  schedules: import('@/types/api').WorkScheduleListItem[]
}) {
  // Resolve: explicit override → org default
  const schedule = scheduleId
    ? schedules.find((ws) => ws.id === scheduleId)
    : schedules.find((ws) => ws.is_default)

  if (!schedule) return null

  const isOverride = scheduleId ? !schedule.is_default || scheduleId === schedule.id : false
  const dayNames = [...schedule.work_days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ')

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
        <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: t.text }}>
          <Clock size={14} style={{ color: t.textMuted }} />
          Work Schedule
        </h2>
        {isOverride && (
          <span
            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: `${colors.accent}20`, color: colors.accent }}
          >
            Override
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: t.text }}>{schedule.name}</p>
          {schedule.is_default && !isOverride && (
            <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>Org default schedule</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {DAY_LABELS.map((label, idx) => (
            <div
              key={idx}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold"
              style={{
                background: schedule.work_days.includes(idx) ? colors.accent : t.input,
                color: schedule.work_days.includes(idx) ? '#fff' : t.textMuted,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: t.textMuted }}>
          {dayNames} &middot; {schedule.start_time.slice(0, 5)} &ndash; {schedule.end_time.slice(0, 5)}
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: t.textMuted }}>{label}</label>
      {children}
      {error && <p className="text-xs text-err mt-1.5 font-medium">{error}</p>}
    </div>
  )
}
