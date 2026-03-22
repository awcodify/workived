import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import { useMyInvitations } from '@/lib/hooks/useInvitations'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, moduleBackgrounds } from '@/design/tokens'
import { extractApiError } from '@/lib/utils/errors'
import { extractInviteToken } from '@/lib/utils/url'
import type { MyInvitation } from '@/types/api'

export const Route = createFileRoute('/_auth/setup-org')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw redirect({ to: '/login' })
    }
  },
  component: SetupOrgPage,
})

function InvitationCard({
  invitation,
  onAccept,
  isPending,
}: {
  invitation: MyInvitation
  onAccept: (token: string) => void
  isPending: boolean
}) {
  // Extract raw token from invite_url (?token=...)
  const token = extractInviteToken(invitation.invite_url)

  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        background: colors.ink0,
        boxShadow: '0 4px 20px rgba(99,87,232,0.10), 0 0 0 1px rgba(99,87,232,0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: colors.ink900, marginBottom: 4 }}>
            {invitation.org_name}
          </p>
          <p style={{ fontSize: 13, color: colors.ink500, lineHeight: 1.5 }}>
            You've been invited as{' '}
            <span
              className="px-1.5 py-0.5 rounded text-xs font-semibold"
              style={{ background: colors.accentDim, color: colors.accent }}
            >
              {invitation.role}
            </span>
          </p>
        </div>
        <button
          onClick={() => onAccept(token)}
          disabled={isPending || !token}
          className="shrink-0 font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
            color: colors.ink0,
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(99,87,232,0.3)',
          }}
        >
          {isPending ? 'Joining…' : 'Accept & join'}
        </button>
      </div>
    </div>
  )
}

const COUNTRIES = [
  { code: 'ID', name: 'Indonesia', timezone: 'Asia/Jakarta', currency: 'IDR' },
  { code: 'AE', name: 'United Arab Emirates', timezone: 'Asia/Dubai', currency: 'AED' },
  { code: 'MY', name: 'Malaysia', timezone: 'Asia/Kuala_Lumpur', currency: 'MYR' },
  { code: 'SG', name: 'Singapore', timezone: 'Asia/Singapore', currency: 'SGD' },
] as const

const setupOrgSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Only lowercase letters, numbers, and hyphens'),
  country_code: z.string().min(1, 'Please select a country'),
})

type SetupOrgForm = z.infer<typeof setupOrgSchema>

function SetupOrgPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: myInvitationsData } = useMyInvitations()
  const myInvitations = myInvitationsData ?? []

  const form = useForm<SetupOrgForm>({
    resolver: zodResolver(setupOrgSchema),
    defaultValues: { name: '', slug: '', country_code: '' },
  })

  const setAccessToken = useAuthStore((s) => s.setAuth)
  const currentUser = useAuthStore((s) => s.user)

  const acceptInvitation = useMutation({
    mutationFn: (token: string) =>
      organisationsApi.acceptInvitation({ token }).then((r) => r.data.data),
    onSuccess: (result) => {
      if (currentUser) {
        setAccessToken({ access_token: result.access_token, user: currentUser })
      }
      navigate({ to: '/overview' })
    },
  })

  const createOrg = useMutation({
    mutationFn: (data: SetupOrgForm) => {
      const country = COUNTRIES.find((c) => c.code === data.country_code)
      return organisationsApi
        .create({
          name: data.name,
          slug: data.slug,
          country_code: data.country_code,
          timezone: country?.timezone ?? 'UTC',
          currency_code: country?.currency ?? 'IDR',
        })
        .then((r) => r.data.data)
    },
    onSuccess: (result) => {
      // Store the new JWT (now contains org_id + owner role) before navigating.
      // Without this, every tenant-guarded route returns 403.
      if (currentUser) {
        setAccessToken({ access_token: result.access_token, user: currentUser })
      }
      navigate({ to: '/overview' })
    },
  })

  const apiError = extractApiError(createOrg.error)

  // Auto-generate slug from company name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    form.setValue('name', name)
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63)
    form.setValue('slug', slug, { shouldValidate: form.formState.isSubmitted })
  }

  return (
    <div className="flex-1 flex">
      {/* Left Side - Branding */}
      <div
        className="hidden lg:flex lg:flex-1 flex-col justify-between p-16"
        style={{ background: moduleBackgrounds.dark }}
      >
        <div>
          <WorkivedLogo size={48} showWordmark={true} variant="light" />
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
            HR & Operations Superapp
          </p>
        </div>

        <div>
          <h2
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1.1,
              color: colors.ink0,
            }}
          >
            Set up your
            <br />
            <span style={{ color: '#9B8FF7' }}>workspace.</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 24,
              lineHeight: 1.7,
              maxWidth: 460,
            }}
          >
            Create your company workspace and start managing your team in under 2 minutes.
          </p>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Workived. Built for modern founders.
        </p>
      </div>

      {/* Right Side - Form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: `linear-gradient(135deg, ${colors.ink50} 0%, ${colors.accentDim} 100%)` }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-12">
            <div className="flex justify-center">
              <WorkivedLogo size={48} showWordmark={true} variant="dark" />
            </div>
            <p style={{ fontSize: 14, color: colors.ink500, marginTop: 8 }}>
              HR & Operations Superapp
            </p>
          </div>

          {/* Pending invitations — shown when the user was already invited */}
          {myInvitations.length > 0 && (
            <div className="mb-6 space-y-3">
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.ink500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                You've been invited
              </p>
              {myInvitations.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  invitation={inv}
                  onAccept={(token) => acceptInvitation.mutate(token)}
                  isPending={acceptInvitation.isPending}
                />
              ))}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ background: colors.ink100 }} />
                <span style={{ fontSize: 13, color: colors.ink300, fontWeight: 500 }}>
                  or create a new workspace
                </span>
                <div className="flex-1 h-px" style={{ background: colors.ink100 }} />
              </div>
            </div>
          )}

          {/* Form Card */}
          <div
            className="p-10 rounded-3xl"
            style={{
              background: colors.ink0,
              boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
            }}
          >
            <div className="mb-8">
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: colors.ink900,
                }}
              >
                Create your workspace
              </h2>
              <p style={{ fontSize: 15, color: colors.ink500, marginTop: 6 }}>
                {user?.full_name ? `Welcome, ${user.full_name}! ` : ''}Set up your company to get
                started.
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => createOrg.mutate(data))}
              className="space-y-5"
            >
              {apiError && (
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ background: colors.errDim, border: `1px solid ${colors.err}` }}
                >
                  <p style={{ fontSize: 14, color: colors.errText, fontWeight: 500 }}>{apiError}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink700,
                    marginBottom: 8,
                  }}
                >
                  Company name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Acme Corp"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}`, color: colors.ink900 }}
                  {...form.register('name')}
                  onChange={handleNameChange}
                />
                {form.formState.errors.name && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="slug"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink700,
                    marginBottom: 8,
                  }}
                >
                  Workspace URL
                </label>
                <div
                  className="flex items-center rounded-xl overflow-hidden"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}` }}
                >
                  <span
                    className="px-4 py-3.5 text-sm select-none"
                    style={{ color: colors.ink500, background: colors.ink100 }}
                  >
                    workived.com/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    placeholder="acme-corp"
                    className="flex-1 px-3 py-3.5 text-sm focus:outline-none bg-transparent"
                    style={{ color: colors.ink900 }}
                    {...form.register('slug')}
                  />
                </div>
                {form.formState.errors.slug && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.slug.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="country_code"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink700,
                    marginBottom: 8,
                  }}
                >
                  Country
                </label>
                <select
                  id="country_code"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all appearance-none"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}`, color: colors.ink900 }}
                  {...form.register('country_code')}
                >
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.country_code && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.country_code.message}
                  </p>
                )}
                {form.watch('country_code') && (
                  <p style={{ fontSize: 12, color: colors.ink500, marginTop: 6 }}>
                    Timezone:{' '}
                    {COUNTRIES.find((c) => c.code === form.watch('country_code'))?.timezone} —
                    Currency:{' '}
                    {COUNTRIES.find((c) => c.code === form.watch('country_code'))?.currency}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={createOrg.isPending}
                className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                  color: colors.ink0,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                }}
              >
                {createOrg.isPending ? 'Creating workspace...' : 'Create workspace'}
              </button>
            </form>

            <p className="text-center mt-6" style={{ fontSize: 13, color: colors.ink300 }}>
              Free for up to 25 employees. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
