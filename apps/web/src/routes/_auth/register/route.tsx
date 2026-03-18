import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/stores/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import type { ApiError } from '@/types/api'
import { AxiosError } from 'axios'

export const Route = createFileRoute('/_auth/register')({
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
      // After registration, user needs to create an org (or accept an invite)
      navigate({ to: '/setup-org' })
    },
  })

  const apiError =
    register.error instanceof AxiosError
      ? (register.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  return (
    <div className="flex-1 flex">
      {/* Left Side - Branding */}
      <div
        className="hidden lg:flex lg:flex-1 flex-col justify-between p-16"
        style={{ background: '#0C0C0F' }}
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
              color: '#FFFFFF',
            }}
          >
            Start managing
            <br />
            <span style={{ color: '#9B8FF7' }}>your team.</span>
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
            Free for up to 25 employees. Set up your workspace in under 2 minutes.
          </p>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Workived. Built for modern founders.
        </p>
      </div>

      {/* Right Side - Form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(135deg, #F3F2FB 0%, #EFEDFD 100%)' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-12">
            <div className="flex justify-center">
              <WorkivedLogo size={48} showWordmark={true} variant="dark" />
            </div>
            <p style={{ fontSize: 14, color: '#72708A', marginTop: 8 }}>
              HR & Operations Superapp
            </p>
          </div>

          {/* Form Card */}
          <div
            className="p-10 rounded-3xl"
            style={{
              background: '#FFFFFF',
              boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
            }}
          >
            <div className="mb-8">
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: '#0F0E13',
                }}
              >
                Create your account
              </h2>
              <p style={{ fontSize: 15, color: '#72708A', marginTop: 6 }}>
                Get started with Workived — free for teams up to 25
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => register.mutate(data))}
              className="space-y-5"
            >
              {apiError && (
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ background: '#FDECEC', border: '1px solid #D44040' }}
                >
                  <p style={{ fontSize: 14, color: '#AE2E2E', fontWeight: 500 }}>
                    {apiError}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="full_name"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1D2B', marginBottom: 8 }}
                >
                  Full name
                </label>
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ahmad Rizky"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: '#F3F2FB', border: '1.5px solid #EDECF4', color: '#0F0E13' }}
                  {...form.register('full_name')}
                />
                {form.formState.errors.full_name && (
                  <p style={{ fontSize: 13, color: '#D44040', marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1D2B', marginBottom: 8 }}
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: '#F3F2FB', border: '1.5px solid #EDECF4', color: '#0F0E13' }}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p style={{ fontSize: 13, color: '#D44040', marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1F1D2B', marginBottom: 8 }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: '#F3F2FB', border: '1.5px solid #EDECF4', color: '#0F0E13' }}
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p style={{ fontSize: 13, color: '#D44040', marginTop: 6, fontWeight: 500 }}>
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={register.isPending}
                className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #9B8FF7 0%, #6357E8 100%)',
                  color: '#FFFFFF',
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                }}
              >
                {register.isPending ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="text-center mt-6" style={{ fontSize: 14, color: '#72708A' }}>
              Already have an account?{' '}
              <Link
                to="/login"
                style={{ color: '#6357E8', fontWeight: 600 }}
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
