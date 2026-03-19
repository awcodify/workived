import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useInvitations, useInviteMember, useRevokeInvitation } from '@/lib/hooks/useInvitations'
import { useCanInvite } from '@/lib/hooks/useRole'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'

// Shorthand for token colors used in this page
const C = {
  err: colors.err,
  errDim: colors.errDim,
  ok: colors.ok,
  okDim: colors.okDim,
  accent: colors.accent,
  accentDim: colors.accentDim,
}
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import type { ApiError, MemberRole, PendingInvitation, InviteResponse } from '@/types/api'
import { AxiosError } from 'axios'

export const Route = createFileRoute('/_app/settings/members')({
  component: MembersPage,
})

const ROLES: { value: MemberRole; label: string; description: string; isPro: boolean }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features', isPro: false },
  { value: 'member', label: 'Member', description: 'Basic access', isPro: false },
  { value: 'hr_admin', label: 'HR Admin', description: 'Manage employees & attendance', isPro: true },
  { value: 'manager', label: 'Manager', description: 'View team data', isPro: true },
  { value: 'finance', label: 'Finance', description: 'View reports & claims', isPro: true },
]

const inviteSchema = z.object({
  email: z.email('Invalid email address'),
  role: z.enum(['admin', 'member', 'hr_admin', 'manager', 'finance'] as const),
})

type InviteForm = z.infer<typeof inviteSchema>

function MembersPage() {
  const { data: org } = useOrganisation()
  const { data: invitations, isLoading: loadingInvitations, refetch: refetchInvitations } = useInvitations()
  const inviteMember = useInviteMember()
  const revokeInvitation = useRevokeInvitation()
  const canInvite = useCanInvite()
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  })

  const apiError =
    inviteMember.error instanceof AxiosError
      ? (inviteMember.error.response?.data as ApiError | undefined)?.error?.message
      : undefined

  const handleInvite = (data: InviteForm) => {
    inviteMember.mutate(data, {
      onSuccess: (result) => {
        setLastInvite(result)
        form.reset()
      },
    })
  }

  const handleCopyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = (id: string) => {
    revokeInvitation.mutate(id)
  }

  const isFreePlan = org?.plan === 'free'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: moduleBackgrounds.overview }}>
      {/* Header */}
      <div className="px-11 pt-10 pb-2">
        <WorkivedLogo size={32} showWordmark variant="light" />
      </div>

      <main className="flex-1 px-11 py-7 flex flex-col gap-7">
        {/* Title */}
        <div>
          <h1
            style={{
              fontSize: typography.h1.size,
              fontWeight: typography.h1.weight,
              letterSpacing: typography.h1.tracking,
              color: '#FFFFFF',
            }}
          >
            Workspace Members
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.5 }}>
            Invite people to access {org?.name ?? 'your workspace'}. Need attendance and leave tracking? Add them in <a href="/people" style={{ color: 'rgba(155,143,247,0.9)', textDecoration: 'underline' }}>People</a> after inviting.
          </p>
        </div>

        {/* Info box explaining the difference */}
        <div
          className="p-5 rounded-xl"
          style={{ background: 'rgba(155,143,247,0.08)', border: '1px solid rgba(155,143,247,0.15)' }}
        >
          <div className="flex gap-3">
            <div style={{ fontSize: 20, marginTop: 2 }}>💡</div>
            <div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: 6 }}>
                What's the difference?
              </p>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Workspace Member:</strong> Someone who can log in to Workived. 
                  They get access based on their role (Admin, Member, etc.).
                </p>
                <p>
                  <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Employee:</strong> Someone with an HR profile for attendance, 
                  leave, claims, and payroll tracking. One person can be both.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Form Card */}
        {canInvite && (
        <div
          className="p-8 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 4,
            }}
          >
            Invite a new member
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
            They'll receive an email invitation to create their account and access the workspace.
          </p>

          <form onSubmit={form.handleSubmit(handleInvite)} className="flex flex-col gap-4">
            {apiError && (
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: C.errDim, border: `1px solid ${C.err}` }}
              >
                <p style={{ fontSize: 14, color: '#AE2E2E', fontWeight: 500 }}>{apiError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                  }}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="sm:w-48">
                <select
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                  }}
                  {...form.register('role')}
                >
                  {ROLES.map((r) => (
                    <option
                      key={r.value}
                      value={r.value}
                      disabled={r.isPro && isFreePlan}
                    >
                      {r.label}{r.isPro && isFreePlan ? ' (Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={inviteMember.isPending}
                className="px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  background: C.accent,
                  color: '#FFFFFF',
                }}
              >
                {inviteMember.isPending ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </form>

          {/* Last invite success banner */}
          {lastInvite && (
            <div
              className="mt-4 px-4 py-3.5 rounded-xl"
              style={{ background: C.okDim, border: `1px solid ${C.ok}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p style={{ fontSize: 14, color: '#0A7B46', fontWeight: 600, marginBottom: 4 }}>
                    ✓ Invitation sent to {lastInvite.email}
                  </p>
                  <p style={{ fontSize: 12, color: '#0D7A45', lineHeight: 1.5 }}>
                    They can now log in to the workspace. Need HR tracking? 
                    Add them as an <a href="/people/new" style={{ textDecoration: 'underline', fontWeight: 600 }}>employee</a> for 
                    attendance, leave, and payroll records.
                  </p>
                </div>
                <button
                  onClick={() => handleCopyLink(lastInvite.invite_url, lastInvite.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
                  style={{ background: C.ok, color: '#FFFFFF' }}
                >
                  {copiedId === lastInvite.id ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Pending Invitations */}
        <div
          className="p-8 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              Pending invitations
            </h2>
            <button
              onClick={() => refetchInvitations()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/10"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {loadingInvitations ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
              ))}
            </div>
          ) : !invitations?.length ? (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              No pending invitations. Invite someone above to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {invitations.map((inv: PendingInvitation) => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  copiedId={copiedId}
                  onCopyLink={handleCopyLink}
                  onRevoke={handleRevoke}
                  revoking={revokeInvitation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function InvitationRow({
  invitation,
  copiedId,
  onCopyLink,
  onRevoke,
  revoking,
}: {
  invitation: PendingInvitation
  copiedId: string | null
  onCopyLink: (url: string, id: string) => void
  onRevoke: (id: string) => void
  revoking: boolean
}) {
  const isExpired = new Date(invitation.expires_at) < new Date()

  return (
    <div
      className="px-5 py-4 rounded-xl flex items-center justify-between gap-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}
        >
          {invitation.email}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: 'rgba(155,143,247,0.15)',
              color: '#9B8FF7',
            }}
          >
            {invitation.role}
          </span>
          {isExpired && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded"
              style={{
                background: 'rgba(212,64,64,0.15)',
                color: '#D44040',
              }}
            >
              Expired
            </span>
          )}
          {!isExpired && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Expires {new Date(invitation.expires_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isExpired && (
          <button
            onClick={() => onCopyLink(invitation.invite_url, invitation.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {copiedId === invitation.id ? 'Copied!' : 'Copy link'}
          </button>
        )}
        <button
          onClick={() => onRevoke(invitation.id)}
          disabled={revoking}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          style={{
            background: 'rgba(212,64,64,0.1)',
            color: '#D44040',
            border: '1px solid rgba(212,64,64,0.2)',
          }}
        >
          Revoke
        </button>
      </div>
    </div>
  )
}
