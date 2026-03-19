import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useOrgDetail, useUpdateOrg, useTransferOwnership } from '@/lib/hooks/useOrganisation'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import type { ApiError } from '@/types/api'
import { AxiosError } from 'axios'

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractApiError(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiError | undefined)?.error?.message
  }
  return undefined
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-8 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#FFFFFF',
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}
    >
      {children}
    </label>
  )
}

function DarkInput({
  id,
  disabled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      disabled={disabled}
      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1.5px solid rgba(255,255,255,0.12)',
        color: '#FFFFFF',
      }}
      {...props}
    />
  )
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="px-4 py-3 rounded-xl"
      style={{ background: C.okDim, border: `1px solid ${C.ok}` }}
    >
      <p style={{ fontSize: 14, color: C.okText, fontWeight: 500 }}>{message}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="px-4 py-3 rounded-xl"
      style={{ background: C.errDim, border: `1px solid ${C.err}` }}
    >
      <p style={{ fontSize: 14, color: C.errText, fontWeight: 500 }}>{message}</p>
    </div>
  )
}

function PrimaryButton({
  children,
  disabled,
  type = 'button',
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
      style={{
        background: C.accent,
        color: '#FFFFFF',
      }}
    >
      {children}
    </button>
  )
}

// ── Company info card ──────────────────────────────────────────────────────────

function CompanyInfoCard() {
  const { data: org } = useOrgDetail()
  const updateOrg = useUpdateOrg()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<CompanyInfoForm>({
    resolver: zodResolver(companyInfoSchema),
    values: {
      name: org?.name ?? '',
      slug: org?.slug ?? '',
    },
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
    <Card>
      <CardTitle>Company info</CardTitle>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
        {apiError && <ErrorBanner message={apiError} />}
        {successMessage && <SuccessBanner message={successMessage} />}

        <div>
          <FieldLabel htmlFor="company-name">Company name</FieldLabel>
          <DarkInput
            id="company-name"
            type="text"
            placeholder="Acme Corp"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="company-slug">Workspace URL</FieldLabel>
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(255,255,255,0.12)' }}>
            <span
              className="px-3 py-3 text-sm select-none flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
            >
              workived.app/
            </span>
            <input
              id="company-slug"
              type="text"
              placeholder="acme-corp"
              className="flex-1 px-4 py-3 text-sm focus:outline-none bg-transparent"
              style={{ color: '#FFFFFF' }}
              {...form.register('slug')}
            />
          </div>
          {form.formState.errors.slug && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.slug.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={updateOrg.isPending}>
            {updateOrg.isPending ? 'Saving...' : 'Save changes'}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  )
}

// ── Location card ──────────────────────────────────────────────────────────────

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

function LocationCard() {
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
    <Card>
      <CardTitle>Location &amp; currency</CardTitle>

      {isLocked && (
        <div
          className="mb-5 px-4 py-3 rounded-xl"
          style={{ background: C.warnDim, border: `1px solid ${C.warn}` }}
        >
          <p style={{ fontSize: 14, color: C.warn, fontWeight: 500 }}>
            Location settings are locked after employees are added.
          </p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
        {apiError && <ErrorBanner message={apiError} />}
        {successMessage && <SuccessBanner message={successMessage} />}

        <div>
          <FieldLabel htmlFor="country-code">Country</FieldLabel>
          {isLocked ? (
            <p
              id="country-code"
              style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 500 }}
            >
              {COUNTRIES.find((c) => c.value === org?.country_code)?.label ?? org?.country_code}
            </p>
          ) : (
            <select
              id="country-code"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#FFFFFF',
              }}
              {...form.register('country_code')}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          {form.formState.errors.country_code && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.country_code.message}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
          {isLocked ? (
            <p
              id="timezone"
              style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 500 }}
            >
              {TIMEZONES.find((t) => t.value === org?.timezone)?.label ?? org?.timezone}
            </p>
          ) : (
            <select
              id="timezone"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#FFFFFF',
              }}
              {...form.register('timezone')}
            >
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {form.formState.errors.timezone && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.timezone.message}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="currency-code">Currency</FieldLabel>
          {isLocked ? (
            <p
              id="currency-code"
              style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 500 }}
            >
              {CURRENCIES.find((cur) => cur.value === org?.currency_code)?.label ?? org?.currency_code}
            </p>
          ) : (
            <select
              id="currency-code"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#FFFFFF',
              }}
              {...form.register('currency_code')}
            >
              {CURRENCIES.map((cur) => (
                <option key={cur.value} value={cur.value}>
                  {cur.label}
                </option>
              ))}
            </select>
          )}
          {form.formState.errors.currency_code && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.currency_code.message}
            </p>
          )}
        </div>

        {!isLocked && (
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? 'Saving...' : 'Save location'}
            </PrimaryButton>
          </div>
        )}
      </form>
    </Card>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard() {
  const { data: org } = useOrgDetail()

  if (!org) return null

  const limit = org.plan_employee_limit ?? null
  const count = org.employee_count ?? 0
  const usagePct = limit ? Math.min((count / limit) * 100, 100) : 0
  const isNearLimit = limit ? usagePct >= 80 : false
  const planLabel = org.plan === 'free' ? 'Free' : org.plan === 'pro' ? 'Pro' : 'Enterprise'

  return (
    <Card>
      <CardTitle>Plan</CardTitle>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{planLabel} plan</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {count} employee{count !== 1 ? 's' : ''}
              {limit ? ` of ${limit} included` : ' (no limit)'}
            </p>
          </div>

          {isNearLimit && (
            <a
              href="mailto:hello@workived.com?subject=Upgrade to Pro"
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{
                background: C.accent,
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Upgrade to Pro
            </a>
          )}
        </div>

        {limit && (
          <div>
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
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
              {Math.round(usagePct)}% of employee limit used
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Transfer ownership card ────────────────────────────────────────────────────

function TransferOwnershipCard() {
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
      onError: () => {
        setShowConfirm(false)
      },
    })
  }

  const handleCancel = () => {
    setShowConfirm(false)
    setPendingData(null)
  }

  return (
    <Card>
      <CardTitle>Transfer ownership</CardTitle>

      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
        Transfer this workspace to another admin. You will lose owner privileges.
        This action cannot be undone.
      </p>

      <form onSubmit={form.handleSubmit(handleSubmitIntent)} className="flex flex-col gap-5">
        {apiError && <ErrorBanner message={apiError} />}
        {successMessage && <SuccessBanner message={successMessage} />}

        <div>
          <FieldLabel htmlFor="new-owner-user-id">New owner&apos;s user ID</FieldLabel>
          <DarkInput
            id="new-owner-user-id"
            type="text"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            {...form.register('new_owner_user_id')}
          />
          {form.formState.errors.new_owner_user_id && (
            <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
              {form.formState.errors.new_owner_user_id.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
            style={{
              background: 'rgba(212,64,64,0.12)',
              color: C.err,
              border: `1px solid rgba(212,64,64,0.25)`,
            }}
          >
            Transfer ownership
          </button>
        </div>
      </form>

      {/* Confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-transfer-title"
        >
          <div
            className="w-full max-w-md p-8 rounded-2xl flex flex-col gap-5 mx-4"
            style={{
              background: '#1A1A2E',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <h3
              id="confirm-transfer-title"
              style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}
            >
              Confirm ownership transfer
            </h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              You are about to transfer ownership to user{' '}
              <span style={{ fontFamily: 'monospace', color: '#FFFFFF', wordBreak: 'break-all' }}>
                {pendingData?.new_owner_user_id}
              </span>
              . This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={transferOwnership.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{
                  background: C.err,
                  color: '#FFFFFF',
                }}
              >
                {transferOwnership.isPending ? 'Transferring...' : 'Yes, transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function CompanyPage() {
  const { data: org, isLoading, isError } = useOrgDetail()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: moduleBackgrounds.overview }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold"
        style={{ background: colors.accent, color: '#FFFFFF' }}
      >
        Skip to main content
      </a>

      {/* Header */}
      <div className="px-11 pt-10 pb-2">
        <WorkivedLogo size={32} showWordmark variant="light" />
      </div>

      <main id="main-content" className="flex-1 px-11 py-7 flex flex-col gap-7">
        {/* Title */}
        <div>
          <h1
            style={{
              fontSize: typography.h1.size,
              fontWeight: typography.h1.weight,
              letterSpacing: typography.h1.tracking,
              color: '#FFFFFF',
            }}
          >
            Company settings
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {org ? org.name : 'Manage your workspace configuration'}
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-5" aria-label="Loading company settings">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        )}

        {isError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-xl"
            style={{ background: C.errDim, border: `1px solid ${C.err}` }}
          >
            <p style={{ fontSize: 14, color: C.errText, fontWeight: 500 }}>
              Failed to load company settings. Please refresh the page.
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <CompanyInfoCard />
            <LocationCard />
            <PlanCard />
            <TransferOwnershipCard />
          </>
        )}
      </main>
    </div>
  )
}
