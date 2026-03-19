import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/stores/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, moduleBackgrounds } from '@/design/tokens'
import { extractApiError } from '@/lib/utils/errors'

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
})

type RegisterForm = z.infer<typeof registerSchema>

function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { invite_token } = Route.useSearch()

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', password: '' },
  })

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
      if (invite_token) {
        // Came from an invite link — go accept the invitation instead of creating a workspace
        navigate({ to: '/invite', search: { token: invite_token } })
      } else {
        navigate({ to: '/setup-org' })
      }
    },
  })

  const apiError = extractApiError(register.error)

  return (
    <div className="flex-1 flex">
      {/* Left Side - Branding */}
      <div
        className="hidden lg:flex lg:flex-1 flex-col justify-between p-16"
        style={{ background: moduleBackgrounds.overview }}
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
            {invite_token ? (
              <>
                Join your
                <br />
                <span style={{ color: '#9B8FF7' }}>team.</span>
              </>
            ) : (
              <>
                Start managing
                <br />
                <span style={{ color: '#9B8FF7' }}>your team.</span>
              </>
            )}
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
            {invite_token
              ? "Create an account to accept your invitation and get started with your team."
              : "Free for up to 25 employees. Set up your workspace in under 2 minutes."}
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
                Create your account
              </h2>
              <p style={{ fontSize: 15, color: colors.ink500, marginTop: 6 }}>
                {invite_token
                  ? "You've been invited — create an account to join your workspace."
                  : 'Get started with Workived — free for teams up to 25'}
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => register.mutate(data))}
              className="space-y-5"
            >
              {apiError && (
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ background: colors.errDim, border: `1px solid ${colors.err}` }}
                >
                  <p style={{ fontSize: 14, color: colors.errText, fontWeight: 500 }}>
                    {apiError}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="full_name"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: colors.ink700, marginBottom: 8 }}
                >
                  Full name
                </label>
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ahmad Rizky"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}`, color: colors.ink900 }}
                  {...form.register('full_name')}
                />
                {form.formState.errors.full_name && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: colors.ink700, marginBottom: 8 }}
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}`, color: colors.ink900 }}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: colors.ink700, marginBottom: 8 }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: colors.ink50, border: `1.5px solid ${colors.ink100}`, color: colors.ink900 }}
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={register.isPending}
                className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: colors.accent,
                  color: colors.ink0,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                }}
              >
                {register.isPending ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="text-center mt-6" style={{ fontSize: 14, color: colors.ink500 }}>
              Already have an account?{' '}
              <Link
                to="/login"
                search={{ redirect: undefined }}
                style={{ color: colors.accent, fontWeight: 600 }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
