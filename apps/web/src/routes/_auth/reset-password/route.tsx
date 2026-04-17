import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, moduleBackgrounds } from '@/design/tokens'
import { AxiosError } from 'axios'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: ResetPasswordPage,
})

const schema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type FormData = z.infer<typeof schema>

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      authApi.resetPassword({ token, new_password: data.new_password }),
    onSuccess: () => {
      navigate({ to: '/login' })
    },
  })

  const apiError =
    mutation.error instanceof AxiosError
      ? (mutation.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className="w-full max-w-md p-10 rounded-3xl text-center"
          style={{
            background: colors.ink0,
            boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
          }}
        >
          <p style={{ fontSize: 15, color: colors.ink500 }}>
            Invalid or missing reset link.
          </p>
          <Link
            to="/forgot-password"
            className="block mt-6 font-semibold py-3.5 rounded-xl text-center"
            style={{ background: colors.accentDim, color: colors.accent, fontSize: 15 }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex" data-testid="reset-password-page">
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
            <div className="mb-8">
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: colors.ink900,
                }}
              >
                Set new password
              </h2>
              <p style={{ fontSize: 15, color: colors.ink500, marginTop: 6 }}>
                Must be at least 8 characters.
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-5"
              noValidate
              data-testid="reset-password-form"
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
                  htmlFor="new_password"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink700,
                    marginBottom: 8,
                  }}
                >
                  New password
                </label>
                <input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  data-testid="reset-password-new-input"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: colors.ink50,
                    border: `1.5px solid ${colors.ink100}`,
                    color: colors.ink900,
                  }}
                  {...form.register('new_password')}
                />
                {form.formState.errors.new_password && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.new_password.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink700,
                    marginBottom: 8,
                  }}
                >
                  Confirm new password
                </label>
                <input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  data-testid="reset-password-confirm-input"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: colors.ink50,
                    border: `1.5px solid ${colors.ink100}`,
                    color: colors.ink900,
                  }}
                  {...form.register('confirm_password')}
                />
                {form.formState.errors.confirm_password && (
                  <p style={{ fontSize: 13, color: colors.err, marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.confirm_password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                data-testid="reset-password-submit-btn"
                className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                  color: colors.ink0,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                }}
              >
                {mutation.isPending ? 'Updating...' : 'Update password'}
              </button>
            </form>

            <p className="text-center mt-6" style={{ fontSize: 14, color: colors.ink500 }}>
              <Link to="/login" style={{ color: colors.accent, fontWeight: 600 }}>
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
