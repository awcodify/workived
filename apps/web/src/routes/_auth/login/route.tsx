import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/stores/auth'
import type { ApiError } from '@/types/api'
import { AxiosError } from 'axios'

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const login = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data).then((r) => r.data.data),
    onSuccess: (data) => {
      setAuth(data)
      navigate({ to: '/overview' })
    },
  })

  const apiError =
    login.error instanceof AxiosError
      ? (login.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tighter text-ink-900">
          Workived
        </h1>
        <p className="text-sm text-ink-500 mt-1">Sign in to your account</p>
      </div>

      <form
        onSubmit={form.handleSubmit((data) => login.mutate(data))}
        className="space-y-4"
      >
        {apiError && (
          <div className="bg-err-dim text-err-text text-sm px-3 py-2 rounded-lg">
            {apiError}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full px-3 py-2 border border-ink-150 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-err mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-ink-150 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-err mt-1">{form.formState.errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full bg-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-accent-text transition-colors disabled:opacity-50"
        >
          {login.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
