import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useEmployee, useCreateEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds } from '@/design/tokens'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app/people/$id')({
  component: EmployeeDetailPage,
})

const employeeSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  email: z.email('Invalid email'),
  phone: z.string().max(20).optional().or(z.literal('')),
  job_title: z.string().max(150).optional().or(z.literal('')),
  department_id: z.string().optional().or(z.literal('')),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  start_date: z.string().min(1, 'Start date is required'),
})

type EmployeeForm = z.infer<typeof employeeSchema>

function EmployeeDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { data: employee, isLoading } = useEmployee(isNew ? '' : id)
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee(id)

  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: '',
      email: '',
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
        email: employee.email,
        phone: employee.phone ?? '',
        job_title: employee.job_title ?? '',
        department_id: employee.department_id ?? '',
        employment_type: employee.employment_type,
        start_date: employee.start_date,
      })
    }
  }, [employee, form])

  const onSubmit = (data: EmployeeForm) => {
    const clean = {
      ...data,
      phone: data.phone || undefined,
      job_title: data.job_title || undefined,
      department_id: data.department_id || undefined,
    }

    if (isNew) {
      createMutation.mutate(clean, {
        onSuccess: () => navigate({ to: '/people' }),
      })
    } else {
      updateMutation.mutate(clean, {
        onSuccess: () => navigate({ to: '/people' }),
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isNew && isLoading) {
    return (
      <div
        className="min-h-screen px-6 py-8"
        style={{ background: moduleBackgrounds.people }}
      >
        <p className="text-sm text-ink-500">Loading...</p>
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

      {!isNew && employee && (
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

      {isNew && (
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900 mb-6">
          Add Employee
        </h1>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <Field label="Full name" error={form.formState.errors.full_name?.message}>
          <input
            className="form-input"
            {...form.register('full_name')}
          />
        </Field>

        <Field label="Email" error={form.formState.errors.email?.message}>
          <input
            type="email"
            className="form-input"
            {...form.register('email')}
          />
        </Field>

        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <input
            className="form-input"
            {...form.register('phone')}
          />
        </Field>

        <Field label="Job title" error={form.formState.errors.job_title?.message}>
          <input
            className="form-input"
            {...form.register('job_title')}
          />
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
          <input
            type="date"
            className="form-input"
            {...form.register('start_date')}
          />
        </Field>

        <button
          type="submit"
          disabled={isPending}
          className="bg-accent text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving...' : isNew ? 'Add Employee' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-err mt-1">{error}</p>}
    </div>
  )
}
