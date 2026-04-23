import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/stores/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { colors } from '@/design/tokens'
import type { ApiError } from '@/types/api'
import { AxiosError } from 'axios'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

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
      {/* Smaller circle inside */}
      <div
        className="absolute -bottom-4 -right-4"
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.08)',
        }}
      />
      {/* Accent dot bottom-right */}
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
      <svg
        className="absolute top-8 right-8"
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
      >
        <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <circle cx="60" cy="60" r="35" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <circle cx="90" cy="30" r="5" fill="rgba(155,143,247,0.6)" />
      </svg>

      {/* Dot grid top-left */}
      <svg
        className="absolute top-16 left-12"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
      >
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
      <svg
        className="absolute top-10 left-40"
        width="48"
        height="80"
        viewBox="0 0 48 80"
        fill="none"
      >
        <path
          d="M8 0 V40 C8 56 16 64 24 64 C32 64 40 56 40 40 V0"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Half circle top-left */}
      <svg
        className="absolute top-6 left-20"
        width="40"
        height="20"
        viewBox="0 0 40 20"
        fill="none"
      >
        <path
          d="M0 20 A20 20 0 0 1 40 20"
          fill="rgba(255,255,255,0.1)"
        />
      </svg>

      {/* Small X mark */}
      <svg
        className="absolute bottom-44 left-40"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <line x1="4" y1="4" x2="16" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="4" x2="4" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* Floating accent dot left-center */}
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

function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { redirect } = Route.useSearch()

  // Guard against open redirect — only allow relative paths starting with /
  const safeRedirect = redirect?.startsWith('/') ? redirect : undefined

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const login = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data).then((r) => r.data.data),
    onSuccess: (data) => {
      setAuth(data)

      // Check if user needs to verify email
      if (!data.user.is_verified) {
        navigate({ to: '/verify-email-required' })
        return
      }

      // Redirect to original destination or overview
      if (safeRedirect) {
        window.location.href = safeRedirect
      } else {
        navigate({ to: '/overview' })
      }
    },
  })

  const apiError =
    login.error instanceof AxiosError
      ? (login.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  return (
    <div
      className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-hidden"
      data-testid="login-page"
      style={{
        background: 'linear-gradient(145deg, #E8E5FD 0%, #D5D1F7 50%, #E0DDFB 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Background texture */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large arc top-right */}
        <svg className="absolute -top-32 -right-32" width="500" height="500" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="220" stroke="rgba(99,87,232,0.15)" strokeWidth="2.5" />
          <circle cx="250" cy="250" r="180" stroke="rgba(99,87,232,0.11)" strokeWidth="2" />
          <circle cx="250" cy="250" r="140" stroke="rgba(99,87,232,0.07)" strokeWidth="2" />
        </svg>
        {/* Smaller arc bottom-left */}
        <svg className="absolute -bottom-24 -left-24" width="360" height="360" viewBox="0 0 360 360" fill="none">
          <circle cx="180" cy="180" r="160" stroke="rgba(99,87,232,0.14)" strokeWidth="2.5" />
          <circle cx="180" cy="180" r="120" stroke="rgba(99,87,232,0.09)" strokeWidth="2" />
        </svg>
        {/* Wavy lines top-left */}
        <svg className="absolute top-12 left-12" width="220" height="100" viewBox="0 0 220 100" fill="none">
          <path d="M0 50 Q55 10 110 50 Q165 90 220 50" stroke="rgba(99,87,232,0.13)" strokeWidth="2" fill="none" />
          <path d="M0 70 Q55 30 110 70 Q165 110 220 70" stroke="rgba(99,87,232,0.08)" strokeWidth="2" fill="none" />
        </svg>
        {/* Wavy lines bottom-right */}
        <svg className="absolute bottom-16 right-16" width="260" height="100" viewBox="0 0 260 100" fill="none">
          <path d="M0 50 Q65 10 130 50 Q195 90 260 50" stroke="rgba(99,87,232,0.13)" strokeWidth="2" fill="none" />
          <path d="M0 70 Q65 30 130 70 Q195 110 260 70" stroke="rgba(99,87,232,0.08)" strokeWidth="2" fill="none" />
        </svg>
        {/* Dot grid bottom-right */}
        <svg className="absolute bottom-40 right-48" width="80" height="80" viewBox="0 0 80 80" fill="none">
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={`bg-dot-${i}`} cx={10 + (i % 4) * 20} cy={10 + Math.floor(i / 4) * 20} r="2.5" fill="rgba(99,87,232,0.12)" />
          ))}
        </svg>
        {/* Dot grid top-left */}
        <svg className="absolute top-40 left-48" width="60" height="60" viewBox="0 0 60 60" fill="none">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={`bg-dot2-${i}`} cx={10 + (i % 3) * 20} cy={10 + Math.floor(i / 3) * 20} r="2" fill="rgba(99,87,232,0.10)" />
          ))}
        </svg>
        {/* Accent dots */}
        <div className="absolute top-[20%] right-[12%]" style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(99,87,232,0.18)' }} />
        <div className="absolute bottom-[25%] left-[10%]" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,87,232,0.12)' }} />
        <div className="absolute top-[60%] right-[8%]" style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(99,87,232,0.14)' }} />
      </div>

      {/* Outer card container */}
      <div
        className="flex w-full overflow-hidden relative z-10"
        style={{
          maxWidth: 1100,
          maxHeight: 720,
          height: '90vh',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(99,87,232,0.15), 0 0 0 1px rgba(255,255,255,0.5)',
        }}
      >
      {/* Left Side - Purple Gradient with Decorative Shapes */}
      <div
        className="hidden lg:flex lg:w-[54%] flex-col justify-between gap-6 p-14 relative"
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
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1.1,
              color: colors.ink0,
            }}
          >
            Your team,
            <br />
            simplified.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.65)',
              marginTop: 16,
              lineHeight: 1.7,
              maxWidth: 420,
            }}
          >
            Everything you need to manage your team—attendance, leave, and daily ops in one beautiful workspace.
          </p>
        </div>

        {/* Illustration - One person managing everything (behind text) */}
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-40" style={{ marginTop: -240 }}>
          <svg width="320" height="220" viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Desk surface */}
            <ellipse cx="160" cy="205" rx="130" ry="14" fill="rgba(255,255,255,0.06)" />

            {/* Central person - the founder/manager */}
            <circle cx="160" cy="148" r="20" fill="rgba(255,255,255,0.2)" />
            <circle cx="160" cy="140" r="11" fill="rgba(255,255,255,0.3)" />
            <path d="M140 168 C140 157 149 150 160 150 C171 150 180 157 180 168" fill="rgba(255,255,255,0.2)" />

            {/* Laptop in front */}
            <path d="M130 178 L132 162 C132 160 134 158 136 158 L184 158 C186 158 188 160 188 162 L190 178 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
            <rect x="136" y="161" width="48" height="14" rx="2" fill="rgba(79,70,200,0.5)" />
            {/* Screen mini-dashboard */}
            <rect x="140" y="164" width="12" height="3" rx="1" fill="rgba(255,255,255,0.4)" />
            <rect x="140" y="169" width="8" height="2" rx="1" fill="rgba(155,143,247,0.6)" />
            <rect x="156" y="164" width="6" height="8" rx="1" fill="rgba(99,232,180,0.5)" />
            <rect x="164" y="166" width="6" height="6" rx="1" fill="rgba(155,143,247,0.5)" />
            <rect x="172" y="163" width="6" height="9" rx="1" fill="rgba(255,255,255,0.3)" />
            {/* Laptop base */}
            <rect x="122" y="178" width="76" height="5" rx="2.5" fill="rgba(255,255,255,0.18)" />

            {/* Orbiting automation cards with connection arcs */}

            {/* Arc ring */}
            <ellipse cx="160" cy="130" rx="120" ry="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="6 4" />

            {/* Attendance card - top left */}
            <g transform="translate(28, 42)">
              <rect width="58" height="40" rx="8" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              {/* Clock icon */}
              <circle cx="20" cy="16" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
              <line x1="20" y1="12" x2="20" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="16" x2="23" y2="18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="32" y="12" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
              <rect x="32" y="18" width="12" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
              {/* Auto-check */}
              <circle cx="46" cy="32" r="5" fill="rgba(99,232,180,0.5)" />
              <path d="M43.5 32 L45.5 34 L49 30.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            {/* Connection line to person */}
            <path d="M86 72 Q120 95 145 130" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4" />

            {/* Leave card - top right */}
            <g transform="translate(234, 38)">
              <rect width="58" height="40" rx="8" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              {/* Calendar icon */}
              <rect x="10" y="10" width="16" height="14" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
              <line x1="10" y1="16" x2="26" y2="16" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="15" y1="8" x2="15" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="21" y1="8" x2="21" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="32" y="12" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
              <rect x="32" y="18" width="12" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
              {/* Auto-approved badge */}
              <circle cx="46" cy="32" r="5" fill="rgba(155,143,247,0.6)" />
              <path d="M43 32 L45 34 L49 30" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            {/* Connection line to person */}
            <path d="M234 68 Q200 95 175 130" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4" />

            {/* Tasks card - left */}
            <g transform="translate(10, 120)">
              <rect width="54" height="50" rx="8" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              {/* Checklist */}
              <rect x="10" y="10" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="rgba(99,232,180,0.3)" />
              <path d="M12 14 L14 16 L17 12" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="22" y="12" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.25)" />
              <rect x="10" y="24" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="rgba(99,232,180,0.3)" />
              <path d="M12 28 L14 30 L17 26" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="22" y="26" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.25)" />
              <rect x="10" y="38" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" />
              <rect x="22" y="40" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
            </g>
            {/* Connection line */}
            <path d="M64 145 Q100 140 140 145" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4" />

            {/* Reports/Analytics card - right */}
            <g transform="translate(256, 115)">
              <rect width="54" height="50" rx="8" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              {/* Mini chart */}
              <rect x="10" y="32" width="7" height="10" rx="1.5" fill="rgba(155,143,247,0.6)" />
              <rect x="20" y="26" width="7" height="16" rx="1.5" fill="rgba(255,255,255,0.3)" />
              <rect x="30" y="20" width="7" height="22" rx="1.5" fill="rgba(155,143,247,0.6)" />
              {/* Trending arrow */}
              <path d="M12 16 L24 10 L38 14" stroke="rgba(99,232,180,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M34 10 L38 14 L34 18" stroke="rgba(99,232,180,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            {/* Connection line */}
            <path d="M256 140 Q220 140 180 145" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4" />

            {/* Automation sparkles around the person */}
            <g>
              <path d="M134 128 L136 124 L138 128 L142 130 L138 132 L136 136 L134 132 L130 130 Z" fill="rgba(99,232,204,0.5)" />
              <path d="M184 124 L185.5 121 L187 124 L190 125.5 L187 127 L185.5 130 L184 127 L181 125.5 Z" fill="rgba(155,143,247,0.5)" />
              <path d="M148 118 L149 116 L150 118 L152 119 L150 120 L149 122 L148 120 L146 119 Z" fill="rgba(255,255,255,0.35)" />
              <path d="M176 116 L177 114 L178 116 L180 117 L178 118 L177 120 L176 118 L174 117 Z" fill="rgba(255,255,255,0.3)" />
            </g>

            {/* Circular glow behind person */}
            <circle cx="160" cy="145" r="32" fill="rgba(155,143,247,0.08)" />
          </svg>
        </div>

        {/* Footer */}
        <p
          className="relative z-10"
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          © 2026 Workived. Built for modern founders.
        </p>
      </div>

      {/* Right Side - Form */}
      <div
        className="flex-1 flex items-center justify-center p-8 overflow-y-auto"
        style={{
          background: colors.ink0,
        }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-12">
            <div className="flex justify-center">
              <WorkivedLogo size={48} showWordmark={true} variant="dark" />
            </div>
            <p
              style={{
                fontSize: 14,
                color: colors.ink500,
                marginTop: 8,
              }}
            >
              HR & Operations Superapp
            </p>
          </div>

          {/* Form Card */}
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
                Welcome back
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: colors.ink500,
                  marginTop: 6,
                }}
              >
                Sign in to continue to your workspace
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => login.mutate(data))}
              className="space-y-5"
              data-testid="login-form"
            >
              {apiError && (
                <div
                  className="px-4 py-3 rounded-xl"
                  data-testid="login-error"
                  style={{
                    background: colors.errDim,
                    border: `1px solid ${colors.err}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      color: colors.errText,
                      fontWeight: 500,
                    }}
                  >
                    {apiError}
                  </p>
                </div>
              )}

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
                  data-testid="login-email-input"
                  className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: colors.ink50,
                    border: `1.5px solid ${colors.ink150}`,
                    color: colors.ink900,
                  }}
                  {...form.register('email')}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.accent
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                  }}
                  onBlur={(e) => {
                    form.register('email').onBlur(e)
                    e.currentTarget.style.borderColor = colors.ink150
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.ink300,
                  }}
                >
                  Email
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
                  autoComplete="current-password"
                  placeholder=" "
                  data-testid="login-password-input"
                  className="peer w-full pl-11 pr-4 pt-6 pb-2 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: colors.ink50,
                    border: `1.5px solid ${colors.ink150}`,
                    color: colors.ink900,
                  }}
                  {...form.register('password')}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.accent
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,87,232,0.1)'
                  }}
                  onBlur={(e) => {
                    form.register('password').onBlur(e)
                    e.currentTarget.style.borderColor = colors.ink150
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.ink300,
                  }}
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

              <div className="flex items-center justify-between">
                <label
                  className="group flex items-center gap-2.5 cursor-pointer select-none"
                  data-testid="login-remember-me"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                    />
                    <div
                      className="flex items-center justify-center rounded-md transition-all duration-200 peer-checked:scale-95 peer-checked:scale-100"
                      style={{
                        width: 20,
                        height: 20,
                        border: `2px solid ${colors.ink300}`,
                        borderRadius: 6,
                        background: colors.ink0,
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 peer-checked:opacity-100 transition-all duration-200"
                      style={{
                        background: colors.accent,
                        borderRadius: 6,
                        width: 20,
                        height: 20,
                      }}
                    >
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1.5 5L4.5 8L10.5 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: colors.ink500 }}>Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: 13, color: colors.accent, fontWeight: 600 }}
                  data-testid="login-forgot-password"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={login.isPending}
                data-testid="login-submit-btn"
                className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                style={{
                  background: colors.accent,
                  color: colors.ink0,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!login.isPending) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {login.isPending ? 'Signing in...' : 'Login'}
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

            {/* Google Sign In */}
            <GoogleButton />

            <p className="text-center mt-6" style={{ fontSize: 14, color: colors.ink500 }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                search={{ invite_token: undefined }}
                style={{ color: colors.accent, fontWeight: 600 }}
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

