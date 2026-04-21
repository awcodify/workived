import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { getSetupStatus } from '@/lib/api/setup'
import { useAuthStore } from '@/lib/stores/auth'
import { isAxiosError } from 'axios'
import { colors } from '@/design/tokens'

export const Route = createFileRoute('/_auth/verify-email-required')({
  component: VerifyEmailRequiredPage,
})

function VerifyEmailRequiredPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendVerificationEmail().then((r) => r.data),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Verification email sent! Check your inbox.' })
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Failed to send verification email. Please try again.' })
    },
  })

  const checkStatusMutation = useMutation({
    mutationFn: () => authApi.checkVerificationStatus().then((r) => r.data.data),
    onSuccess: async (data) => {
      if (data.is_verified) {
        setMessage({ type: 'success', text: 'Email verified! Redirecting...' })
        
        // Check if user already has an organization
        setTimeout(async () => {
          try {
            const setupStatus = await getSetupStatus()
            // User has org - redirect to app
            navigate({ to: '/overview' })
          } catch (err) {
            if (isAxiosError(err) && err.response?.status === 403) {
              // User has no org - redirect to setup-org
              navigate({ to: '/setup-org' })
            } else {
              // Other error - stay on page
              setMessage({ type: 'error', text: 'Failed to check organization status.' })
            }
          }
        }, 1500)
      } else {
        setMessage({ type: 'error', text: 'Email not verified yet. Please check your inbox.' })
      }
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Failed to check verification status. Please try again.' })
    },
  })

  return (
    <div className="flex-1 flex items-center justify-center px-4" style={{ background: colors.ink0 }} data-testid="verify-email-required-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: colors.accentDim }}
          >
            <Mail className="w-10 h-10" style={{ color: colors.accent }} />
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: colors.ink900 }}>
            Verify Your Email
          </h1>
          <p className="text-base leading-relaxed" style={{ color: colors.ink500 }}>
            We sent a verification email to <strong style={{ color: colors.ink900 }} data-testid="verify-email-user-email">{user?.email}</strong>. Please
            click the link in the email to verify your account before creating an organization.
          </p>
        </div>

        {message && (
          <div
            className="mb-6 p-4 rounded-lg text-sm"
            style={{
              background: message.type === 'success' ? colors.okDim : colors.errDim,
              color: message.type === 'success' ? colors.ok : colors.err,
              border: `1px solid ${message.type === 'success' ? colors.ok : colors.err}`,
            }}
            data-testid="verify-email-message"
          >
            {message.text}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => checkStatusMutation.mutate()}
            disabled={checkStatusMutation.isPending}
            className="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{
              background: colors.accent,
              color: colors.ink0,
            }}
            data-testid="verify-email-check-status-btn"
          >
            {checkStatusMutation.isPending ? 'Checking...' : "I've Verified My Email"}
          </button>

          <button
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'transparent',
              color: colors.ink700,
              border: `1px solid ${colors.ink150}`,
            }}
            data-testid="verify-email-resend-btn"
          >
            {resendMutation.isPending ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: colors.ink500 }}>
          Didn't receive the email? Check your spam folder or{' '}
          <button
            onClick={() => resendMutation.mutate()}
            className="font-medium underline"
            style={{ color: colors.accent }}
            data-testid="verify-email-resend-link"
          >
            request a new one
          </button>
          .
        </p>
      </div>
    </div>
  )
}
