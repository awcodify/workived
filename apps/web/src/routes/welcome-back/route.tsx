import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { colors } from '@/design/tokens'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/welcome-back')({
  component: WelcomeBackPage,
})

function WelcomeBackIllustration() {
  return (
    <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background shape */}
      <rect x="20" y="20" width="240" height="160" rx="16" fill={colors.accent} opacity="0.04" />

      {/* Large checkmark circle */}
      <circle cx="140" cy="80" r="48" fill={colors.accent} opacity="0.1" />
      <circle cx="140" cy="80" r="36" fill={colors.accent} />
      {/* Checkmark */}
      <path d="M122 80 L134 92 L158 68" stroke={colors.ink0} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Person silhouette on the left */}
      <g transform="translate(60, 60)">
        <circle cx="0" cy="0" r="10" fill={colors.ink300} />
        <path d="M-14 35 Q-14 18 0 14 Q14 18 14 35" fill={colors.ink300} />
      </g>

      {/* Arrow from person to checkmark */}
      <path d="M78 78 L100 78" stroke={colors.ink300} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />

      {/* Small W badge */}
      <rect x="190" y="58" width="28" height="28" rx="8" fill={colors.accent} opacity="0.15" />
      <path d="M197 68 L200 78 L204 71 L208 78 L211 68" stroke={colors.accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Decorative dots */}
      <circle cx="45" cy="40" r="3" fill={colors.accent} opacity="0.15" />
      <circle cx="235" cy="45" r="2.5" fill={colors.accent} opacity="0.12" />
      <circle cx="30" cy="140" r="2" fill={colors.accent} opacity="0.1" />
      <circle cx="250" cy="130" r="3" fill={colors.accent} opacity="0.08" />

      {/* Bottom accent line */}
      <line x1="90" y1="150" x2="190" y2="150" stroke={colors.accent} strokeWidth="2" opacity="0.15" strokeLinecap="round" />
    </svg>
  )
}

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
        <div className="mb-6 flex justify-center">
          <WelcomeBackIllustration />
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
