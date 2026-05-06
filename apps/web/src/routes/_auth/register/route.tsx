import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { colors } from '@/design/tokens'
import { extractApiError } from '@/lib/utils/errors'
import { useEffect } from 'react'

export const Route = createFileRoute('/_auth/register')({
  validateSearch: (search: Record<string, unknown>) => ({
    invite_token: typeof search.invite_token === 'string' ? search.invite_token : undefined,
  }),
  component: RegisterPage,
})

const registerSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
})

type RegisterForm = z.infer<typeof registerSchema>

/** Decorative shapes for the left panel */
function DecorativeShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large circle bottom-right */}
      <div
        className="absolute -bottom-16 -right-16"
        style={{
          width: 320,
          height: 320,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.12)',
        }}
      />
      <div
        className="absolute -bottom-4 -right-4"
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.08)',
        }}
      />
      <div
        className="absolute bottom-24 right-28"
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'rgba(155,143,247,0.7)',
        }}
      />

      {/* Top-right curved lines */}
      <svg className="absolute top-8 right-8" width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <circle cx="60" cy="60" r="35" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <circle cx="90" cy="30" r="5" fill="rgba(155,143,247,0.6)" />
      </svg>

      {/* Dot grid top-left */}
      <svg className="absolute top-16 left-12" width="80" height="80" viewBox="0 0 80 80" fill="none">
        {Array.from({ length: 16 }, (_, i) => (
          <circle
            key={i}
            cx={10 + (i % 4) * 20}
            cy={10 + Math.floor(i / 4) * 20}
            r="2.5"
            fill="rgba(255,255,255,0.2)"
          />
        ))}
      </svg>

      {/* Hanging U-shape */}
      <svg className="absolute top-10 left-40" width="48" height="80" viewBox="0 0 48 80" fill="none">
        <path
          d="M8 0 V40 C8 56 16 64 24 64 C32 64 40 56 40 40 V0"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Half circle top-left */}
      <svg className="absolute top-6 left-20" width="40" height="20" viewBox="0 0 40 20" fill="none">
        <path d="M0 20 A20 20 0 0 1 40 20" fill="rgba(255,255,255,0.1)" />
      </svg>

      {/* Small X mark */}
      <svg className="absolute bottom-44 left-40" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <line x1="4" y1="4" x2="16" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="4" x2="4" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* Floating accent dot */}
      <div
        className="absolute left-16 bottom-56"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(99,232,204,0.5)',
        }}
      />
    </div>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { invite_token } = Route.useSearch()

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', password: '', password_confirmation: '' },
  })

  // Verify invitation token and pre-fill email if valid
  const { data: invitationData } = useQuery({
    queryKey: ['verify-invitation', invite_token],
    queryFn: () => organisationsApi.verifyInvitation(invite_token!).then((r) => r.data.data),
    enabled: !!invite_token,
  })

  // Pre-fill email when invitation is verified
  useEffect(() => {
    if (invitationData?.is_valid && invitationData.email) {
      form.setValue('email', invitationData.email)
    }
  }, [invitationData, form])

  const register = useMutation({
    mutationFn: async (data: RegisterForm) => {
      // 1. Register the user
      await authApi.register(data)
      // 2. Immediately log them in
      const loginRes = await authApi.login({ email: data.email, password: data.password })
      return loginRes.data.data
    },
    onSuccess: (data) => {
      setAuth(data)

      // Invited users skip the email verification gate — the invitation was sent to
      // their email (proving ownership) and AcceptInvitation marks them as verified.
      if (invite_token) {
        navigate({ to: '/invite', search: { token: invite_token } })
        return
      }

      // Normal registration: require email verification before org setup.
      if (!data.user.is_verified) {
        navigate({ to: '/verify-email-required' })
        return
      }

      navigate({ to: '/setup-org' })
    },
  })

  const apiError = extractApiError(register.error)

  return (
    <div
      className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-hidden"
      data-testid="register-page"
      style={{
        background: 'linear-gradient(145deg, #E8E5FD 0%, #D5D1F7 50%, #E0DDFB 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Background texture */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute -top-32 -right-32" width="500" height="500" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="220" stroke="rgba(99,87,232,0.15)" strokeWidth="2.5" />
          <circle cx="250" cy="250" r="180" stroke="rgba(99,87,232,0.11)" strokeWidth="2" />
          <circle cx="250" cy="250" r="140" stroke="rgba(99,87,232,0.07)" strokeWidth="2" />
        </svg>
        <svg className="absolute -bottom-24 -left-24" width="360" height="360" viewBox="0 0 360 360" fill="none">
          <circle cx="180" cy="180" r="160" stroke="rgba(99,87,232,0.14)" strokeWidth="2.5" />
          <circle cx="180" cy="180" r="120" stroke="rgba(99,87,232,0.09)" strokeWidth="2" />
        </svg>
        <svg className="absolute top-12 left-12" width="220" height="100" viewBox="0 0 220 100" fill="none">
          <path d="M0 50 Q55 10 110 50 Q165 90 220 50" stroke="rgba(99,87,232,0.13)" strokeWidth="2" fill="none" />
          <path d="M0 70 Q55 30 110 70 Q165 110 220 70" stroke="rgba(99,87,232,0.08)" strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute bottom-16 right-16" width="260" height="100" viewBox="0 0 260 100" fill="none">
          <path d="M0 50 Q65 10 130 50 Q195 90 260 50" stroke="rgba(99,87,232,0.13)" strokeWidth="2" fill="none" />
          <path d="M0 70 Q65 30 130 70 Q195 110 260 70" stroke="rgba(99,87,232,0.08)" strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute bottom-40 right-48" width="80" height="80" viewBox="0 0 80 80" fill="none">
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={`bg-dot-${i}`} cx={10 + (i % 4) * 20} cy={10 + Math.floor(i / 4) * 20} r="2.5" fill="rgba(99,87,232,0.12)" />
          ))}
        </svg>
        <svg className="absolute top-40 left-48" width="60" height="60" viewBox="0 0 60 60" fill="none">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={`bg-dot2-${i}`} cx={10 + (i % 3) * 20} cy={10 + Math.floor(i / 3) * 20} r="2" fill="rgba(99,87,232,0.10)" />
          ))}
        </svg>
        <div className="absolute top-[20%] right-[12%]" style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(99,87,232,0.18)' }} />
        <div className="absolute bottom-[25%] left-[10%]" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,87,232,0.12)' }} />
        <div className="absolute top-[60%] right-[8%]" style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(99,87,232,0.14)' }} />
      </div>

      {/* Outer card container */}
      <div
        className="flex w-full overflow-hidden relative z-10"
        style={{
          maxWidth: 1100,
          maxHeight: 760,
          height: '92vh',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(99,87,232,0.15), 0 0 0 1px rgba(255,255,255,0.5)',
        }}
      >
        {/* Left Side - Purple Gradient with Decorative Shapes */}
        <div
          className="hidden lg:flex lg:w-[54%] flex-col justify-between p-14 relative"
          style={{
            background: 'linear-gradient(160deg, #7B6FE8 0%, #6357E8 40%, #8F86F0 100%)',
          }}
        >
          <DecorativeShapes />

          {/* Logo */}
          <div className="relative z-10">
            <WorkivedLogo size={44} showWordmark={true} variant="light" />
          </div>

          {/* Hero Message */}
          <div className="relative z-10">
            <h2
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: '-0.05em',
                lineHeight: 1.1,
                color: colors.ink0,
              }}
            >
              {invite_token ? (
                <>
                  Join your
                  <br />
                  team.
                </>
              ) : (
                <>
                  Start managing
                  <br />
                  your team.
                </>
              )}
            </h2>
            <p
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.65)',
                marginTop: 24,
                lineHeight: 1.7,
                maxWidth: 400,
              }}
            >
              {invite_token
                ? 'Create an account to accept your invitation and get started with your team.'
                : 'Free for up to 15 employees. Set up your workspace in under 2 minutes.'}
            </p>
          </div>

          {/* Footer */}
          <p
            className="relative z-10"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}
          >
            © 2026 Workived. Built for modern founders.
          </p>
        </div>

        {/* Right Side - Form */}
        <div
          className="flex-1 flex items-center justify-center p-8 overflow-y-auto"
          style={{ background: colors.ink0 }}
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

            <div className="w-full">
              <div className="text-center mb-8">
                <h2
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.ink900,
                  }}
                >
                  Create your account
                </h2>
                <p style={{ fontSize: 14, color: colors.ink500, marginTop: 6 }}>
                  {invite_token && invitationData?.is_valid
                    ? `Join ${invitationData.org_name} — create your account below`
                    : invite_token
                      ? "You've been invited — create an account to join your workspace."
                      : 'Get started with Workived — free for teams up to 15'}
                </p>
              </div>

              {invitationData && !invitationData.is_valid && (
                <div
                  className="px-4 py-3 rounded-xl mb-5"
                  style={{
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <p style={{ fontSize: 14, color: '#dc2626', fontWeight: 500 }}>
                    {invitationData.error_message || 'Invalid invitation'}
                  </p>
                </div>
              )}

              <form
                onSubmit={form.handleSubmit((data) => register.mutate(data))}
                className="space-y-5"
                data-testid="register-form"
              >
                {apiError && (
                  <div
                    className="px-4 py-3 rounded-xl"
                    data-testid="register-error"
                    style={{ background: colors.errDim, border: `1px solid ${colors.err}` }}
                  >
                    <p style={{ fontSize: 14, color: colors.errText, fontWeight: 500 }}>
                      {apiError}
                    </p>
                  </div>
                )}

                {/* Full name */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colors.ink300 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                  </div>
                  <input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    placeholder=" "
                    data-testid="register-full-name-input"
                    className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: colors.ink50,
                      border: `1.5px solid ${colors.ink150}`,
                      color: colors.ink900,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.ink150
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    {...form.register('full_name')}
                  />
                  <label
                    htmlFor="full_name"
                    className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                    style={{ fontSize: 14, fontWeight: 500, color: colors.ink300 }}
                  >
                    Full name
                  </label>
                  {form.formState.errors.full_name && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 12, color: colors.err, fontWeight: 500 }}>
                        {form.formState.errors.full_name.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colors.ink300 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 4L12 13L2 4" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder=" "
                    data-testid="register-email-input"
                    disabled={invitationData?.is_valid}
                    className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: invitationData?.is_valid ? colors.ink100 : colors.ink50,
                      border: `1.5px solid ${colors.ink150}`,
                      color: colors.ink900,
                      cursor: invitationData?.is_valid ? 'not-allowed' : 'text',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.ink150
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    {...form.register('email')}
                  />
                  <label
                    htmlFor="email"
                    className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                    style={{ fontSize: 14, fontWeight: 500, color: colors.ink300 }}
                  >
                    Email{invitationData?.is_valid ? ' (from invitation)' : ''}
                  </label>
                  {form.formState.errors.email && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 12, color: colors.err, fontWeight: 500 }}>
                        {form.formState.errors.email.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colors.ink300 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <circle cx="12" cy="16.5" r="1.5" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder=" "
                    data-testid="register-password-input"
                    className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: colors.ink50,
                      border: `1.5px solid ${colors.ink150}`,
                      color: colors.ink900,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.ink150
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    {...form.register('password')}
                  />
                  <label
                    htmlFor="password"
                    className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                    style={{ fontSize: 14, fontWeight: 500, color: colors.ink300 }}
                  >
                    Password
                  </label>
                  {form.formState.errors.password && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 12, color: colors.err, fontWeight: 500 }}>
                        {form.formState.errors.password.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Password Confirmation */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colors.ink300 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <circle cx="12" cy="16.5" r="1.5" />
                    </svg>
                  </div>
                  <input
                    id="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    placeholder=" "
                    data-testid="register-password-confirmation-input"
                    className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: colors.ink50,
                      border: `1.5px solid ${colors.ink150}`,
                      color: colors.ink900,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.ink150
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    {...form.register('password_confirmation')}
                  />
                  <label
                    htmlFor="password_confirmation"
                    className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                    style={{ fontSize: 14, fontWeight: 500, color: colors.ink300 }}
                  >
                    Confirm password
                  </label>
                  {form.formState.errors.password_confirmation && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 12, color: colors.err, fontWeight: 500 }}>
                        {form.formState.errors.password_confirmation.message}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={register.isPending}
                  data-testid="register-submit-btn"
                  className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  style={{
                    background: colors.accent,
                    color: colors.ink0,
                    fontSize: 15,
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => {
                    if (!register.isPending) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {register.isPending ? 'Creating account...' : 'Create account'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: `1px solid ${colors.ink150}` }}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span
                    className="px-3"
                    style={{ background: colors.ink0, color: colors.ink500, fontSize: 13 }}
                  >
                    or
                  </span>
                </div>
              </div>

              {/* Google Sign Up */}
              <GoogleButton text="Sign up with Google" />

              <p className="text-center mt-6" style={{ fontSize: 14, color: colors.ink500 }}>
                Already have an account?{' '}
                <Link
                  to="/login"
                  search={{ redirect: invite_token ? `/invite?token=${invite_token}` : undefined }}
                  style={{ color: colors.accent, fontWeight: 600 }}
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
