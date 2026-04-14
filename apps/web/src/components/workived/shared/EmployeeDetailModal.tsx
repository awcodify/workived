import { useEffect, useState } from 'react'
import axios from 'axios'
import { useEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { useWorkSchedules } from '@/lib/hooks/useAttendance'
import { useDepartments } from '@/lib/hooks/useDepartments'
import { useJobTitles } from '@/lib/hooks/useJobTitles'
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock'
import { Avatar } from '@/components/workived/layout/Avatar'
import { Dropdown, type DropdownOption } from './Dropdown'
import { EmployeeDropdown } from './EmployeeDropdown'
import { EmploymentHistoryTab } from './EmploymentHistoryTab'
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
  FileText,
  DollarSign,
  History,
} from 'lucide-react'
import { Skeleton } from './Skeleton'
import type { Employee } from '@/types/api'

const t = moduleThemes.attendance

type TabType = 'detail' | 'payroll' | 'history'

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
  const { data: workSchedules = [] } = useWorkSchedules()
  const { data: departments } = useDepartments()
  const { data: jobTitles } = useJobTitles()
  const updateEmployee = useUpdateEmployee(employeeId)
  
  // Lock body scroll when modal is open
  useBodyScrollLock()
  
  // Safely handle null/undefined data
  const safeDepartments = departments ?? []
  const safeJobTitles = jobTitles ?? []
  
  const [activeTab, setActiveTab] = useState<TabType>('detail')
  const [isEditMode, setIsEditMode] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const updateFormData = (patch: Partial<typeof formData>) => {
    setSaveError(null)
    setFormData((prev) => ({ ...prev, ...patch }))
  }
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
        e.preventDefault()
        e.stopPropagation()
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
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
      })
      setIsEditMode(false)
      setShowConfirmation(false)
    } catch (error) {
      setShowConfirmation(false)
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.error?.message
        setSaveError(typeof msg === 'string' && msg.length > 0 ? msg : 'Failed to save changes. Please try again.')
      } else {
        setSaveError('Failed to save changes. Please try again.')
      }
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
    setSaveError(null)
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

  const scheduleOptions: DropdownOption[] = [
    { value: '', label: 'Default schedule' },
    ...workSchedules.map(ws => ({
      value: ws.id,
      label: ws.name,
      badge: ws.is_default ? 'default' : undefined,
    })),
  ]

  const departmentOptions: DropdownOption[] = [
    { value: '', label: 'Not assigned' },
    ...safeDepartments.map(dept => ({
      value: dept.id,
      label: dept.name,
    })),
  ]

  const jobTitleOptions: DropdownOption[] = [
    { value: '', label: 'Not specified' },
    ...safeJobTitles.map(jt => ({
      value: jt.name,
      label: jt.name,
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

        {/* Save error banner */}
        {saveError && (
          <div
            className="px-6 py-2.5 text-sm font-medium"
            style={{ background: `${colors.err}15`, color: colors.err, borderBottom: `1px solid ${colors.err}30` }}
          >
            {saveError}
          </div>
        )}

        {/* Tabs */}
        {!isEditMode && (
          <div
            className="sticky top-[73px] z-10 px-6 flex items-center gap-1 border-b"
            style={{ background: t.surface, borderColor: t.border }}
          >
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'detail' ? '' : 'hover:bg-black/5'
              }`}
              style={{
                color: activeTab === 'detail' ? t.accent : t.textMuted,
              }}
            >
              <FileText size={16} />
              Detail
              {activeTab === 'detail' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: t.accent }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'payroll' ? '' : 'hover:bg-black/5'
              }`}
              style={{
                color: activeTab === 'payroll' ? t.accent : t.textMuted,
              }}
            >
              <DollarSign size={16} />
              Payroll
              {activeTab === 'payroll' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: t.accent }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'history' ? '' : 'hover:bg-black/5'
              }`}
              style={{
                color: activeTab === 'history' ? t.accent : t.textMuted,
              }}
            >
              <History size={16} />
              History
              {activeTab === 'history' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: t.accent }}
                />
              )}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <EmployeeDetailSkeleton />
          ) : employee ? (
            <>
              {/* Detail Tab */}
              {(isEditMode || activeTab === 'detail') && (
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
                        onChange={(e) => updateFormData({ full_name: e.target.value })}
                        className="text-xl font-bold px-2 py-1 rounded-lg focus:outline-none focus:ring-2 w-full"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                          color: t.text,
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Dropdown
                          value={formData.status}
                          onChange={(value) => updateFormData({ status: value })}
                          options={statusOptions}
                        />
                        <Dropdown
                          value={formData.job_title}
                          onChange={(value) => updateFormData({ job_title: value })}
                          options={jobTitleOptions}
                          placeholder="Select job title"
                        />
                      </div>
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
                    {!isEditMode && (
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

              {/* Personal Information */}
              <div>
                <h4 className="text-sm font-bold mb-3" style={{ color: t.text }}>
                  Personal Information
                </h4>
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
                          onChange={(e) => updateFormData({ phone: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                          style={{
                            background: t.input,
                            border: `1px solid ${t.inputBorder}`,
                            color: t.text,
                          }}
                        />
                      </div>
                      <Dropdown
                        label="Gender"
                        value={formData.gender}
                        onChange={(value) => updateFormData({ gender: value })}
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
                        icon={<UserCheck size={18} style={{ color: colors.accent }} />}
                        label="Gender"
                        value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : 'Not specified'}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Organizational Structure */}
              <div>
                <h4 className="text-sm font-bold mb-3" style={{ color: t.text }}>
                  Organizational Structure
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isEditMode ? (
                    <>
                      <Dropdown
                        label="Department"
                        value={formData.department_id}
                        onChange={(value) => updateFormData({ department_id: value })}
                        options={departmentOptions}
                        fullWidth
                      />
                      <EmployeeDropdown
                        label="Reports to"
                        value={formData.reporting_to}
                        onChange={(value) => updateFormData({ reporting_to: value })}
                        excludeEmployeeId={employeeId}
                        fullWidth
                      />
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Employment Terms */}
              <div>
                <h4 className="text-sm font-bold mb-3" style={{ color: t.text }}>
                  Employment Terms
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isEditMode ? (
                    <>
                      <Dropdown
                        label="Employment Type"
                        value={formData.employment_type}
                        onChange={(value) => updateFormData({ employment_type: value })}
                        options={employmentTypeOptions}
                        fullWidth
                      />
                      <Dropdown
                        label="Work Schedule"
                        value={formData.work_schedule_id}
                        onChange={(value) => updateFormData({ work_schedule_id: value })}
                        options={scheduleOptions}
                        fullWidth
                      />
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => updateFormData({ start_date: e.target.value })}
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
                          onChange={(e) => updateFormData({ end_date: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                          style={{
                            background: t.input,
                            border: `1px solid ${t.inputBorder}`,
                            color: t.text,
                          }}
                        />
                      </div>
                      {employee.base_salary && (
                        <InfoCard
                          icon={<DollarSign size={18} style={{ color: colors.accent }} />}
                          label="Base Salary"
                          value={`${employee.salary_currency} ${(employee.base_salary / 100).toLocaleString()}`}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <InfoCard
                        icon={<Briefcase size={18} style={{ color: colors.accent }} />}
                        label="Employment Type"
                        value={getEmploymentTypeLabel(employee.employment_type)}
                      />
                      <InfoCard
                        icon={<Clock size={18} style={{ color: colors.accent }} />}
                        label="Work Schedule"
                        value={employee.work_schedule_name || 'Default schedule'}
                      />
                      <InfoCard
                        icon={<Calendar size={18} style={{ color: colors.accent }} />}
                        label="Start Date"
                        value={formatDate(employee.start_date)}
                      />
                      <InfoCard
                        icon={<Calendar size={18} style={{ color: colors.accent }} />}
                        label="End Date"
                        value={formatDate(employee.end_date)}
                      />
                      {employee.base_salary && (
                        <InfoCard
                          icon={<DollarSign size={18} style={{ color: colors.accent }} />}
                          label="Base Salary"
                          value={`${employee.salary_currency} ${(employee.base_salary / 100).toLocaleString()}`}
                        />
                      )}
                    </>
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
              )}

              {/* Payroll Tab */}
              {activeTab === 'payroll' && !isEditMode && (
                <div className="text-center py-12">
                  <DollarSign size={48} style={{ color: t.textMuted }} className="mx-auto mb-4 opacity-30" />
                  <p style={{ color: t.textMuted }} className="text-sm">
                    Payroll features coming soon
                  </p>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && !isEditMode && (
                <EmploymentHistoryTab employeeId={employeeId} />
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
