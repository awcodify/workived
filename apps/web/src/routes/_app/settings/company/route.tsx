import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { useOrgDetail, useUpdateOrg, useTransferOwnership } from '@/lib/hooks/useOrganisation'
import { useCanEditOrgSettings, useHasOrg } from '@/lib/hooks/useRole'
import { useMyInvitations } from '@/lib/hooks/useInvitations'
import { useScorecardConfig, useUpdateScorecardConfig } from '@/lib/hooks/useReports'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import { colors, typography, moduleBackgrounds, radius, spacing } from '@/design/tokens'
import { extractApiError, extractApiErrorDetails } from '@/lib/utils/errors'
import { extractInviteToken } from '@/lib/utils/url'
import type { MyInvitation, ScorecardConfig, ConfigUpdateInput } from '@/types/api'

export const Route = createFileRoute('/_app/settings/company')({
  component: CompanyPage,
})

// ── Zod schemas ────────────────────────────────────────────────────────────────

const companyInfoSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  slug: z
    .string()
    .min(1, 'Workspace URL is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
})

const locationSchema = z.object({
  country_code: z.string().min(2, 'Country is required').max(3),
  timezone: z.string().min(1, 'Timezone is required'),
  currency_code: z.string().min(3, 'Currency is required').max(3),
})

const transferSchema = z.object({
  new_owner_user_id: z.string().uuid('Must be a valid user ID (UUID)'),
})

type CompanyInfoForm = z.infer<typeof companyInfoSchema>
type LocationForm = z.infer<typeof locationSchema>
type TransferForm = z.infer<typeof transferSchema>

// ── Colour shortcuts ───────────────────────────────────────────────────────────

const C = {
  err: colors.err,
  errDim: colors.errDim,
  errText: colors.errText,
  ok: colors.ok,
  okDim: colors.okDim,
  okText: colors.okText,
  accent: colors.accent,
  accentDim: colors.accentDim,
  accentText: colors.accentText,
  warn: colors.warn,
  warnDim: colors.warnDim,
  warnText: colors.warnText,
}

// ── Page palette (matches landing dark-bg: #0A0A12) ──────────────────────────

const pageBg    = '#0A0A12'                            // landing --dark-bg
const surfaceBg = 'rgba(255,255,255,0.035)'            // translucent surface
const cardBg    = 'rgba(255,255,255,0.055)'            // slightly lifted surface
const text      = '#FFFFFF'                            // primary text
const textSec   = 'rgba(255,255,255,0.50)'             // secondary text
const textDim   = 'rgba(255,255,255,0.28)'             // placeholder / hint
const border    = 'rgba(255,255,255,0.06)'             // landing footer border
const inputBg   = 'rgba(255,255,255,0.05)'             // input fill
const inputBdr  = 'rgba(255,255,255,0.10)'             // input border

// ── Tab definitions ────────────────────────────────────────────────────────────

type TabId = 'general' | 'location' | 'plan' | 'attendance' | 'scorecard' | 'danger'

const TABS: { id: TabId; label: string; shortcut: string }[] = [
  { id: 'general',    label: 'General',    shortcut: '1' },
  { id: 'location',   label: 'Location',   shortcut: '2' },
  { id: 'plan',       label: 'Plan',       shortcut: '3' },
  { id: 'attendance', label: 'Attendance',  shortcut: '4' },
  { id: 'scorecard',  label: 'Scorecard',   shortcut: '5' },
  { id: 'danger',     label: 'Danger',      shortcut: '6' },
]

// ── Shared primitives ──────────────────────────────────────────────────────────

function FieldRow({ label, htmlFor, description, children }: {
  label: string; htmlFor: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-1 sm:gap-10 py-5" style={{ borderBottom: `1px solid ${border}` }}>
      <div className="pt-2">
        <label htmlFor={htmlFor} className="block" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight, letterSpacing: typography.label.tracking }}>{label}</label>
        {description && <p className="mt-1" style={{ color: textDim, fontSize: typography.label.size }}>{description}</p>}
      </div>
      <div className="max-w-lg">{children}</div>
    </div>
  )
}

function TextInput({ id, disabled, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      disabled={disabled}
      className="w-full px-3 py-2.5 transition-colors focus:outline-none focus:ring-1 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.lg, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
      {...props}
    />
  )
}

function SelectInput({ id, disabled, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  return (
    <select
      id={id}
      disabled={disabled}
      className="w-full px-3 py-2.5 transition-colors focus:outline-none focus:ring-1 appearance-none disabled:opacity-40"
      style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.lg, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
      {...props}
    >
      {children}
    </select>
  )
}

function PrimaryButton({ loading, label, testId, type = 'submit', onClick, disabled }: {
  loading: boolean; label: string; testId?: string; type?: 'submit' | 'button'; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled} data-testid={testId}
      className="px-4 py-2 transition-all disabled:opacity-40 hover:brightness-110"
      style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontFamily }}
    >
      {loading ? 'Saving...' : label}
    </button>
  )
}

function DangerButton({ loading, label, testId, type = 'submit', onClick, disabled }: {
  loading: boolean; label: string; testId?: string; type?: 'submit' | 'button'; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled} data-testid={testId}
      className="px-4 py-2 transition-all disabled:opacity-40 hover:brightness-110"
      style={{ background: C.err, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontFamily }}
    >
      {loading ? 'Saving...' : label}
    </button>
  )
}

function GhostButton({ label, testId, onClick }: { label: string; testId?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className="px-4 py-2 transition-colors hover:brightness-125"
      style={{ color: textSec, border: `1px solid ${border}`, borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontFamily }}>
      {label}
    </button>
  )
}

function Banner({ variant, message }: { variant: 'success' | 'error' | 'warning' | 'info'; message: string }) {
  const styles = {
    success: { bg: 'rgba(18,160,92,0.12)', bdr: C.ok, fg: '#6EE7B7' },
    error:   { bg: 'rgba(212,64,64,0.12)', bdr: C.err, fg: '#FCA5A5' },
    warning: { bg: 'rgba(201,123,42,0.12)', bdr: C.warn, fg: '#FCD34D' },
    info:    { bg: 'rgba(99,87,232,0.12)', bdr: C.accent, fg: colors.accentMid },
  }[variant]
  return (
    <div role="alert" aria-live="polite" className="px-4 py-3 mb-5"
      style={{ background: styles.bg, borderLeft: `3px solid ${styles.bdr}`, color: styles.fg, borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: typography.label.weight, fontFamily: typography.fontFamily }}>
      {message}
    </div>
  )
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5" style={{ color: '#FCA5A5', fontSize: typography.label.size, fontWeight: typography.label.weight }}>{message}</p>
}

// ── Section: General ───────────────────────────────────────────────────────────

function CompanyInfoSection() {
  const { data: org } = useOrgDetail()
  const updateOrg = useUpdateOrg()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<CompanyInfoForm>({
    resolver: zodResolver(companyInfoSchema),
    values: { name: org?.name ?? '', slug: org?.slug ?? '' },
  })

  const apiError = extractApiError(updateOrg.error)

  const handleSubmit = (data: CompanyInfoForm) => {
    updateOrg.mutate(data, {
      onSuccess: () => {
        setSuccessMessage('Company info saved.')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
    })
  }

  return (
    <div>
      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <form data-testid="company-settings-general-form" onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldRow label="Company name" htmlFor="company-name">
          <TextInput data-testid="company-settings-name-input" id="company-name" type="text" placeholder="Acme Corp" {...form.register('name')} />
          <ErrorText message={form.formState.errors.name?.message} />
        </FieldRow>

        <FieldRow label="Workspace URL" htmlFor="company-slug" description="Used for invitations and sharing.">
          <div className="flex items-center overflow-hidden" style={{ border: `1px solid ${inputBdr}`, borderRadius: radius.lg }}>
            <span className="flex items-center px-3 py-2.5 select-none shrink-0" style={{ color: textDim, borderRight: `1px solid ${border}`, background: inputBg, fontSize: typography.mono.size, fontFamily: typography.fontMono }}>
              my.workived.com/
            </span>
            <input
              data-testid="company-settings-slug-input"
              id="company-slug" type="text" placeholder="acme-corp"
              className="flex-1 px-3 py-2.5 focus:outline-none bg-transparent"
              style={{ color: text, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
              {...form.register('slug')}
            />
          </div>
          <ErrorText message={form.formState.errors.slug?.message} />
        </FieldRow>

        <div className="flex justify-end pt-5">
          <PrimaryButton loading={updateOrg.isPending} label="Save changes" testId="company-settings-general-save-btn" />
        </div>
      </form>
    </div>
  )
}

// ── Section: Location ──────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Jayapura (UTC+9)' },
  { value: 'Asia/Dubai', label: 'GST — Dubai (UTC+4)' },
  { value: 'Asia/Kuala_Lumpur', label: 'MYT — Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Singapore', label: 'SGT — Singapore (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
]

const COUNTRIES = [
  { value: 'ID', label: 'Indonesia' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'SG', label: 'Singapore' },
]

const CURRENCIES = [
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
]

function LocationSection() {
  const { data: org } = useOrgDetail()
  const updateOrg = useUpdateOrg()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isLocked = (org?.employee_count ?? 0) > 0

  const form = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    values: {
      country_code: org?.country_code ?? '',
      timezone: org?.timezone ?? '',
      currency_code: org?.currency_code ?? '',
    },
  })

  const apiError = extractApiError(updateOrg.error)

  const handleSubmit = (data: LocationForm) => {
    updateOrg.mutate(data, {
      onSuccess: () => {
        setSuccessMessage('Location settings saved.')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
    })
  }

  return (
    <div>
      {isLocked && <Banner variant="warning" message="Location settings are locked after employees are added." />}
      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <form data-testid="company-settings-location-form" onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldRow label="Country" htmlFor="country-code">
          {isLocked ? (
            <p id="country-code" className="pt-2" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>
              {COUNTRIES.find((c) => c.value === org?.country_code)?.label ?? org?.country_code}
            </p>
          ) : (
            <SelectInput data-testid="company-settings-country-select" id="country-code" {...form.register('country_code')}>
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectInput>
          )}
          <ErrorText message={form.formState.errors.country_code?.message} />
        </FieldRow>

        <FieldRow label="Timezone" htmlFor="timezone">
          {isLocked ? (
            <p id="timezone" className="pt-2" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>
              {TIMEZONES.find((t) => t.value === org?.timezone)?.label ?? org?.timezone}
            </p>
          ) : (
            <SelectInput data-testid="company-settings-timezone-select" id="timezone" {...form.register('timezone')}>
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectInput>
          )}
          <ErrorText message={form.formState.errors.timezone?.message} />
        </FieldRow>

        <FieldRow label="Currency" htmlFor="currency-code">
          {isLocked ? (
            <p id="currency-code" className="pt-2" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>
              {CURRENCIES.find((cur) => cur.value === org?.currency_code)?.label ?? org?.currency_code}
            </p>
          ) : (
            <SelectInput data-testid="company-settings-currency-select" id="currency-code" {...form.register('currency_code')}>
              {CURRENCIES.map((cur) => <option key={cur.value} value={cur.value}>{cur.label}</option>)}
            </SelectInput>
          )}
          <ErrorText message={form.formState.errors.currency_code?.message} />
        </FieldRow>

        {!isLocked && (
          <div className="flex justify-end pt-5">
            <PrimaryButton loading={updateOrg.isPending} label="Save location" testId="company-settings-location-save-btn" />
          </div>
        )}
      </form>
    </div>
  )
}

// ── Section: Plan ──────────────────────────────────────────────────────────────

function PlanSection() {
  const { data: org } = useOrgDetail()

  if (!org) return null

  const limit = org.plan_employee_limit ?? null
  const count = org.employee_count ?? 0
  const usagePct = limit ? Math.min((count / limit) * 100, 100) : 0
  const isNearLimit = limit ? usagePct >= 80 : false
  const planLabel = org.plan === 'free' ? 'Free' : org.plan === 'pro' ? 'Pro' : 'Enterprise'

  return (
    <div>
      {/* Plan + usage displayed as key-value rows */}
      <div className="py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center justify-between">
          <span style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Current plan</span>
          <div className="flex items-center gap-3">
            <span style={{ color: text, fontSize: typography.body.size, fontWeight: 700 }}>{planLabel}</span>
            {isNearLimit && (
              <a href="mailto:my@workived.com?subject=Upgrade to Pro"
                className="px-3 py-1 hover:brightness-110"
                style={{ background: C.accent, color: '#FFFFFF', textDecoration: 'none', borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}>
                Upgrade
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Employee usage</span>
          <span style={{ color: text, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontMono }}>
            {count}{limit ? <span style={{ color: textDim }}> / {limit}</span> : ''}
          </span>
        </div>

        {limit && (
          <div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: border }}
              role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={limit} aria-label={`${count} of ${limit} employees used`}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${usagePct}%`,
                background: isNearLimit ? C.err : C.accent,
              }} />
            </div>
            <p className="mt-2" style={{ color: textDim, fontSize: typography.label.size }}>
              {Math.round(usagePct)}% of limit used
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section: Attendance ────────────────────────────────────────────────────────

function AttendanceSection() {
  const { data: org } = useOrgDetail()
  const updateOrg = useUpdateOrg()
  const [saved, setSaved] = useState(false)
  const [probationDays, setProbationDays] = useState<string>('')

  useEffect(() => {
    if (org?.default_probation_days !== undefined) {
      setProbationDays(org.default_probation_days.toString())
    }
  }, [org?.default_probation_days])

  if (!org) return null

  const handleToggle = () => {
    updateOrg.mutate(
      { allow_web_clock_in: !org.allow_web_clock_in },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      }
    )
  }

  const handleProbationSave = () => {
    const days = parseInt(probationDays, 10)
    if (isNaN(days) || days < 0 || days > 365) return
    updateOrg.mutate(
      { default_probation_days: days },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      }
    )
  }

  return (
    <div>
      {saved && <Banner variant="success" message="Settings saved." />}

      <div className="flex items-center justify-between gap-4 py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div>
          <p style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Allow web clock in/out</p>
          <p className="mt-1" style={{ color: textDim, fontSize: typography.label.size }}>
            Employees can clock in from the web app in addition to mobile.
          </p>
        </div>
        <button
          id="allow-web-clock-in"
          data-testid="company-settings-web-clock-in-toggle"
          role="switch"
          aria-checked={org.allow_web_clock_in}
          onClick={handleToggle}
          disabled={updateOrg.isPending}
          className="relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-1 disabled:opacity-40 shrink-0"
          style={{ width: 44, height: 24, background: org.allow_web_clock_in ? C.accent : 'rgba(255,255,255,0.12)' }}
        >
          <span className="inline-block rounded-full bg-white transition-transform"
            style={{ width: 18, height: 18, transform: org.allow_web_clock_in ? 'translateX(22px)' : 'translateX(3px)' }} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 py-5">
        <div>
          <p style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Default probation period</p>
          <p className="mt-1" style={{ color: textDim, fontSize: typography.label.size }}>
            Auto-fills probation end date when adding a new employee. Set to 0 to disable probation tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            min={0}
            max={365}
            value={probationDays}
            onChange={(e) => setProbationDays(e.target.value)}
            data-testid="company-settings-probation-days-input"
            className="px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1"
            style={{
              width: 72,
              background: inputBg,
              border: `1px solid ${inputBdr}`,
              borderRadius: 8,
              color: text,
            }}
          />
          <span style={{ color: textDim, fontSize: typography.label.size }}>days</span>
          <button
            type="button"
            onClick={handleProbationSave}
            disabled={updateOrg.isPending}
            data-testid="company-settings-probation-days-save-btn"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: C.accent, color: C.accentText }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section: Scorecard ─────────────────────────────────────────────────────────

const WEIGHT_SIGNALS = [
  { key: 'attendance_weight', label: 'Attendance' },
  { key: 'punctuality_weight', label: 'Punctuality' },
  { key: 'leave_weight', label: 'Leave' },
  { key: 'tasks_weight', label: 'Tasks' },
] as const

type WeightKey = (typeof WEIGHT_SIGNALS)[number]['key']

const SCORECARD_DEFAULTS = {
  weights: { attendance_weight: 30, punctuality_weight: 20, leave_weight: 15, tasks_weight: 35 } as Record<WeightKey, number>,
  grades: { a: 90, b: 75, c: 60 },
  flags: { late: 3, leave: 90, task: 60, drop: 10, minDays: 5 },
}

function ScorecardConfigSection() {
  const { data: config, isLoading } = useScorecardConfig()
  const updateConfig = useUpdateScorecardConfig()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [weights, setWeights] = useState<Record<WeightKey, number> | null>(null)
  const [grades, setGrades] = useState<{ a: number; b: number; c: number } | null>(null)
  const [flags, setFlags] = useState<{ late: number; leave: number; task: number; drop: number; minDays: number } | null>(null)

  const initialized = useRef(false)
  if (config && !initialized.current) {
    initialized.current = true
    setWeights({
      attendance_weight: config.attendance_weight,
      punctuality_weight: config.punctuality_weight,
      leave_weight: config.leave_weight,
      tasks_weight: config.tasks_weight,
    })
    setGrades({ a: config.grade_a_min, b: config.grade_b_min, c: config.grade_c_min })
    setFlags({
      late: config.late_flag_threshold,
      leave: config.leave_warning_pct,
      task: config.task_concern_pct,
      drop: config.score_drop_threshold,
      minDays: config.min_working_days,
    })
  }

  if (isLoading || !weights || !grades || !flags) {
    return (
      <div>
        <div className="h-20 animate-pulse" style={{ background: inputBg, borderRadius: radius.md }} />
      </div>
    )
  }

  const weightTotal = Object.values(weights).reduce((sum, v) => sum + v, 0)
  const weightValid = weightTotal === 100
  const gradeValid = grades.a > grades.b && grades.b > grades.c && grades.c > 0
  const canSave = weightValid && gradeValid && !updateConfig.isPending

  function handleWeightChange(key: WeightKey, value: number) {
    setWeights((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function handleReset() {
    setWeights({ ...SCORECARD_DEFAULTS.weights })
    setGrades({ ...SCORECARD_DEFAULTS.grades })
    setFlags({ ...SCORECARD_DEFAULTS.flags })
  }

  function handleSave() {
    if (!canSave || !weights || !grades || !flags) return
    const payload: ConfigUpdateInput = {
      attendance_weight: weights.attendance_weight,
      punctuality_weight: weights.punctuality_weight,
      leave_weight: weights.leave_weight,
      tasks_weight: weights.tasks_weight,
      grade_a_min: grades.a,
      grade_b_min: grades.b,
      grade_c_min: grades.c,
      late_flag_threshold: flags.late,
      leave_warning_pct: flags.leave,
      task_concern_pct: flags.task,
      score_drop_threshold: flags.drop,
      min_working_days: flags.minDays,
    }
    updateConfig.mutate(payload, {
      onSuccess: () => {
        setSuccessMessage('Scorecard configuration saved.')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
    })
  }

  const numCls = 'w-18 h-9 px-2.5 text-center focus:outline-none focus:ring-1'

  return (
    <div>
      {successMessage && <Banner variant="success" message={successMessage} />}
      {updateConfig.isError && <Banner variant="error" message="Failed to save scorecard config. Please try again." />}

      {/* Signal Weights */}
      <div className="py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center justify-between mb-4">
          <p style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Signal weights</p>
          <span className="px-2.5 py-1"
            style={{
              background: weightValid ? 'rgba(18,160,92,0.15)' : 'rgba(212,64,64,0.15)',
              color: weightValid ? '#6EE7B7' : '#FCA5A5',
              fontFamily: typography.fontMono,
              fontSize: typography.label.size,
              fontWeight: 600,
              borderRadius: radius.md,
            }}>
            {weightTotal}/100
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {WEIGHT_SIGNALS.map((sig) => (
            <div key={sig.key} className="flex items-center gap-3">
              <label htmlFor={sig.key} className="w-28 shrink-0" style={{ color: textSec, fontSize: typography.label.size }}>{sig.label}</label>
              <input id={sig.key} data-testid={`company-settings-weight-${sig.key}-input`}
                type="range" min={0} max={100} step={5} value={weights[sig.key]}
                onChange={(e) => handleWeightChange(sig.key, Number(e.target.value))}
                className="flex-1" style={{ accentColor: C.accent }} />
              <span className="w-10 text-right" style={{ color: text, fontFamily: typography.fontMono, fontSize: typography.label.size, fontWeight: 600 }}>
                {weights[sig.key]}
              </span>
            </div>
          ))}
        </div>

        {!weightValid && (
          <p className="mt-2" style={{ color: '#FCA5A5', fontSize: typography.label.size, fontWeight: typography.label.weight }}>
            Weights must sum to 100 (currently {weightTotal})
          </p>
        )}
      </div>

      {/* Grade thresholds */}
      <div className="py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <p className="mb-1.5" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Grade thresholds</p>
        <p className="mb-4" style={{ color: textDim, fontSize: typography.label.size }}>Minimum score for each grade. A &gt; B &gt; C &gt; 0.</p>
        <div className="flex gap-3">
          {([
            { label: 'A', id: 'grade-a', value: grades.a, onChange: (v: number) => setGrades((g) => g ? { ...g, a: v } : g) },
            { label: 'B', id: 'grade-b', value: grades.b, onChange: (v: number) => setGrades((g) => g ? { ...g, b: v } : g) },
            { label: 'C', id: 'grade-c', value: grades.c, onChange: (v: number) => setGrades((g) => g ? { ...g, c: v } : g) },
          ] as const).map((g) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <label htmlFor={g.id} style={{ color: textDim, fontSize: typography.label.size, fontWeight: 600 }}>{g.label}</label>
              <input id={g.id} data-testid={`company-settings-${g.id}-input`}
                type="number" min={0} max={100} value={g.value}
                onChange={(e) => g.onChange(Number(e.target.value))}
                className={numCls}
                style={{ background: inputBg, border: `1px solid ${!gradeValid ? 'rgba(212,64,64,0.5)' : inputBdr}`, color: text, fontFamily: typography.fontMono, borderRadius: radius.lg, fontSize: typography.label.size }} />
            </div>
          ))}
        </div>
        {!gradeValid && <p className="mt-2" style={{ color: '#FCA5A5', fontSize: typography.label.size, fontWeight: typography.label.weight }}>A &gt; B &gt; C &gt; 0 required</p>}
      </div>

      {/* Flag thresholds */}
      <div className="py-5" style={{ borderBottom: `1px solid ${border}` }}>
        <p className="mb-1.5" style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>Flag thresholds</p>
        <p className="mb-4" style={{ color: textDim, fontSize: typography.label.size }}>When warnings appear on scorecards.</p>
        <div className="flex flex-col gap-2">
          {[
            { id: 'late-threshold', testId: 'company-settings-late-threshold-input', label: 'Late arrivals', value: flags.late, suffix: '', key: 'late' as const },
            { id: 'leave-warning', testId: 'company-settings-leave-warning-input', label: 'Leave warning', value: flags.leave, suffix: '%', key: 'leave' as const },
            { id: 'task-concern', testId: 'company-settings-task-concern-input', label: 'Task concern', value: flags.task, suffix: '%', key: 'task' as const },
            { id: 'score-drop', testId: 'company-settings-score-drop-input', label: 'Score drop', value: flags.drop, suffix: 'pts', key: 'drop' as const },
            { id: 'min-days', testId: 'company-settings-min-days-input', label: 'Min days', value: flags.minDays, suffix: '', key: 'minDays' as const },
          ].map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3">
              <label htmlFor={f.id} style={{ color: textSec, fontSize: typography.label.size }}>{f.label}</label>
              <div className="flex items-center gap-2">
                <input id={f.id} data-testid={f.testId}
                  type="number" min={0} max={f.suffix === '%' ? 100 : undefined}
                  value={f.value}
                  onChange={(e) => setFlags((prev) => prev ? { ...prev, [f.key]: Number(e.target.value) } : prev)}
                  className={numCls}
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, fontFamily: typography.fontMono, borderRadius: radius.lg, fontSize: typography.label.size }} />
                <span className="w-8 text-right" style={{ color: textDim, fontSize: typography.label.size }}>{f.suffix || ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-5">
        <PrimaryButton loading={updateConfig.isPending} label="Save scorecard" testId="company-settings-scorecard-save-btn"
          type="button" onClick={handleSave} disabled={!canSave} />
        <GhostButton label="Reset defaults" testId="company-settings-scorecard-reset-btn" onClick={handleReset} />
      </div>
    </div>
  )
}

// ── Section: Danger zone ───────────────────────────────────────────────────────

function TransferOwnershipSection() {
  const transferOwnership = useTransferOwnership()
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<TransferForm | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { new_owner_user_id: '' },
  })

  const apiError = extractApiError(transferOwnership.error)

  const handleSubmitIntent = (data: TransferForm) => {
    setPendingData(data)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!pendingData) return
    transferOwnership.mutate(pendingData, {
      onSuccess: () => {
        setShowConfirm(false)
        setPendingData(null)
        form.reset()
        setSuccessMessage('Ownership transferred successfully.')
        setTimeout(() => setSuccessMessage(null), 4000)
      },
      onError: () => setShowConfirm(false),
    })
  }

  return (
    <div>
      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <form data-testid="company-settings-transfer-form" onSubmit={form.handleSubmit(handleSubmitIntent)}>
        <FieldRow label="Transfer ownership" htmlFor="new-owner-user-id" description="You will lose owner privileges. This cannot be undone.">
          <TextInput data-testid="company-settings-transfer-owner-input" id="new-owner-user-id" type="text" placeholder="User ID (UUID)" {...form.register('new_owner_user_id')} />
          <ErrorText message={form.formState.errors.new_owner_user_id?.message} />
        </FieldRow>

        <div className="flex justify-end pt-5">
          <DangerButton loading={false} label="Transfer ownership" testId="company-settings-transfer-submit-btn" />
        </div>
      </form>

      {showConfirm && (
        <div data-testid="company-settings-transfer-modal" className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          role="dialog" aria-modal="true" aria-labelledby="confirm-transfer-title">
          <div className="w-full max-w-md p-8 flex flex-col gap-5 mx-4" style={{ background: '#12121C', border: `1px solid ${border}`, borderRadius: radius.xl }}>
            <h3 id="confirm-transfer-title" style={{ color: text, fontSize: typography.h3.size, fontWeight: typography.h3.weight, letterSpacing: typography.h3.tracking }}>Confirm transfer</h3>
            <p className="leading-relaxed" style={{ color: textSec, fontSize: typography.body.size }}>
              Transfer ownership to{' '}
              <span className="break-all" style={{ color: text, fontFamily: typography.fontMono, fontWeight: 600 }}>{pendingData?.new_owner_user_id}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" data-testid="company-settings-transfer-cancel-btn"
                onClick={() => { setShowConfirm(false); setPendingData(null) }}
                className="px-4 py-2 transition-colors"
                style={{ color: textSec, border: `1px solid ${border}`, borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600 }}>
                Cancel
              </button>
              <button type="button" data-testid="company-settings-transfer-confirm-btn" onClick={handleConfirm}
                disabled={transferOwnership.isPending}
                className="px-4 py-2 disabled:opacity-40 hover:brightness-110"
                style={{ background: C.err, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600 }}>
                {transferOwnership.isPending ? 'Transferring...' : 'Yes, transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Read-only view ─────────────────────────────────────────────────────────────

function ReadOnlyOrgInfo() {
  const { data: org } = useOrgDetail()
  const fields = [
    { label: 'Company name', value: org?.name },
    { label: 'Workspace URL', value: org?.slug ? `my.workived.com/${org.slug}` : undefined },
    { label: 'Country', value: COUNTRIES.find((c) => c.value === org?.country_code)?.label ?? org?.country_code },
    { label: 'Timezone', value: TIMEZONES.find((t) => t.value === org?.timezone)?.label ?? org?.timezone },
    { label: 'Currency', value: CURRENCIES.find((c) => c.value === org?.currency_code)?.label ?? org?.currency_code },
  ]

  return (
    <div>
      {fields.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${border}` }}>
          <span style={{ color: textSec, fontSize: typography.label.size }}>{label}</span>
          <span style={{ color: text, fontSize: typography.body.size, fontWeight: typography.label.weight }}>{value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function NoOrgView() {
  const navigate = useNavigate()
  const { data: myInvitationsData } = useMyInvitations()
  const myInvitations = myInvitationsData ?? []
  const setAuth = useAuthStore((s) => s.setAuth)
  const acceptInvitation = useMutation({
    mutationFn: (token: string) =>
      organisationsApi.acceptInvitation({ token }).then((r) => r.data.data),
    onSuccess: (result) => {
      setAuth({ access_token: result.access_token, user: result.user })
      navigate({ to: '/overview' })
    },
  })

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 mb-6 flex items-center justify-center" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke={textDim} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mb-2" style={{ color: text, fontSize: typography.h3.size, fontWeight: typography.h3.weight, letterSpacing: typography.h3.tracking }}>No workspace yet</h3>
      <p className="mb-6 text-center max-w-xs" style={{ color: textSec, fontSize: typography.body.size }}>
        Create a workspace to get started, or accept a pending invitation.
      </p>
      <button
        data-testid="company-settings-setup-workspace-btn"
        onClick={() => navigate({ to: '/setup-org' })}
        className="px-5 py-2.5 transition-all hover:brightness-110"
        style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontFamily }}
      >
        Set up workspace
      </button>

      {myInvitations.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="uppercase tracking-wider mb-3 text-center" style={{ color: textDim, fontSize: typography.tiny.size, fontWeight: typography.tiny.weight, letterSpacing: typography.tiny.tracking }}>
            Pending invitations
          </p>
          <div className="flex flex-col gap-2">
            {myInvitations.map((inv: MyInvitation) => {
              const token = extractInviteToken(inv.invite_url)
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5 px-3"
                  style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius.md }}>
                  <div>
                    <p style={{ color: text, fontSize: typography.label.size, fontWeight: typography.label.weight }}>{inv.org_name}</p>
                    <p style={{ color: textDim, fontSize: typography.caption.size }}>
                      Invited as <span style={{ color: colors.accentMid, fontWeight: 600 }}>{inv.role}</span>
                    </p>
                  </div>
                  <button
                    data-testid={`company-settings-accept-invite-btn-${inv.id}`}
                    onClick={() => acceptInvitation.mutate(token)}
                    disabled={acceptInvitation.isPending || !token}
                    className="shrink-0 py-1.5 px-4 disabled:opacity-40 hover:brightness-110"
                    style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: 600 }}
                  >
                    {acceptInvitation.isPending ? 'Joining...' : 'Accept'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

const TAB_ICONS_SMALL: Record<TabId, React.ReactNode> = {
  general: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  location: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" /><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  plan: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" />
    </svg>
  ),
  attendance: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  scorecard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  ),
  danger: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

function TabBar({ activeTab, onTabChange, isDanger }: { activeTab: TabId; onTabChange: (id: TabId) => void; isDanger?: boolean }) {
  return (
    <nav aria-label="Settings sections" className="flex gap-1 p-1" style={{ background: inputBg, borderRadius: radius.xl }}>
      {TABS.map((tab) => {
        const active = tab.id === activeTab
        const danger = tab.id === 'danger'
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 py-2 transition-all relative flex items-center justify-center gap-2"
            style={{
              color: active ? (danger ? '#FCA5A5' : text) : textDim,
              background: active ? cardBg : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
              borderRadius: radius.lg,
              fontSize: typography.label.size,
              fontWeight: 600,
              fontFamily: typography.fontFamily,
            }}
          >
            {TAB_ICONS_SMALL[tab.id]}
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

// ── Section descriptions ───────────────────────────────────────────────────────

const SECTION_META: Record<TabId, { title: string; description: string }> = {
  general:    { title: 'General',           description: 'Company name and workspace URL' },
  location:   { title: 'Location & currency', description: 'Regional settings for compliance' },
  plan:       { title: 'Plan & usage',      description: 'Subscription and employee limits' },
  attendance: { title: 'Attendance',        description: 'Clock in/out behaviour' },
  scorecard:  { title: 'Scorecard',         description: 'Performance scoring configuration' },
  danger:     { title: 'Danger zone',       description: 'Irreversible ownership actions' },
}

// ── Tab SVG illustrations ──────────────────────────────────────────────────────

const TAB_ILLUSTRATIONS: Record<TabId, React.ReactNode> = {
  general: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Desk surface */}
      <rect x="10" y="85" width="140" height="6" rx="3" fill="rgba(255,255,255,0.06)" />
      {/* Monitor */}
      <rect x="42" y="18" width="76" height="52" rx="6" fill="rgba(99,87,232,0.12)" stroke="rgba(99,87,232,0.35)" strokeWidth="1.5" />
      <rect x="48" y="24" width="64" height="38" rx="3" fill="rgba(99,87,232,0.06)" />
      {/* Screen content lines */}
      <rect x="54" y="30" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.25)" />
      <rect x="54" y="37" width="40" height="2" rx="1" fill="rgba(255,255,255,0.10)" />
      <rect x="54" y="42" width="36" height="2" rx="1" fill="rgba(255,255,255,0.10)" />
      <rect x="54" y="47" width="20" height="2" rx="1" fill="rgba(255,255,255,0.10)" />
      {/* Monitor logo dot */}
      <circle cx="100" cy="31" r="4" fill="rgba(99,87,232,0.30)" />
      {/* Monitor stand */}
      <rect x="72" y="70" width="16" height="8" rx="2" fill="rgba(255,255,255,0.08)" />
      <rect x="64" y="78" width="32" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
      {/* Coffee mug */}
      <rect x="126" y="68" width="14" height="16" rx="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <path d="M140 73 C146 73, 146 79, 140 79" stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
      {/* Steam */}
      <path d="M131 64 C131 60, 134 60, 134 64" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
      <path d="M135 62 C135 58, 138 58, 138 62" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
      {/* Pencil */}
      <rect x="18" y="60" width="4" height="22" rx="1" fill="rgba(255,255,255,0.10)" transform="rotate(-15 20 71)" />
      <polygon points="18,82 20,88 22,82" fill="rgba(99,87,232,0.25)" transform="rotate(-15 20 85)" />
      {/* Keyboard */}
      <rect x="50" y="84" width="60" height="8" rx="2" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Key dots */}
      <circle cx="58" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="64" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="70" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="76" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="82" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="88" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="94" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="100" cy="88" r="1" fill="rgba(255,255,255,0.08)" />
    </svg>
  ),
  location: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Globe */}
      <circle cx="80" cy="56" r="40" fill="rgba(99,87,232,0.06)" stroke="rgba(99,87,232,0.25)" strokeWidth="1.5" />
      {/* Latitude lines */}
      <ellipse cx="80" cy="40" rx="34" ry="8" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none" />
      <ellipse cx="80" cy="56" rx="40" ry="10" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none" />
      <ellipse cx="80" cy="72" rx="34" ry="8" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none" />
      {/* Meridian */}
      <ellipse cx="80" cy="56" rx="16" ry="40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none" />
      {/* Continent shapes */}
      <path d="M60 42 C64 38, 76 36, 80 40 C84 44, 78 50, 70 48 C62 46, 58 44, 60 42Z" fill="rgba(99,87,232,0.18)" />
      <path d="M88 50 C94 46, 106 48, 108 54 C110 60, 102 66, 94 64 C86 62, 84 54, 88 50Z" fill="rgba(99,87,232,0.18)" />
      <path d="M64 60 C68 58, 78 58, 80 62 C82 66, 76 72, 68 70 C60 68, 62 62, 64 60Z" fill="rgba(99,87,232,0.15)" />
      {/* Location pin */}
      <path d="M115 28 C115 20, 128 20, 128 28 C128 34, 121.5 42, 121.5 42 C121.5 42, 115 34, 115 28Z" fill="rgba(99,87,232,0.35)" stroke="rgba(99,87,232,0.60)" strokeWidth="1.2" />
      <circle cx="121.5" cy="28" r="3.5" fill="rgba(255,255,255,0.25)" />
      {/* Pin shadow */}
      <ellipse cx="121.5" cy="44" rx="5" ry="2" fill="rgba(0,0,0,0.15)" />
      {/* Dotted flight path */}
      <path d="M40 70 Q60 30, 115 32" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      {/* Small plane */}
      <polygon points="42,68 36,72 42,70 48,72" fill="rgba(255,255,255,0.15)" />
      {/* Base shadow */}
      <ellipse cx="80" cy="104" rx="44" ry="5" fill="rgba(0,0,0,0.10)" />
    </svg>
  ),
  plan: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Card */}
      <rect x="22" y="20" width="116" height="72" rx="8" fill="rgba(99,87,232,0.08)" stroke="rgba(99,87,232,0.25)" strokeWidth="1.5" />
      {/* Card shine */}
      <path d="M22 28 C22 24, 26 20, 30 20 L138 20 C138 20, 40 40, 22 28Z" fill="rgba(255,255,255,0.03)" />
      {/* Chip */}
      <rect x="34" y="36" width="22" height="16" rx="3" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
      <line x1="34" y1="44" x2="56" y2="44" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <line x1="45" y1="36" x2="45" y2="52" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      {/* Contactless */}
      <path d="M64 40 C66 38, 66 34, 64 32" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <path d="M68 42 C72 38, 72 30, 68 28" stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
      <path d="M72 44 C78 38, 78 28, 72 24" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
      {/* Card number dots */}
      {[0,1,2,3].map(g => (
        <g key={g}>
          {[0,1,2,3].map(d => (
            <circle key={d} cx={36 + g * 28 + d * 6} cy="64" r="1.8" fill="rgba(255,255,255,0.12)" />
          ))}
        </g>
      ))}
      {/* Name */}
      <rect x="34" y="74" width="42" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
      <rect x="34" y="80" width="26" height="2" rx="1" fill="rgba(255,255,255,0.06)" />
      {/* Logo circle */}
      <circle cx="122" cy="78" r="8" fill="rgba(99,87,232,0.20)" />
      <circle cx="118" cy="78" r="8" fill="rgba(99,87,232,0.15)" />
      {/* Sparkles */}
      <path d="M132 18 L134 22 L136 18 L134 14Z" fill="rgba(99,87,232,0.35)" />
      <path d="M142 30 L143 33 L144 30 L143 27Z" fill="rgba(99,87,232,0.25)" />
      <path d="M18 50 L19.5 53 L21 50 L19.5 47Z" fill="rgba(99,87,232,0.20)" />
      {/* Shadow */}
      <ellipse cx="80" cy="104" rx="50" ry="5" fill="rgba(0,0,0,0.10)" />
    </svg>
  ),
  attendance: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clock face */}
      <circle cx="80" cy="56" r="42" fill="rgba(99,87,232,0.06)" stroke="rgba(99,87,232,0.25)" strokeWidth="1.5" />
      <circle cx="80" cy="56" r="38" fill="rgba(0,0,0,0.10)" />
      {/* Hour marks */}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
        const a = (i * 30 - 90) * Math.PI / 180
        const x1 = 80 + Math.cos(a) * 33
        const y1 = 56 + Math.sin(a) * 33
        const x2 = 80 + Math.cos(a) * 37
        const y2 = 56 + Math.sin(a) * 37
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth={i % 3 === 0 ? '2.5' : '1'} strokeLinecap="round" />
      })}
      {/* Hour hand */}
      <line x1="80" y1="56" x2="80" y2="34" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1="80" y1="56" x2="98" y2="48" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round" />
      {/* Second hand */}
      <line x1="80" y1="56" x2="72" y2="78" stroke="rgba(99,87,232,0.50)" strokeWidth="0.8" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="80" cy="56" r="3" fill="rgba(99,87,232,0.50)" />
      <circle cx="80" cy="56" r="1.5" fill="rgba(255,255,255,0.30)" />
      {/* Small bell on top */}
      <path d="M72 16 C72 10, 88 10, 88 16" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
      <circle cx="72" cy="16" r="2" fill="rgba(255,255,255,0.10)" />
      <circle cx="88" cy="16" r="2" fill="rgba(255,255,255,0.10)" />
      {/* Alarm bell body */}
      <line x1="80" y1="8" x2="80" y2="14" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Time annotation */}
      <rect x="114" y="38" width="34" height="16" rx="4" fill="rgba(99,87,232,0.15)" stroke="rgba(99,87,232,0.25)" strokeWidth="0.8" />
      <text x="131" y="50" textAnchor="middle" fill="rgba(255,255,255,0.30)" fontSize="8" fontFamily="monospace">9:00</text>
      {/* Shadow */}
      <ellipse cx="80" cy="108" rx="40" ry="4" fill="rgba(0,0,0,0.10)" />
    </svg>
  ),
  scorecard: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Chart background */}
      <rect x="18" y="14" width="124" height="82" rx="6" fill="rgba(99,87,232,0.06)" stroke="rgba(99,87,232,0.20)" strokeWidth="1" />
      {/* Grid lines */}
      <line x1="18" y1="36" x2="142" y2="36" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <line x1="18" y1="56" x2="142" y2="56" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <line x1="18" y1="76" x2="142" y2="76" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      {/* Bars */}
      <rect x="30" y="60" width="12" height="30" rx="2" fill="rgba(99,87,232,0.20)" />
      <rect x="48" y="42" width="12" height="48" rx="2" fill="rgba(99,87,232,0.30)" />
      <rect x="66" y="52" width="12" height="38" rx="2" fill="rgba(99,87,232,0.22)" />
      <rect x="84" y="30" width="12" height="60" rx="2" fill="rgba(99,87,232,0.40)" />
      <rect x="102" y="38" width="12" height="52" rx="2" fill="rgba(99,87,232,0.32)" />
      <rect x="120" y="24" width="12" height="66" rx="2" fill="rgba(99,87,232,0.50)" />
      {/* Trend line */}
      <polyline points="36,58 54,40 72,50 90,28 108,36 126,22" stroke="rgba(99,87,232,0.60)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots on trend */}
      <circle cx="36" cy="58" r="2.5" fill="rgba(99,87,232,0.60)" />
      <circle cx="54" cy="40" r="2.5" fill="rgba(99,87,232,0.60)" />
      <circle cx="72" cy="50" r="2.5" fill="rgba(99,87,232,0.60)" />
      <circle cx="90" cy="28" r="2.5" fill="rgba(99,87,232,0.60)" />
      <circle cx="108" cy="36" r="2.5" fill="rgba(99,87,232,0.60)" />
      <circle cx="126" cy="22" r="2.5" fill="rgba(99,87,232,0.80)" />
      {/* Highlight on best bar */}
      <rect x="120" y="24" width="12" height="2" rx="1" fill="rgba(99,87,232,0.70)" />
      {/* Star badge */}
      <path d="M140 10 L142 16 L148 16 L143 20 L145 26 L140 22 L135 26 L137 20 L132 16 L138 16Z" fill="rgba(99,87,232,0.30)" />
      {/* Y-axis labels */}
      <text x="14" y="38" textAnchor="end" fill="rgba(255,255,255,0.10)" fontSize="6">75</text>
      <text x="14" y="58" textAnchor="end" fill="rgba(255,255,255,0.10)" fontSize="6">50</text>
      <text x="14" y="78" textAnchor="end" fill="rgba(255,255,255,0.10)" fontSize="6">25</text>
      {/* Shadow */}
      <ellipse cx="80" cy="108" rx="50" ry="4" fill="rgba(0,0,0,0.08)" />
    </svg>
  ),
  danger: (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Warning triangle */}
      <path d="M80 14 L138 96 L22 96Z" fill="rgba(212,64,64,0.08)" stroke="rgba(212,64,64,0.30)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Inner triangle */}
      <path d="M80 30 L126 88 L34 88Z" fill="rgba(212,64,64,0.04)" />
      {/* Exclamation body */}
      <rect x="76" y="44" width="8" height="26" rx="4" fill="rgba(212,64,64,0.40)" />
      {/* Exclamation dot */}
      <circle cx="80" cy="80" r="4.5" fill="rgba(212,64,64,0.40)" />
      {/* Glow ring */}
      <circle cx="80" cy="62" r="30" fill="none" stroke="rgba(212,64,64,0.06)" strokeWidth="8" />
      {/* Radiating lines */}
      <line x1="80" y1="4" x2="80" y2="10" stroke="rgba(212,64,64,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="22" x2="50" y2="26" stroke="rgba(212,64,64,0.12)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="114" y1="22" x2="110" y2="26" stroke="rgba(212,64,64,0.12)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="60" x2="14" y2="60" stroke="rgba(212,64,64,0.08)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="142" y1="60" x2="146" y2="60" stroke="rgba(212,64,64,0.08)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Small broken pieces */}
      <rect x="34" y="100" width="8" height="3" rx="1" fill="rgba(212,64,64,0.10)" transform="rotate(-10 38 101)" />
      <rect x="118" y="100" width="10" height="3" rx="1" fill="rgba(212,64,64,0.10)" transform="rotate(8 123 101)" />
      {/* Shadow */}
      <ellipse cx="80" cy="108" rx="46" ry="5" fill="rgba(0,0,0,0.12)" />
    </svg>
  ),
}

// ── Page ───────────────────────────────────────────────────────────────────────

function CompanyPage() {
  const hasOrg = useHasOrg()
  const { data: org, isLoading, isError } = useOrgDetail()
  const canEdit = useCanEditOrgSettings()
  const [activeTab, setActiveTab] = useState<TabId>('general')

  const meta = SECTION_META[activeTab]

  const renderSection = () => {
    if (!canEdit) {
      if (activeTab === 'general' || activeTab === 'location') return <ReadOnlyOrgInfo />
      if (activeTab === 'plan') return <PlanSection />
      return (
        <p style={{ color: textDim, fontSize: typography.body.size }} className="py-10 text-center">
          You need admin access to view this section.
        </p>
      )
    }

    switch (activeTab) {
      case 'general':    return <CompanyInfoSection />
      case 'location':   return <LocationSection />
      case 'plan':       return <PlanSection />
      case 'attendance': return <AttendanceSection />
      case 'scorecard':  return <ScorecardConfigSection />
      case 'danger':     return <TransferOwnershipSection />
    }
  }

  return (
    <div data-testid="company-settings-page" className="min-h-screen relative" style={{ background: pageBg, fontFamily: typography.fontFamily }}>
      {/* Radial glow (matches landing page CTA section) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,87,232,0.14) 0%, transparent 60%)' }} />

      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-3 focus:py-1.5"
        style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: 600 }}>
        Skip to main content
      </a>

      {/* Accent line at top */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${C.accent}, transparent 70%)` }} />

      <div className="w-full px-6 md:px-11 pt-12 pb-24 relative z-10">
        {/* Workspace identity chip */}
        {org && (
          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 800 }}>
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <p style={{ color: text, fontSize: typography.h3.size, fontWeight: typography.h3.weight, letterSpacing: typography.h3.tracking }}>{org.name}</p>
                {org.plan === 'pro' && (
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded"
                    style={{ background: '#9B8FF7', color: '#FFFFFF', letterSpacing: '0.05em' }}
                  >
                    PRO
                  </span>
                )}
              </div>
              <p style={{ color: textDim, fontSize: typography.label.size }}>Workspace settings</p>
            </div>
          </div>
        )}

        {!org && !isLoading && hasOrg && null}

        {!hasOrg && <NoOrgView />}

        {hasOrg && isLoading && (
          <div data-testid="company-settings-skeleton" className="flex flex-col gap-3" aria-label="Loading company settings">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse" style={{ background: cardBg, borderRadius: radius.md }} />
            ))}
          </div>
        )}

        {hasOrg && isError && (
          <Banner variant="error" message="Failed to load company settings. Please refresh the page." />
        )}

        {hasOrg && !isLoading && !isError && (
          <>
            {!canEdit && <Banner variant="info" message="You have view-only access. Contact an admin to make changes." />}

            {/* Tab bar */}
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Section header + content */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10 mt-10">
              <div className="pt-2 flex flex-col items-center text-center">
                <div className="mb-5">
                  {TAB_ILLUSTRATIONS[activeTab]}
                </div>
                <h1 style={{ color: activeTab === 'danger' ? '#FCA5A5' : text, fontSize: typography.h1.size, fontWeight: typography.h1.weight, letterSpacing: typography.h1.tracking }}>
                  {meta.title}
                </h1>
                <p className="mt-2" style={{ color: textSec, fontSize: typography.body.size, lineHeight: '1.5' }}>{meta.description}</p>
              </div>

              {/* Content panel */}
              <main id="main-content" className="p-7" style={{ background: surfaceBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
                {renderSection()}
              </main>
            </div>

            {/* Keyboard shortcut hint */}
            <p className="mt-5 text-center" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: typography.caption.weight }}>
              Settings are saved per-section
            </p>
          </>
        )}
      </div>
    </div>
  )
}
