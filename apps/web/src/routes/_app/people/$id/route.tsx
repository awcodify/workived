import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useState, useEffect } from 'react'
import { useEmployee, useCreateEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { useUnlinkedMembers } from '@/lib/hooks/useInvitations'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds } from '@/design/tokens'
import { ArrowLeft, UserCheck, UserPlus, Mail } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/people/$id')({
  component: EmployeeDetailPage,
})

// ── Schemas ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  job_title: z.string().max(150).optional().or(z.literal('')),
  department_id: z.string().optional().or(z.literal('')),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  start_date: z.string().min(1, 'Start date is required'),
})

// Edit form keeps the original email field (display only, not editable)
const editSchema = baseSchema

// New employee form — email is optional; user_id links to an existing member
const newSchema = baseSchema.extend({
  // 'member' = link existing workspace member, 'new' = type a new email, 'skip' = no email
  email_mode: z.enum(['member', 'new', 'skip']),
  selected_user_id: z.string().optional(),
  email: z.string().optional(),
})

type EditForm = z.infer<typeof editSchema>
type NewForm = z.infer<typeof newSchema>

// ── Page ─────────────────────────────────────────────────────────────────────

function EmployeeDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  if (isNew) return <NewEmployeePage />
  return <EditEmployeePage id={id} />
}

// ── New Employee ─────────────────────────────────────────────────────────────

function NewEmployeePage() {
  const navigate = useNavigate()
  const createMutation = useCreateEmployee()
  const { data: unlinkedMembers = [], isLoading: loadingMembers } = useUnlinkedMembers()

  const form = useForm<NewForm>({
    resolver: zodResolver(newSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      job_title: '',
      department_id: '',
      employment_type: 'full_time',
      start_date: '',
      email_mode: 'member',
      selected_user_id: '',
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
      phone: data.phone || undefined,
      job_title: data.job_title || undefined,
      department_id: data.department_id || undefined,
      employment_type: data.employment_type,
      start_date: data.start_date,
    }

    createMutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/people' }),
    })
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people }}
    >
      <Link
        to="/people"
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 mb-6"
      >
        <ArrowLeft size={16} />
        Back to People
      </Link>

      <h1 className="text-xl font-extrabold tracking-tight text-ink-900 mb-6">
        Add Employee
      </h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        {/* ── Email / Login access section ───────────────────────────── */}
        <div className="rounded-xl border border-ink-100 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-ink-900">Login access</p>

          <Controller
            control={form.control}
            name="email_mode"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {/* Option A: link to an existing workspace member */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    value="member"
                    checked={field.value === 'member'}
                    onChange={() => {
                      field.onChange('member')
                      form.setValue('email', '')
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      <UserCheck size={15} />
                      Link to a workspace member
                    </span>
                    <span className="text-xs text-ink-500">
                      They already have login access — just add their HR record.
                    </span>
                  </span>
                </label>

                {/* Option B: invite by email */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    value="new"
                    checked={field.value === 'new'}
                    onChange={() => {
                      field.onChange('new')
                      form.setValue('selected_user_id', '')
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      <UserPlus size={15} />
                      Invite by email
                    </span>
                    <span className="text-xs text-ink-500">
                      They'll receive a link to join the workspace.
                    </span>
                  </span>
                </label>

                {/* Option C: skip */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    value="skip"
                    checked={field.value === 'skip'}
                    onChange={() => {
                      field.onChange('skip')
                      form.setValue('selected_user_id', '')
                      form.setValue('email', '')
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      <Mail size={15} />
                      No login access yet
                    </span>
                    <span className="text-xs text-ink-500">
                      Add the HR record now; invite them later from Settings → Members.
                    </span>
                  </span>
                </label>
              </div>
            )}
          />

          {/* Member selector */}
          {emailMode === 'member' && (
            <div>
              {loadingMembers ? (
                <p className="text-xs text-ink-500">Loading workspace members…</p>
              ) : unlinkedMembers.length === 0 ? (
                <p className="text-xs text-ink-500">
                  All workspace members already have an HR record.
                </p>
              ) : (
                <Field
                  label="Select member"
                  error={form.formState.errors.selected_user_id?.message}
                >
                  <select
                    className="form-input"
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
            <Field label="Email to invite" error={form.formState.errors.email?.message}>
              <input
                type="email"
                className="form-input"
                placeholder="name@company.com"
                {...form.register('email')}
              />
            </Field>
          )}
        </div>

        {/* ── HR record fields ────────────────────────────────────────── */}
        <Field label="Full name" error={form.formState.errors.full_name?.message}>
          <input className="form-input" {...form.register('full_name')} />
        </Field>

        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <input className="form-input" {...form.register('phone')} />
        </Field>

        <Field label="Job title" error={form.formState.errors.job_title?.message}>
          <input className="form-input" {...form.register('job_title')} />
        </Field>

        <Field label="Employment type" error={form.formState.errors.employment_type?.message}>
          <select className="form-input" {...form.register('employment_type')}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </Field>

        <Field label="Start date" error={form.formState.errors.start_date?.message}>
          <input type="date" className="form-input" {...form.register('start_date')} />
        </Field>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-accent text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add Employee'}
        </button>

        {createMutation.isError && (
          <p className="text-xs text-err">
            Something went wrong. Please try again.
          </p>
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

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      job_title: '',
      department_id: '',
      employment_type: 'full_time',
      start_date: '',
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        full_name: employee.full_name,
        phone: employee.phone ?? '',
        job_title: employee.job_title ?? '',
        department_id: employee.department_id ?? '',
        employment_type: employee.employment_type,
        start_date: employee.start_date,
      })
    }
  }, [employee, form])

  const onSubmit = (data: EditForm) => {
    const clean = {
      ...data,
      phone: data.phone || undefined,
      job_title: data.job_title || undefined,
      department_id: data.department_id || undefined,
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
        <p className="text-sm text-ink-500">Loading…</p>
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
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 mb-6"
      >
        <ArrowLeft size={16} />
        Back to People
      </Link>

      {employee && (
        <div className="flex items-center gap-3 mb-6">
          <Avatar name={employee.full_name} id={employee.id} size={48} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
              {employee.full_name}
            </h1>
            <StatusSquare status={employee.status} />
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <Field label="Full name" error={form.formState.errors.full_name?.message}>
          <input className="form-input" {...form.register('full_name')} />
        </Field>

        {employee?.email && (
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
            <p className="text-sm text-ink-500 py-2">{employee.email}</p>
          </div>
        )}

        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <input className="form-input" {...form.register('phone')} />
        </Field>

        <Field label="Job title" error={form.formState.errors.job_title?.message}>
          <input className="form-input" {...form.register('job_title')} />
        </Field>

        <Field label="Employment type" error={form.formState.errors.employment_type?.message}>
          <select className="form-input" {...form.register('employment_type')}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </Field>

        <Field label="Start date" error={form.formState.errors.start_date?.message}>
          <input type="date" className="form-input" {...form.register('start_date')} />
        </Field>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-accent text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>

        {updateMutation.isError && (
          <p className="text-xs text-err">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-err mt-1">{error}</p>}
    </div>
  )
}
