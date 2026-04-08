import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { useOrgDetail, useUpdateOrg, useTransferOwnership } from '@/lib/hooks/useOrganisation'
import { useCanEditOrgSettings, useHasOrg } from '@/lib/hooks/useRole'
import { useMyInvitations } from '@/lib/hooks/useInvitations'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { extractApiError, extractApiErrorDetails } from '@/lib/utils/errors'
import { extractInviteToken } from '@/lib/utils/url'
import type { MyInvitation } from '@/types/api'

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

// ── Shared token shorthands ────────────────────────────────────────────────────

const C = {
  err: colors.err,
  errDim: colors.errDim,
  errText: colors.errText,
  ok: colors.ok,
  okDim: colors.okDim,
  okText: colors.okText,
  accent: colors.accent,
  accentDim: colors.accentDim,
  warn: colors.warn,
  warnDim: colors.warnDim,
}

// ── Shared style constants ─────────────────────────────────────────────────────

const S = {
  text:       '#FFFFFF',
  textMuted:  'rgba(255,255,255,0.55)',
  textDim:    'rgba(255,255,255,0.35)',
  divider:    'rgba(255,255,255,0.08)',
  inputBg:    'rgba(255,255,255,0.07)',
  inputBorder:'rgba(255,255,255,0.12)',
}

// ── Sidebar navigation items ───────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'general', label: 'General' },
  { id: 'location', label: 'Location & currency' },
  { id: 'plan', label: 'Plan & usage' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'danger', label: 'Danger zone' },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldRow({ label, htmlFor, description, children }: {
  label: string
  htmlFor: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-8 items-start">
      <div className="pt-2.5">
        <label htmlFor={htmlFor} style={{ fontSize: 14, fontWeight: 600, color: S.text, display: 'block' }}>
          {label}
        </label>
        {description && (
          <p style={{ fontSize: 13, color: S.textDim, marginTop: 4, lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Input({ id, disabled, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      disabled={disabled}
      className="w-full max-w-md px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
      {...props}
    />
  )
}

function Select({ id, disabled, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  return (
    <select
      id={id}
      disabled={disabled}
      className="w-full max-w-md px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none disabled:opacity-50"
      style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
      {...props}
    >
      {children}
    </select>
  )
}

function Divider() {
  return <div style={{ height: 1, background: S.divider }} />
}

function SectionTitle({ id, children, description }: { id?: string; children: React.ReactNode; description?: string }) {
  return (
    <div id={id} className="scroll-mt-8">
      <h2 style={{ fontSize: 16, fontWeight: 700, color: S.text, letterSpacing: '-0.02em' }}>{children}</h2>
      {description && (
        <p style={{ fontSize: 14, color: S.textMuted, marginTop: 4, lineHeight: 1.5 }}>{description}</p>
      )}
    </div>
  )
}

function Banner({ variant, message }: { variant: 'success' | 'error' | 'warning' | 'info'; message: string }) {
  const styles = {
    success: { bg: 'rgba(18,160,92,0.1)', border: 'rgba(18,160,92,0.3)', color: '#34D399' },
    error:   { bg: 'rgba(212,64,64,0.1)', border: 'rgba(212,64,64,0.3)', color: '#F87171' },
    warning: { bg: 'rgba(201,123,42,0.1)', border: 'rgba(201,123,42,0.3)', color: '#FBBF24' },
    info:    { bg: 'rgba(99,87,232,0.1)', border: 'rgba(99,87,232,0.3)', color: '#A5B4FC' },
  }
  const s = styles[variant]
  return (
    <div role="alert" aria-live="polite" className="px-4 py-3 rounded-lg text-sm font-medium"
      style={{ background: s.bg, borderLeft: `3px solid ${s.border}`, color: s.color }}>
      {message}
    </div>
  )
}

function SaveButton({ loading, label = 'Save changes' }: { loading: boolean; label?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-8">
      <div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: C.accent, color: '#FFFFFF' }}
        >
          {loading ? 'Saving...' : label}
        </button>
      </div>
      <div /> {/* Empty space */}
    </div>
  )
}

// ── Company info section ───────────────────────────────────────────────────────

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
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
      <SectionTitle id="general" description="Your company name and workspace URL.">General</SectionTitle>

      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <FieldRow label="Company name" htmlFor="company-name">
        <Input id="company-name" type="text" placeholder="Acme Corp" {...form.register('name')} />
        {form.formState.errors.name && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.name.message}</p>
        )}
      </FieldRow>

      <FieldRow label="Workspace URL" htmlFor="company-slug" description="Used for invitations and sharing.">
        <div className="flex items-center rounded-lg overflow-hidden max-w-md" style={{ border: `1px solid ${S.inputBorder}` }}>
          <span className="px-3 py-2.5 text-sm select-none shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: S.textDim, borderRight: `1px solid ${S.divider}` }}>
            my.workived.com/
          </span>
          <input
            id="company-slug" type="text" placeholder="acme-corp"
            className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
            style={{ color: S.text }}
            {...form.register('slug')}
          />
        </div>
        {form.formState.errors.slug && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.slug.message}</p>
        )}
      </FieldRow>

      <SaveButton loading={updateOrg.isPending} />
    </form>
  )
}

// ── Location section ───────────────────────────────────────────────────────────

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
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
      <SectionTitle id="location" description="Regional settings used for compliance and localization.">
        Location &amp; currency
      </SectionTitle>

      {isLocked && <Banner variant="warning" message="Location settings are locked after employees are added." />}
      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <FieldRow label="Country" htmlFor="country-code">
        {isLocked ? (
          <p id="country-code" style={{ fontSize: 14, color: S.text, fontWeight: 500, paddingTop: 4 }}>
            {COUNTRIES.find((c) => c.value === org?.country_code)?.label ?? org?.country_code}
          </p>
        ) : (
          <Select id="country-code" {...form.register('country_code')}>
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        )}
        {form.formState.errors.country_code && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.country_code.message}</p>
        )}
      </FieldRow>

      <FieldRow label="Timezone" htmlFor="timezone">
        {isLocked ? (
          <p id="timezone" style={{ fontSize: 14, color: S.text, fontWeight: 500, paddingTop: 4 }}>
            {TIMEZONES.find((t) => t.value === org?.timezone)?.label ?? org?.timezone}
          </p>
        ) : (
          <Select id="timezone" {...form.register('timezone')}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        )}
        {form.formState.errors.timezone && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.timezone.message}</p>
        )}
      </FieldRow>

      <FieldRow label="Currency" htmlFor="currency-code">
        {isLocked ? (
          <p id="currency-code" style={{ fontSize: 14, color: S.text, fontWeight: 500, paddingTop: 4 }}>
            {CURRENCIES.find((cur) => cur.value === org?.currency_code)?.label ?? org?.currency_code}
          </p>
        ) : (
          <Select id="currency-code" {...form.register('currency_code')}>
            {CURRENCIES.map((cur) => <option key={cur.value} value={cur.value}>{cur.label}</option>)}
          </Select>
        )}
        {form.formState.errors.currency_code && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.currency_code.message}</p>
        )}
      </FieldRow>

      {!isLocked && <SaveButton loading={updateOrg.isPending} label="Save location" />}
    </form>
  )
}

// ── Plan section ───────────────────────────────────────────────────────────────

function PlanSection() {
  const { data: org } = useOrgDetail()

  if (!org) return null

  const limit = org.plan_employee_limit ?? null
  const count = org.employee_count ?? 0
  const usagePct = limit ? Math.min((count / limit) * 100, 100) : 0
  const isNearLimit = limit ? usagePct >= 80 : false
  const planLabel = org.plan === 'free' ? 'Free' : org.plan === 'pro' ? 'Pro' : 'Enterprise'

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle id="plan" description="Your current subscription and employee usage.">
        Plan &amp; usage
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-8 items-start">
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, paddingTop: 2 }}>Current plan</p>
        <div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{planLabel}</span>
            {isNearLimit && (
              <a
                href="mailto:hello@workived.com?subject=Upgrade to Pro"
                className="px-3 py-1 rounded-md text-xs font-semibold"
                style={{ background: C.accent, color: '#FFFFFF', textDecoration: 'none' }}
              >
                Upgrade
              </a>
            )}
          </div>
          <p style={{ fontSize: 13, color: S.textMuted, marginTop: 4 }}>
            {count} employee{count !== 1 ? 's' : ''}{limit ? ` of ${limit}` : ''}
          </p>
        </div>
      </div>

      {limit && (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-8 items-start">
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text, paddingTop: 2 }}>Usage</p>
          <div className="max-w-md">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-label={`${count} of ${limit} employees used`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usagePct}%`,
                  background: isNearLimit
                    ? `linear-gradient(90deg, ${C.warn} 0%, ${C.err} 100%)`
                    : `linear-gradient(90deg, #9B8FF7 0%, ${C.accent} 100%)`,
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: S.textDim, marginTop: 6 }}>
              {Math.round(usagePct)}% of limit used
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Attendance section ─────────────────────────────────────────────────────────

function AttendanceSection() {
  const { data: org } = useOrgDetail()
  const updateOrg = useUpdateOrg()
  const [saved, setSaved] = useState(false)

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

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle id="attendance" description="Control how employees can clock in and out.">
        Attendance
      </SectionTitle>

      {saved && <Banner variant="success" message="Attendance settings saved." />}

      <FieldRow
        label="Allow web clock in/out"
        htmlFor="allow-web-clock-in"
        description="When enabled, employees can clock in and out from the web app in addition to the mobile app."
      >
        <button
          id="allow-web-clock-in"
          role="switch"
          aria-checked={org.allow_web_clock_in}
          onClick={handleToggle}
          disabled={updateOrg.isPending}
          className="relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
          style={{
            width: 44,
            height: 24,
            background: org.allow_web_clock_in ? C.accent : 'rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}
        >
          <span
            className="inline-block rounded-full bg-white transition-transform"
            style={{
              width: 18,
              height: 18,
              transform: org.allow_web_clock_in ? 'translateX(22px)' : 'translateX(3px)',
            }}
          />
        </button>
      </FieldRow>
    </div>
  )
}

// ── Transfer ownership section ─────────────────────────────────────────────────

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
    <form onSubmit={form.handleSubmit(handleSubmitIntent)} className="flex flex-col gap-6">
      <SectionTitle id="danger" description="Irreversible actions that affect workspace ownership.">
        Danger zone
      </SectionTitle>

      {apiError && <Banner variant="error" message={apiError} />}
      {successMessage && <Banner variant="success" message={successMessage} />}

      <FieldRow label="Transfer ownership" htmlFor="new-owner-user-id" description="You will lose owner privileges. This cannot be undone.">
        <Input id="new-owner-user-id" type="text" placeholder="User ID (UUID)" {...form.register('new_owner_user_id')} />
        {form.formState.errors.new_owner_user_id && (
          <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>{form.formState.errors.new_owner_user_id.message}</p>
        )}
      </FieldRow>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-8">
        <div>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(212,64,64,0.12)', color: C.err, border: `1px solid rgba(212,64,64,0.25)` }}>
            Transfer ownership
          </button>
        </div>
        <div /> {/* Empty space */}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
          role="dialog" aria-modal="true" aria-labelledby="confirm-transfer-title">
          <div className="w-full max-w-md p-6 rounded-xl flex flex-col gap-4 mx-4"
            style={{ background: colors.ink700, border: `1px solid ${S.divider}` }}>
            <h3 id="confirm-transfer-title" style={{ fontSize: 18, fontWeight: 700, color: S.text }}>
              Confirm transfer
            </h3>
            <p style={{ fontSize: 14, color: S.textMuted, lineHeight: 1.6 }}>
              Transfer ownership to{' '}
              <span style={{ fontFamily: 'monospace', color: S.text, wordBreak: 'break-all' }}>
                {pendingData?.new_owner_user_id}
              </span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowConfirm(false); setPendingData(null) }}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: S.textMuted }}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} disabled={transferOwnership.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: C.err, color: '#FFFFFF' }}>
                {transferOwnership.isPending ? 'Transferring...' : 'Yes, transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

// ── Read-only view ─────────────────────────────────────────────────────────────

function ReadOnlyOrgInfo({ org }: { org: ReturnType<typeof useOrgDetail>['data'] }) {
  const fields = [
    { label: 'Company name', value: org?.name },
    { label: 'Workspace URL', value: org?.slug ? `my.workived.com/${org.slug}` : undefined },
    { label: 'Country', value: COUNTRIES.find((c) => c.value === org?.country_code)?.label ?? org?.country_code },
    { label: 'Timezone', value: TIMEZONES.find((t) => t.value === org?.timezone)?.label ?? org?.timezone },
    { label: 'Currency', value: CURRENCIES.find((c) => c.value === org?.currency_code)?.label ?? org?.currency_code },
  ]

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle id="general">Company info</SectionTitle>
      {fields.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-8">
          <p style={{ fontSize: 14, fontWeight: 600, color: S.textMuted }}>{label}</p>
          <p style={{ fontSize: 14, color: S.text, fontWeight: 500 }}>{value ?? '—'}</p>
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
  const currentUser = useAuthStore((s) => s.user)

  const acceptInvitation = useMutation({
    mutationFn: (token: string) =>
      organisationsApi.acceptInvitation({ token }).then((r) => r.data.data),
    onSuccess: (result) => {
      if (currentUser) {
        setAuth({ access_token: result.access_token, user: currentUser })
      }
      navigate({ to: '/overview' })
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p style={{ fontSize: 15, color: S.textMuted, lineHeight: 1.6 }}>
          You haven&apos;t set up a workspace yet. Create one or accept a pending invitation below.
        </p>
        <button
          onClick={() => navigate({ to: '/setup-org' })}
          className="mt-4 px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background: colors.accent, color: '#FFFFFF' }}
        >
          Set up workspace
        </button>
      </div>

      {myInvitations.length > 0 && (
        <>
          <Divider />
          <div className="flex flex-col gap-3">
            <p style={{ fontSize: 12, fontWeight: 600, color: S.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Pending invitations
            </p>
            {myInvitations.map((inv: MyInvitation) => {
              const token = extractInviteToken(inv.invite_url)
              return (
                <div key={inv.id} className="flex items-center justify-between gap-4 py-3"
                  style={{ borderBottom: `1px solid ${S.divider}` }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{inv.org_name}</p>
                    <p style={{ fontSize: 13, color: S.textDim, marginTop: 2 }}>
                      Invited as <span style={{ color: '#9B8FF7', fontWeight: 600 }}>{inv.role}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => acceptInvitation.mutate(token)}
                    disabled={acceptInvitation.isPending || !token}
                    className="shrink-0 px-4 py-1.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                    style={{ background: colors.accent, color: '#FFFFFF' }}
                  >
                    {acceptInvitation.isPending ? 'Joining...' : 'Accept'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sidebar nav ────────────────────────────────────────────────────────────────

function SideNav({ items, activeId }: { items: typeof NAV_ITEMS; activeId: string }) {
  return (
    <nav className="hidden lg:flex flex-col gap-0.5 sticky top-8 self-start pt-2" style={{ minWidth: 180 }}>
      {items.map((item) => {
        const isActive = activeId === item.id
        const isDanger = item.id === 'danger'
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              color: isDanger ? 'rgba(248,113,113,0.8)' : isActive ? S.text : S.textMuted,
              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function CompanyPage() {
  const hasOrg = useHasOrg()
  const { data: org, isLoading, isError } = useOrgDetail()
  const canEdit = useCanEditOrgSettings()
  const [activeSection] = useState('general')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: moduleBackgrounds.settings }}>
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold"
        style={{ background: colors.accent, color: '#FFFFFF' }}>
        Skip to main content
      </a>

      {/* Header */}
      <div className="px-10 pt-8 pb-2">
        <WorkivedLogo size={32} showWordmark variant="light" />
      </div>

      {/* Page title */}
      <div className="px-10 pt-6 pb-2">
        <h1 style={{ fontSize: typography.h1.size, fontWeight: typography.h1.weight, letterSpacing: typography.h1.tracking, color: '#FFFFFF' }}>
          Company settings
        </h1>
        <p style={{ fontSize: 15, color: S.textMuted, marginTop: 4 }}>
          {org ? org.name : 'Manage your workspace configuration'}
        </p>
      </div>

      {/* Two-column layout: sidebar + content */}
      <div id="main-content" className="flex-1 px-10 pt-8 pb-32 flex gap-12">

        {/* Sidebar — only shown when org exists and loaded */}
        {hasOrg && !isLoading && !isError && canEdit && (
          <SideNav items={NAV_ITEMS} activeId={activeSection} />
        )}

        {/* Content */}
        <main className="flex-1 flex flex-col gap-10">

          {!hasOrg && <NoOrgView />}

          {hasOrg && isLoading && (
            <div className="flex flex-col gap-6" aria-label="Loading company settings">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          )}

          {hasOrg && isError && (
            <Banner variant="error" message="Failed to load company settings. Please refresh the page." />
          )}

          {hasOrg && !isLoading && !isError && (
            <>
              {!canEdit && (
                <Banner variant="info" message="You have view-only access. Contact an admin to make changes." />
              )}

              {canEdit ? (
                <>
                  <CompanyInfoSection />
                  <Divider />
                  <LocationSection />
                  <Divider />
                  <PlanSection />
                  <Divider />
                  <AttendanceSection />
                  <Divider />
                  <TransferOwnershipSection />
                </>
              ) : (
                <>
                  <ReadOnlyOrgInfo org={org} />
                  <Divider />
                  <PlanSection />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
