import { useEffect, useState } from 'react'
import { useEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { useWorkSchedules } from '@/lib/hooks/useAttendance'
import { Avatar } from '@/components/workived/layout/Avatar'
import { Dropdown, type DropdownOption } from './Dropdown'
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
  Edit,
  Save,
  XCircle,
} from 'lucide-react'
import { Skeleton } from './Skeleton'
import type { Employee } from '@/types/api'

const t = moduleThemes.attendance

interface EmployeeDetailModalProps {
  employeeId: string
  onClose: () => void
  canEdit?: boolean
}

interface FormData {
  full_name: string
  phone: string
  job_title: string
  employment_type: string
  status: string
  gender: string
  department_id: string
  reporting_to: string
  work_schedule_id: string
  start_date: string
  end_date: string
}

export function EmployeeDetailModal({ employeeId, onClose, canEdit = false }: EmployeeDetailModalProps) {
  const { data: employee, isLoading } = useEmployee(employeeId)
  const { data: employeesData } = useEmployees({})
  const { data: workSchedules = [] } = useWorkSchedules()
  const updateEmployee = useUpdateEmployee(employeeId)
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    phone: '',
    job_title: '',
    employment_type: 'full_time',
    status: 'active',
    gender: '',
    department_id: '',
    reporting_to: '',
    work_schedule_id: '',
    start_date: '',
    end_date: '',
  })

  // Initialize form data when employee loads
  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        phone: employee.phone || '',
        job_title: employee.job_title || '',
        employment_type: employee.employment_type || 'full_time',
        status: employee.status || 'active',
        gender: employee.gender || '',
        department_id: employee.department_id || '',
        reporting_to: employee.reporting_to || '',
        work_schedule_id: employee.work_schedule_id || '',
        start_date: employee.start_date || '',
        end_date: employee.end_date || '',
      })
    }
  }, [employee])

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditMode) {
          setIsEditMode(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose, isEditMode])

  const handleSave = async () => {
    if (!showConfirmation) {
      setShowConfirmation(true)
      return
    }
    
    try {
      await updateEmployee.mutateAsync({
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
        job_title: formData.job_title || undefined,
        employment_type: formData.employment_type as any,
        status: formData.status as any,
        gender: formData.gender as any || undefined,
        department_id: formData.department_id || undefined,
        reporting_to: formData.reporting_to || undefined,
        work_schedule_id: formData.work_schedule_id || undefined,
      })
      setIsEditMode(false)
      setShowConfirmation(false)
    } catch (error) {
      console.error('Failed to update employee:', error)
      setShowConfirmation(false)
    }
  }

  const handleCancel = () => {
    // Reset form data to original employee data
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        phone: employee.phone || '',
        job_title: employee.job_title || '',
        employment_type: employee.employment_type || 'full_time',
        status: employee.status || 'active',
        gender: employee.gender || '',
        department_id: employee.department_id || '',
        reporting_to: employee.reporting_to || '',
        work_schedule_id: employee.work_schedule_id || '',
        start_date: employee.start_date || '',
        end_date: employee.end_date || '',
      })
    }
    setIsEditMode(false)
    setShowConfirmation(false)
  }

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

  // Get managers list (exclude current employee)
  const managers = (employeesData?.data || []).filter(emp => emp.id !== employeeId)

  // Dropdown options
  const employmentTypeOptions: DropdownOption[] = [
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Intern' },
  ]

  const statusOptions: DropdownOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'probation', label: 'Probation' },
    { value: 'inactive', label: 'Inactive' },
  ]

  const genderOptions: DropdownOption[] = [
    { value: '', label: 'Not specified' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ]

  const managerOptions: DropdownOption[] = [
    { value: '', label: 'No manager' },
    ...managers.map(mgr => ({
      value: mgr.id,
      label: mgr.full_name,
    })),
  ]

  const scheduleOptions: DropdownOption[] = [
    { value: '', label: 'Default schedule' },
    ...workSchedules.map(ws => ({
      value: ws.id,
      label: ws.name,
      badge: ws.is_default ? 'default' : undefined,
    })),
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isEditMode) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl"
        style={{ background: t.surface }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
        >
          <h2 className="text-lg font-bold" style={{ color: t.text }}>
            {isEditMode ? 'Edit Employee' : 'Employee Details'}
          </h2>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={updateEmployee.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-sm font-semibold disabled:opacity-50"
                  style={{ color: t.textMuted }}
                >
                  <XCircle size={16} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateEmployee.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:opacity-90 transition-colors text-sm font-semibold disabled:opacity-50"
                  style={{ 
                    background: showConfirmation ? colors.warn : colors.accent, 
                    color: '#ffffff'
                  }}
                >
                  <Save size={16} />
                  {updateEmployee.isPending ? 'Saving...' : (showConfirmation ? 'Sure?' : 'Save')}
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-sm font-semibold"
                    style={{ color: colors.accent }}
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                >
                  <X size={20} style={{ color: t.textMuted }} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <EmployeeDetailSkeleton />
          ) : employee ? (
            <>
              {/* Employee Header - Always visible */}
              <div className="flex items-start gap-4">
                <Avatar id={employee.id} name={employee.full_name} size={80} />
                <div className="flex-1 min-w-0">
                  {isEditMode ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="text-xl font-bold px-2 py-1 rounded-lg focus:outline-none focus:ring-2 w-full"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                          color: t.text,
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Job Title"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className="text-sm font-medium px-2 py-1 rounded-lg focus:outline-none focus:ring-2 w-full"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                          color: t.textMuted,
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold mb-1" style={{ color: t.text }}>
                        {employee.full_name}
                      </h3>
                      {employee.job_title && (
                        <p className="text-sm font-medium mb-2" style={{ color: t.textMuted }}>
                          {employee.job_title}
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {isEditMode ? (
                      <>
                        <Dropdown
                          value={formData.status}
                          onChange={(value) => setFormData({ ...formData, status: value })}
                          options={statusOptions}
                        />
                        <Dropdown
                          value={formData.employment_type}
                          onChange={(value) => setFormData({ ...formData, employment_type: value })}
                          options={employmentTypeOptions}
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isEditMode ? (
                  <>
                    <InfoCard
                      icon={<Mail size={18} style={{ color: colors.accent }} />}
                      label="Email"
                      value={employee.email || 'Not provided'}
                    />
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        placeholder="Not provided"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                          color: t.text,
                        }}
                      />
                    </div>
                    <InfoCard
                      icon={<Building2 size={18} style={{ color: colors.accent }} />}
                      label="Department"
                      value={employee.department_name || 'Not assigned'}
                    />
                    <Dropdown
                      label="Reports to"
                      value={formData.reporting_to}
                      onChange={(value) => setFormData({ ...formData, reporting_to: value })}
                      options={managerOptions}
                      fullWidth
                    />
                    <Dropdown
                      label="Work Schedule"
                      value={formData.work_schedule_id}
                      onChange={(value) => setFormData({ ...formData, work_schedule_id: value })}
                      options={scheduleOptions}
                      fullWidth
                    />
                    <Dropdown
                      label="Gender"
                      value={formData.gender}
                      onChange={(value) => setFormData({ ...formData, gender: value })}
                      options={genderOptions}
                      fullWidth
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                  {isEditMode ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                          style={{
                            background: t.input,
                            border: `1px solid ${t.inputBorder}`,
                            color: t.text,
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
                          End Date
                        </label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                          style={{
                            background: t.input,
                            border: `1px solid ${t.inputBorder}`,
                            color: t.text,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                          Start Date
                        </p>
                        <p className="text-sm font-semibold" style={{ color: t.text }}>
                          {formatDate(employee.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                          End Date
                        </p>
                        <p className="text-sm font-semibold" style={{ color: t.text }}>
                          {formatDate(employee.end_date)}
                        </p>
                      </div>
                    </>
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
                  {isEditMode ? (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
                        Employment Type
                      </label>
                      <Dropdown
                        value={formData.employment_type}
                        onChange={(value) => setFormData({ ...formData, employment_type: value })}
                        options={employmentTypeOptions}
                        fullWidth
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: t.textMuted }}>
                        Employment Type
                      </p>
                      <p className="text-sm font-semibold" style={{ color: t.text }}>
                        {getEmploymentTypeLabel(employee.employment_type)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata - Always visible */}
              {!isEditMode && (
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
              )}
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
