import { createFileRoute } from '@tanstack/react-router'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useAuthStore } from '@/lib/stores/auth'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds, moduleThemes, colors, typography } from '@/design/tokens'
import { ArrowLeft, Mail, Phone, Briefcase, Building2, Calendar, Users } from 'lucide-react'
import { Link } from '@tanstack/react-router'

const t = moduleThemes.people

export const Route = createFileRoute('/_app/profile/')({
  component: MyProfilePage,
})

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: colors.ink50 }}
      >
        <Icon size={15} style={{ color: colors.ink500 }} />
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 12, color: colors.ink500, fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 14, color: t.text, fontWeight: 600, marginTop: 2 }}>{value}</p>
      </div>
    </div>
  )
}

function MyProfilePage() {
  const { data: employee, isLoading, error } = useMyEmployee()
  const user = useAuthStore((s) => s.user)

  if (isLoading) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10"
        style={{ background: moduleBackgrounds.people, paddingBottom: '160px' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Skeleton header */}
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 rounded" style={{ background: colors.ink100 }} />
            <div className="flex items-center gap-4 mt-8">
              <div className="w-20 h-20 rounded-2xl" style={{ background: colors.ink100 }} />
              <div className="space-y-2">
                <div className="h-6 w-48 rounded" style={{ background: colors.ink100 }} />
                <div className="h-4 w-32 rounded" style={{ background: colors.ink100 }} />
              </div>
            </div>
            <div className="mt-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-xl" style={{ background: colors.ink100 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10"
        style={{ background: moduleBackgrounds.people, paddingBottom: '160px' }}
      >
        <div className="max-w-2xl mx-auto">
          <Link
            to="/overview"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
            style={{ color: colors.ink500 }}
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div
            className="p-8 rounded-2xl text-center"
            style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
          >
            <p style={{ fontSize: 15, color: colors.ink500 }}>
              Unable to load your profile. Please try again later.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const statusColor = employee.status === 'active'
    ? colors.ok
    : employee.status === 'probation'
      ? colors.warn
      : colors.ink300

  const employmentLabel: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    intern: 'Intern',
  }

  const genderLabel: Record<string, string> = {
    male: 'Male',
    female: 'Female',
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people, paddingBottom: '160px' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          to="/overview"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
          style={{ color: colors.ink500 }}
        >
          <ArrowLeft size={16} /> Back
        </Link>

        {/* Header card */}
        <div
          className="p-6 rounded-2xl mb-4"
          style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
        >
          <div className="flex items-center gap-5">
            <Avatar
              name={employee.full_name}
              id={employee.id}
              size={72}
              borderRadius={18}
            />
            <div className="min-w-0 flex-1">
              <h1
                style={{
                  fontSize: typography.display.size,
                  fontWeight: 800,
                  letterSpacing: typography.display.tracking,
                  color: t.text,
                  lineHeight: 1.2,
                }}
              >
                {employee.full_name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                {employee.job_title && (
                  <p style={{ fontSize: 14, color: colors.ink500 }}>{employee.job_title}</p>
                )}
                {employee.job_title && employee.department_name && (
                  <span style={{ color: colors.ink300 }}>·</span>
                )}
                {employee.department_name && (
                  <p style={{ fontSize: 14, color: colors.ink500 }}>{employee.department_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusSquare color={statusColor} size={7} />
                <span style={{ fontSize: 13, color: colors.ink500, textTransform: 'capitalize' }}>
                  {employee.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact information */}
        <div
          className="p-5 rounded-2xl mb-4"
          style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>
            Contact
          </h2>
          <InfoRow icon={Mail} label="Email" value={employee.email ?? user?.email} />
          <InfoRow icon={Phone} label="Phone" value={employee.phone} />
          {!employee.email && !user?.email && !employee.phone && (
            <p style={{ fontSize: 13, color: colors.ink300, paddingTop: 8 }}>
              No contact information on file.
            </p>
          )}
        </div>

        {/* Employment details */}
        <div
          className="p-5 rounded-2xl mb-4"
          style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>
            Employment
          </h2>
          <InfoRow
            icon={Briefcase}
            label="Employment type"
            value={employmentLabel[employee.employment_type] ?? employee.employment_type}
          />
          <InfoRow icon={Building2} label="Department" value={employee.department_name} />
          <InfoRow icon={Users} label="Reports to" value={employee.manager_name} />
          <InfoRow
            icon={Calendar}
            label="Start date"
            value={employee.start_date ? new Date(employee.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined}
          />
          {employee.gender && (
            <InfoRow
              icon={Users}
              label="Gender"
              value={genderLabel[employee.gender] ?? employee.gender}
            />
          )}
        </div>

        {/* Read-only notice */}
        <p className="text-center mt-4" style={{ fontSize: 12, color: colors.ink300 }}>
          To update your profile, please contact your HR administrator.
        </p>
      </div>
    </div>
  )
}
