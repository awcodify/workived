import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { colors } from '@/design/tokens'

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const verifyMutation = useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token).then((r) => r.data),
    onSuccess: () => {
      setStatus('success')
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate({ to: '/login', search: { redirect: undefined } })
      }, 2000)
    },
    onError: (error: any) => {
      setStatus('error')
      setErrorMessage(
        error.response?.data?.error?.message || 'Verification failed. The link may have expired.'
      )
    },
  })

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('No verification token provided.')
      return
    }

    verifyMutation.mutate(token)
  }, [token])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, ${colors.ink50} 0%, ${colors.accentDim} 100%)` }}
      data-testid="verify-email-page"
    >
      <div
        className="w-full max-w-md p-10 rounded-3xl text-center"
        style={{
          background: colors.ink0,
          boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
        }}
      >
        {status === 'verifying' && (
          <div data-testid="verify-email-verifying">
            <div
              className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: colors.accentDim }}
            >
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: colors.accent }} />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: colors.ink900 }}>
              Verifying Your Email
            </h1>
            <p className="text-base" style={{ color: colors.ink500 }}>
              Please wait while we verify your email address...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div data-testid="verify-email-success">
            <div
              className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: colors.okDim }}
            >
              <CheckCircle2 className="w-10 h-10" style={{ color: colors.ok }} />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: colors.ink900 }}>
              Email Verified!
            </h1>
            <p className="text-base" style={{ color: colors.ink500 }}>
              Your email has been successfully verified. Redirecting you to login...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div data-testid="verify-email-error">
            <div
              className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: colors.errDim }}
            >
              <XCircle className="w-10 h-10" style={{ color: colors.err }} />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: colors.ink900 }}>
              Verification Failed
            </h1>
            <p className="text-base mb-6" style={{ color: colors.ink500 }} data-testid="verify-email-error-message">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate({ to: '/login', search: { redirect: undefined } })}
              className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
              style={{
                background: colors.accent,
                color: colors.ink0,
              }}
              data-testid="verify-email-go-to-login-btn"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
