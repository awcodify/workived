import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, moduleBackgrounds } from '@/design/tokens'
import { AxiosError } from 'axios'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

const schema = z.object({
  email: z.email('Invalid email address'),
})

type FormData = z.infer<typeof schema>

function ForgotPasswordPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.forgotPassword(data),
  })

  const apiError =
    mutation.error instanceof AxiosError
      ? (mutation.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  return (
    <div className="flex-1 flex" data-testid="forgot-password-page">
      {/* Left panel */}
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
            Your team,
            <br />
            <span style={{ color: '#9B8FF7' }}>simplified.</span>
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Workived. Built for modern founders.
        </p>
      </div>

      {/* Right panel */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{
          background: `linear-gradient(135deg, ${colors.ink50} 0%, ${colors.accentDim} 100%)`,
        }}
      >
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-12">
            <div className="flex justify-center">
              <WorkivedLogo size={48} showWordmark={true} variant="dark" />
            </div>
          </div>

          <div
            className="p-10 rounded-3xl"
            style={{
              background: colors.ink0,
              boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
            }}
          >
            {mutation.isSuccess ? (
              /* Success state */
              <div className="text-center" data-testid="forgot-password-success">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: colors.okDim }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z"
                      stroke={colors.ok}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 6L12 13L2 6"
                      stroke={colors.ok}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.ink900,
                    marginBottom: 8,
                  }}
                >
                  Check your email
                </h2>
                <p style={{ fontSize: 15, color: colors.ink500, lineHeight: 1.6 }}>
                  If that email is registered, we've sent a password reset link. Check your inbox and spam folder.
                </p>
                <Link
                  to="/login"
                  className="block mt-8 w-full font-semibold py-3.5 rounded-xl text-center transition-all"
                  style={{ background: colors.accentDim, color: colors.accent, fontSize: 15 }}
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-8">
                  <h2
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      color: colors.ink900,
                    }}
                  >
                    Forgot password?
                  </h2>
                  <p style={{ fontSize: 15, color: colors.ink500, marginTop: 6 }}>
                    Enter your email and we'll send a reset link.
                  </p>
                </div>

                <form
                  onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                  className="space-y-5"
                  noValidate
                  data-testid="forgot-password-form"
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
                      htmlFor="email"
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.ink700,
                        marginBottom: 8,
                      }}
                    >
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      data-testid="forgot-password-email-input"
                      className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                      style={{
                        background: colors.ink50,
                        border: `1.5px solid ${colors.ink100}`,
                        color: colors.ink900,
                      }}
                      {...form.register('email')}
                    />
                    {form.formState.errors.email && (
                      <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    data-testid="forgot-password-submit-btn"
                    className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                      color: colors.ink0,
                      fontSize: 15,
                      letterSpacing: '-0.01em',
                      boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                    }}
                  >
                    {mutation.isPending ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>

                <p className="text-center mt-6" style={{ fontSize: 14, color: colors.ink500 }}>
                  Remember your password?{' '}
                  <Link to="/login" style={{ color: colors.accent, fontWeight: 600 }}>
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
