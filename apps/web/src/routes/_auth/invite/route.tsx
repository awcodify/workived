import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { z } from 'zod/v4'
import { useMutation } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, moduleBackgrounds } from '@/design/tokens'
import { extractApiError } from '@/lib/utils/errors'

const inviteSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/_auth/invite')({
  validateSearch: inviteSearchSchema,
  component: InviteAcceptPage,
})

function InviteAcceptPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)()
  const setAuth = useAuthStore((s) => s.setAuth)

  const acceptInvite = useMutation({
    mutationFn: (inviteToken: string) =>
      organisationsApi.acceptInvitation({ token: inviteToken }).then((r) => r.data.data),
    onSuccess: (data) => {
      setAuth({ access_token: data.access_token, user: useAuthStore.getState().user! })
      navigate({ to: '/overview' })
    },
  })

  const apiError = extractApiError(acceptInvite.error)

  const handleAccept = () => {
    if (token) {
      acceptInvite.mutate(token)
    }
  }

  return (
    <div className="flex-1 flex">
      {/* Left Side - Branding */}
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
            Join your
            <br />
            <span style={{ color: '#9B8FF7' }}>team.</span>
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
            You've been invited to join a workspace on Workived. Accept the invitation to get
            started.
          </p>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Workived. Built for modern founders.
        </p>
      </div>

      {/* Right Side - Content */}
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

          {/* Card */}
          <div
            className="p-10 rounded-3xl"
            style={{
              background: colors.ink0,
              boxShadow: '0 20px 60px rgba(99,87,232,0.12), 0 0 0 1px rgba(99,87,232,0.08)',
            }}
          >
            {!token ? (
              // No token — invalid link
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                  style={{ background: colors.errDim }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.err}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.ink900,
                  }}
                >
                  Invalid invite link
                </h2>
                <p style={{ fontSize: 15, color: colors.ink500, marginTop: 8, lineHeight: 1.6 }}>
                  This invitation link appears to be invalid or incomplete. Please ask your team
                  admin to send a new invitation.
                </p>
                <Link
                  to="/login"
                  search={{ redirect: undefined }}
                  className="inline-block mt-8 font-bold py-3 px-8 rounded-xl transition-all"
                  style={{
                    background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                    color: colors.ink0,
                    fontSize: 15,
                    boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                  }}
                >
                  Go to login
                </Link>
              </div>
            ) : !isAuthenticated ? (
              // Has token but not logged in — need to register or log in first
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                  style={{ background: colors.accentDim }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.ink900,
                  }}
                >
                  You're invited!
                </h2>
                <p style={{ fontSize: 15, color: colors.ink500, marginTop: 8, lineHeight: 1.6 }}>
                  Sign in or create an account to accept this invitation and join your team.
                </p>
                <div className="flex flex-col gap-3 mt-8">
                  <Link
                    to="/login"
                    search={{ redirect: `/invite?token=${token}` }}
                    className="w-full font-bold py-4 rounded-xl transition-all text-center"
                    style={{
                      background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                      color: colors.ink0,
                      fontSize: 15,
                      boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                    }}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    search={{ invite_token: token }}
                    className="w-full font-bold py-4 rounded-xl transition-all text-center"
                    style={{
                      background: colors.ink50,
                      color: colors.accent,
                      fontSize: 15,
                      border: `1.5px solid ${colors.ink100}`,
                    }}
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              // Authenticated — show accept button
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                  style={{ background: colors.okDim }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.ok}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <polyline points="16 11 18 13 22 9" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: colors.ink900,
                  }}
                >
                  Accept invitation
                </h2>
                <p style={{ fontSize: 15, color: colors.ink500, marginTop: 8, lineHeight: 1.6 }}>
                  You've been invited to join a workspace. Click below to accept and get started.
                </p>

                {apiError && (
                  <div
                    className="px-4 py-3 rounded-xl mt-6 text-left"
                    style={{ background: colors.errDim, border: `1px solid ${colors.err}` }}
                  >
                    <p style={{ fontSize: 14, color: colors.errText, fontWeight: 500 }}>{apiError}</p>
                  </div>
                )}

                <button
                  onClick={handleAccept}
                  disabled={acceptInvite.isPending}
                  className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 mt-8"
                  style={{
                    background: `linear-gradient(135deg, #9B8FF7 0%, ${colors.accent} 100%)`,
                    color: colors.ink0,
                    fontSize: 15,
                    letterSpacing: '-0.01em',
                    boxShadow: '0 4px 16px rgba(99,87,232,0.3)',
                  }}
                >
                  {acceptInvite.isPending ? 'Joining workspace...' : 'Join workspace'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
