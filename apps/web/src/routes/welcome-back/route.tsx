import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { colors } from '@/design/tokens'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/welcome-back')({
  component: WelcomeBackPage,
})

function WelcomeBackPage() {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate({ to: '/overview' })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [navigate])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: colors.ink0 }}
    >
      <div className="max-w-md w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: colors.accent }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <polyline points="16 11 18 13 22 9" />
          </svg>
        </div>

        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: colors.ink900 }}
        >
          Welcome back!
        </h1>

        <p
          className="text-base mb-2"
          style={{ color: colors.ink500 }}
        >
          You already have an account with this email.
        </p>

        <p
          className="text-sm mb-8"
          style={{ color: colors.ink300 }}
        >
          Redirecting to your workspace in {countdown}...
        </p>

        <button
          onClick={() => navigate({ to: '/overview' })}
          className="w-full h-12 rounded-xl font-medium transition-all"
          style={{
            background: colors.accent,
            color: colors.ink0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Go to Workspace
        </button>
      </div>
    </div>
  )
}
