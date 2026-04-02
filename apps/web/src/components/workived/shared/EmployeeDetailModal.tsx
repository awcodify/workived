import { useEffect } from 'react'
import { useEmployee } from '@/lib/hooks/useEmployees'
import { Avatar } from '@/components/workived/layout/Avatar'
import { moduleThemes, colors } from '@/design/tokens'
import {
  X,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  Clock,
  Users,
  UserCheck,
  Building2,
} from 'lucide-react'
import { Skeleton } from './Skeleton'

const t = moduleThemes.attendance

interface EmployeeDetailModalProps {
  employeeId: string
  onClose: () => void
}

export function EmployeeDetailModal({ employeeId, onClose }: EmployeeDetailModalProps) {
  const { data: employee, isLoading } = useEmployee(employeeId)

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  // Get status badge styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: colors.okDim, color: colors.okText, label: 'Active' }
      case 'probation':
        return { bg: colors.warnDim, color: colors.warnText, label: 'Probation' }
      case 'inactive':
        return { bg: colors.errDim, color: colors.errText, label: 'Inactive' }
      default:
        return { bg: t.border, color: t.textMuted, label: status }
    }
  }

  const getEmploymentTypeLabel = (type: string) => {
    switch (type) {
      case 'full_time':
        return 'Full-time'
      case 'part_time':
        return 'Part-time'
      case 'contract':
        return 'Contract'
      case 'intern':
        return 'Intern'
      default:
        return type
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: t.surface }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
        >
          <h2 className="text-lg font-bold" style={{ color: t.text }}>
            Employee Details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X size={20} style={{ color: t.textMuted }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <EmployeeDetailSkeleton />
          ) : employee ? (
            <>
              {/* Employee Header */}
              <div className="flex items-start gap-4">
                <Avatar id={employee.id} name={employee.full_name} size={80} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-1" style={{ color: t.text }}>
                    {employee.full_name}
                  </h3>
                  {employee.job_title && (
                    <p className="text-sm font-medium mb-2" style={{ color: t.textMuted }}>
                      {employee.job_title}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={employee.status} />
                    <TypeBadge type={employee.employment_type} />
                    {employee.invitation_pending && (
                      <span
                        className="text-xs font-bold uppercase px-2 py-1 rounded-full"
                        style={{ background: colors.warnDim, color: colors.warnText }}
                      >
                        Invitation Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                  icon={<Mail size={18} style={{ color: colors.accent }} />}
                  label="Email"
                  value={employee.email || 'Not provided'}
                />
                <InfoCard
                  icon={<Phone size={18} style={{ color: colors.accent }} />}
                  label="Phone"
                  value={employee.phone || 'Not provided'}
                />
                <InfoCard
                  icon={<Building2 size={18} style={{ color: colors.accent }} />}
                  label="Department"
                  value={employee.department_name || 'Not assigned'}
                />
                <InfoCard
                  icon={<Users size={18} style={{ color: colors.accent }} />}
                  label="Reports to"
                  value={employee.manager_name || 'No manager'}
                />
                <InfoCard
                  icon={<Clock size={18} style={{ color: colors.accent }} />}
                  label="Work Schedule"
                  value={employee.work_schedule_name || 'Default schedule'}
                />
                <InfoCard
                  icon={<UserCheck size={18} style={{ color: colors.accent }} />}
                  label="Gender"
                  value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : 'Not specified'}
                />
              </div>

              {/* Employment Details */}
              <div
                className="rounded-xl p-4"
                style={{ background: t.border }}
              >
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: t.text }}>
                  <Briefcase size={16} style={{ color: colors.accent }} />
                  Employment Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                      Start Date
                    </p>
                    <p className="text-sm font-semibold" style={{ color: t.text }}>
                      {formatDate(employee.start_date)}
                    </p>
                  </div>
                  {employee.end_date && (
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                        End Date
                      </p>
                      <p className="text-sm font-semibold" style={{ color: t.text }}>
                        {formatDate(employee.end_date)}
                      </p>
                    </div>
                  )}
                  {employee.base_salary && (
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                        Base Salary
                      </p>
                      <p className="text-sm font-semibold" style={{ color: t.text }}>
                        {employee.salary_currency} {(employee.base_salary / 100).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                      Employment Type
                    </p>
                    <p className="text-sm font-semibold" style={{ color: t.text }}>
                      {getEmploymentTypeLabel(employee.employment_type)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs" style={{ color: t.textMuted }}>
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Created {formatDate(employee.created_at)}</span>
                </div>
                {employee.updated_at !== employee.created_at && (
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Updated {formatDate(employee.updated_at)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm font-medium" style={{ color: t.textMuted }}>
                Employee not found
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = {
    active: { bg: colors.okDim, color: colors.okText, label: 'Active' },
    probation: { bg: colors.warnDim, color: colors.warnText, label: 'Probation' },
    inactive: { bg: colors.errDim, color: colors.errText, label: 'Inactive' },
  }[status] || { bg: t.border, color: t.textMuted, label: status }

  return (
    <span
      className="text-xs font-bold uppercase px-2.5 py-1 rounded-full"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    intern: 'Intern',
  }

  return (
    <span
      className="text-xs font-bold uppercase px-2.5 py-1 rounded-full"
      style={{ background: colors.accentDim, color: colors.accentText }}
    >
      {labels[type] || type}
    </span>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium" style={{ color: t.textMuted }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: t.text }}>
        {value}
      </p>
    </div>
  )
}

function EmployeeDetailSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton width={80} height={80} borderRadius={12} />
        <div className="flex-1">
          <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginBottom: 12 }} />
          <div className="flex gap-2">
            <Skeleton width={80} height={24} borderRadius={999} />
            <Skeleton width={80} height={24} borderRadius={999} />
          </div>
        </div>
      </div>

      {/* Info cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{ border: `1px solid ${t.border}` }}
          >
            <Skeleton width={100} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} />
          </div>
        ))}
      </div>

      {/* Employment details skeleton */}
      <div className="rounded-xl p-4" style={{ background: t.border }}>
        <Skeleton width={150} height={16} style={{ marginBottom: 12 }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={80} height={12} style={{ marginBottom: 4 }} />
              <Skeleton width="60%" height={14} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
