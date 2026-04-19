import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useAuthStore } from '@/lib/stores/auth'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleThemes, colors, typography } from '@/design/tokens'
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  Users,
  FileText,
  Layers,
  Clock,
  Shield,
  Lock,
} from 'lucide-react'

const t = moduleThemes.people

export const Route = createFileRoute('/_app/profile/')({
  component: MyProfilePage,
})

// ── Types ─────────────────────────────────────────────────────
type TabType = 'overview' | 'custom-fields'

// ── Sub-components ────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: colors.ink50 }}
      >
        <Icon size={16} style={{ color: colors.ink500 }} />
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 12, color: colors.ink500, fontWeight: 500, letterSpacing: '0.01em' }}>{label}</p>
        <p style={{ fontSize: 14, color: t.text, fontWeight: 600, marginTop: 2 }}>{value}</p>
      </div>
    </div>
  )
}

function ProfileTab({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors relative whitespace-nowrap ${
        active ? '' : 'hover:bg-black/5'
      }`}
      style={{ color: active ? t.accent : t.textMuted }}
    >
      <Icon size={16} />
      {label}
      {badge && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: colors.accentDim, color: colors.accentText }}
        >
          {badge}
        </span>
      )}
      {active && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ background: t.accent }}
        />
      )}
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
    >
      <div
        className="px-5 py-3.5 border-b flex items-center gap-2"
        style={{ borderColor: colors.ink100 }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</h2>
      </div>
      <div className="px-5 py-2">
        {children}
      </div>
    </div>
  )
}

function ComingSoonPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: colors.ink50 }}
      >
        <Icon size={28} style={{ color: colors.ink300 }} />
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: t.text,
          marginBottom: 6,
        }}
      >
        {title}
      </h3>
      <p
        className="text-center max-w-xs"
        style={{ fontSize: 13, color: colors.ink500, lineHeight: 1.5 }}
      >
        {description}
      </p>
      <span
        className="mt-4 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{ background: colors.accentDim, color: colors.accentText }}
      >
        Coming Soon
      </span>
    </div>
  )
}

function QuickStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p style={{ fontSize: 11, color: colors.ink500, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 800, color: color ?? t.text, marginTop: 2, letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

function MyProfilePage() {
  const { data: employee, isLoading, error } = useMyEmployee()
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10"
        data-testid="profile-skeleton"
        style={{ background: colors.ink50, paddingBottom: '160px' }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-16 rounded" style={{ background: colors.ink100 }} />
            {/* Hero skeleton */}
            <div
              className="p-6 rounded-2xl"
              style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
            >
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl" style={{ background: colors.ink100 }} />
                <div className="space-y-2.5 flex-1">
                  <div className="h-7 w-48 rounded-lg" style={{ background: colors.ink100 }} />
                  <div className="h-4 w-36 rounded" style={{ background: colors.ink100 }} />
                  <div className="h-3.5 w-20 rounded" style={{ background: colors.ink100 }} />
                </div>
              </div>
            </div>
            {/* Tab bar skeleton */}
            <div className="flex gap-4 mt-2">
              {[80, 100, 110].map((w, i) => (
                <div key={i} className="h-8 rounded" style={{ background: colors.ink100, width: w }} />
              ))}
            </div>
            {/* Cards skeleton */}
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-5"
                style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
              >
                <div className="h-4 w-24 rounded mb-4" style={{ background: colors.ink100 }} />
                <div className="space-y-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl" style={{ background: colors.ink100 }} />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-16 rounded" style={{ background: colors.ink100 }} />
                        <div className="h-4 w-32 rounded" style={{ background: colors.ink100 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (error || !employee) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10"
        data-testid="profile-error"
        style={{ background: colors.ink50, paddingBottom: '160px' }}
      >
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
            style={{ color: colors.ink500 }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div
            className="p-10 rounded-2xl text-center"
            style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: colors.errDim }}
            >
              <Shield size={24} style={{ color: colors.err }} />
            </div>
            <p style={{ fontSize: 15, color: colors.ink500, lineHeight: 1.6 }}>
              Unable to load your profile. Please try again later.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Computed values ───────────────────────────────────────
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

  const tenure = (() => {
    if (!employee.start_date) return null
    const start = new Date(employee.start_date)
    const now = new Date()
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    // If we haven't reached the start day yet this month, subtract one
    if (now.getDate() < start.getDate()) months--
    if (months < 1) return 'Just started'
    if (months < 12) return `${months}mo`
    const y = Math.floor(months / 12)
    const m = months % 12
    return m > 0 ? `${y}y ${m}mo` : `${y}y`
  })()

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      data-testid="profile-page"
      style={{ background: colors.ink50, paddingBottom: '160px' }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
          style={{ color: colors.ink500 }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* ── Hero Card ──────────────────────────────────────── */}
        <div
          className="p-6 rounded-2xl mb-1"
          style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
        >
          <div className="flex items-center gap-5">
            <Avatar
              name={employee.full_name}
              id={employee.id}
              size={80}
            />
            <div className="min-w-0 flex-1">
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: typography.h1.tracking,
                  color: t.text,
                  lineHeight: 1.15,
                }}
              >
                {employee.full_name}
              </h1>
              {(employee.job_title || employee.department_name) && (
                <p className="mt-1.5" style={{ fontSize: 14, color: colors.ink500 }}>
                  {[employee.job_title, employee.department_name].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                <StatusSquare status={employee.status} />
                {employee.employment_type && (
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: colors.ink50, color: colors.ink500 }}
                  >
                    {employmentLabel[employee.employment_type] ?? employee.employment_type}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          {(employee.start_date || employee.email || employee.phone) && (
            <div
              className="flex items-center gap-6 mt-5 pt-5 border-t"
              style={{ borderColor: colors.ink100 }}
            >
              {tenure && <QuickStat label="Tenure" value={tenure} color={colors.accent} />}
              {employee.start_date && (
                <QuickStat
                  label="Joined"
                  value={new Date(employee.start_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
              )}
              {employee.department_name && (
                <QuickStat label="Team" value={employee.department_name} />
              )}
            </div>
          )}
        </div>

        {/* ── Tab Bar ────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 border-b mb-5 overflow-x-auto"
          style={{ borderColor: colors.ink100 }}
        >
          <ProfileTab
            icon={FileText}
            label="Overview"
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <ProfileTab
            icon={Layers}
            label="Custom Fields"
            active={activeTab === 'custom-fields'}
            onClick={() => setActiveTab('custom-fields')}
            badge="Soon"
          />
        </div>

        {/* ── Tab Content ────────────────────────────────────── */}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Contact */}
            <SectionCard title="Contact Information">
              <InfoRow icon={Mail} label="Email" value={employee.email ?? user?.email} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone} />
              {!employee.email && !user?.email && !employee.phone && (
                <p className="py-4" style={{ fontSize: 13, color: colors.ink300 }}>
                  No contact information on file.
                </p>
              )}
            </SectionCard>

            {/* Employment */}
            <SectionCard title="Employment Details">
              <InfoRow
                icon={Briefcase}
                label="Employment Type"
                value={employmentLabel[employee.employment_type] ?? employee.employment_type}
              />
              <InfoRow icon={Building2} label="Department" value={employee.department_name} />
              <InfoRow icon={Users} label="Reports To" value={employee.manager_name} />
              <InfoRow
                icon={Calendar}
                label="Start Date"
                value={
                  employee.start_date
                    ? new Date(employee.start_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : undefined
                }
              />
              {employee.end_date && (
                <InfoRow
                  icon={Calendar}
                  label="End Date"
                  value={new Date(employee.end_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                />
              )}
              {employee.work_schedule_name && (
                <InfoRow icon={Clock} label="Work Schedule" value={employee.work_schedule_name} />
              )}
              {employee.gender && (
                <InfoRow
                  icon={Users}
                  label="Gender"
                  value={genderLabel[employee.gender] ?? employee.gender}
                />
              )}
            </SectionCard>

            {/* Read-only notice */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: colors.ink50 }}
            >
              <Lock size={14} style={{ color: colors.ink300 }} />
              <p style={{ fontSize: 12, color: colors.ink500 }}>
                To update your profile, please contact your HR administrator.
              </p>
            </div>
          </div>
        )}

        {/* Custom Fields Tab */}
        {activeTab === 'custom-fields' && (
          <div
            className="rounded-2xl"
            style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
          >
            <ComingSoonPlaceholder
              icon={Layers}
              title="Custom Fields"
              description="Additional information specific to your organisation — skills, certifications, preferences, and any custom data your HR team tracks."
            />
          </div>
        )}
      </div>
    </div>
  )
}
