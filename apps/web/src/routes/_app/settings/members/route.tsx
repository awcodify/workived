import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseJwtOrgId } from '@/lib/utils/jwt'
import { useAuthStore } from '@/lib/stores/auth'
import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useInvitations, useInviteMember, useRevokeInvitation, useMembers, useUpdateMemberRole } from '@/lib/hooks/useInvitations'
import { useCanInvite } from '@/lib/hooks/useRole'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'

const C = {
  err: colors.err,
  errDim: colors.errDim,
  errText: colors.errText,
  ok: colors.ok,
  okDim: colors.okDim,
  okText: colors.okText,
  accent: colors.accent,
  accentDim: colors.accentDim,
}
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import type { ApiError, MemberRole, MemberWithProfile, PendingInvitation, InviteResponse } from '@/types/api'
import { AxiosError } from 'axios'

export const Route = createFileRoute('/_app/settings/members')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!parseJwtOrgId(accessToken)) {
      throw redirect({ to: '/setup-org' })
    }
  },
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

// ── Shared style constants (matches company page) ──────────────────────────────

const S = {
  text:       '#FFFFFF',
  textMuted:  'rgba(255,255,255,0.55)',
  textDim:    'rgba(255,255,255,0.35)',
  divider:    'rgba(255,255,255,0.08)',
  inputBg:    'rgba(255,255,255,0.07)',
  inputBorder:'rgba(255,255,255,0.12)',
}

// ── Sidebar navigation ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'invite', label: 'Invite' },
  { id: 'team', label: 'Team members' },
  { id: 'pending', label: 'Pending invitations' },
]

function SideNav() {
  return (
    <nav className="hidden md:flex flex-col gap-1 w-[180px] shrink-0 sticky top-8 self-start">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
          style={{ color: S.textMuted, fontWeight: 500 }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

// ── Shared components ──────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: S.divider }} />
}

function SectionTitle({ id, children, description }: { id?: string; children: React.ReactNode; description?: string }) {
  return (
    <div id={id} className="scroll-mt-8">
      <h2 style={{ fontSize: 16, fontWeight: 700, color: S.text, letterSpacing: '-0.02em' }}>{children}</h2>
      {description && (
        <p style={{ fontSize: 14, color: S.textMuted, marginTop: 4, lineHeight: 1.5 }}>{description}</p>
      )}
    </div>
  )
}

function Banner({ variant, message, children }: { variant: 'success' | 'error' | 'warning' | 'info'; message?: string; children?: React.ReactNode }) {
  const styles = {
    success: { bg: 'rgba(18,160,92,0.1)', border: 'rgba(18,160,92,0.3)', color: '#34D399' },
    error:   { bg: 'rgba(212,64,64,0.1)', border: 'rgba(212,64,64,0.3)', color: '#F87171' },
    warning: { bg: 'rgba(201,123,42,0.1)', border: 'rgba(201,123,42,0.3)', color: '#FBBF24' },
    info:    { bg: 'rgba(99,87,232,0.1)', border: 'rgba(99,87,232,0.3)', color: '#A5B4FC' },
  }
  const s = styles[variant]
  return (
    <div role="alert" aria-live="polite" className="px-4 py-3 rounded-lg text-sm"
      style={{ background: s.bg, borderLeft: `3px solid ${s.border}`, color: s.color }}>
      {message ?? children}
    </div>
  )
}

// ── Invite section ─────────────────────────────────────────────────────────────

function InviteSection({ isFreePlan }: { isFreePlan: boolean }) {
  const inviteMember = useInviteMember()
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

  if (!canInvite) return null

  return (
    <section className="flex flex-col gap-5">
      <SectionTitle id="invite" description="They'll receive an email to create their account and join the workspace.">
        Invite a new member
      </SectionTitle>

      {apiError && <Banner variant="error" message={apiError} />}

      <form onSubmit={form.handleSubmit(handleInvite)} className="flex flex-col gap-3" data-testid="members-invite-form">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-start">
          <div>
            <input
              type="email"
              placeholder="colleague@company.com"
              data-testid="members-invite-email-input"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p style={{ fontSize: 13, color: C.err, marginTop: 4, fontWeight: 500 }}>
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <select
            data-testid="members-invite-role-select"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
            {...form.register('role')}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value} disabled={r.isPro && isFreePlan}>
                {r.label}{r.isPro && isFreePlan ? ' (Pro)' : ''}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={inviteMember.isPending}
            data-testid="members-invite-submit-btn"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 whitespace-nowrap"
            style={{ background: C.accent, color: '#FFFFFF' }}
          >
            {inviteMember.isPending ? 'Sending...' : 'Send invite'}
          </button>
        </div>
      </form>

      {lastInvite && (
        <Banner variant="success">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Invitation sent to {lastInvite.email}</span>
            <button
              onClick={() => handleCopyLink(lastInvite.invite_url, lastInvite.id)}
              className="px-3 py-1 rounded text-xs font-bold shrink-0 transition-all hover:opacity-80"
              style={{ background: 'rgba(18,160,92,0.25)', color: '#34D399' }}
            >
              {copiedId === lastInvite.id ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </Banner>
      )}

      <Banner variant="info">
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Workspace Member</strong>
            <span style={{ fontSize: 13, opacity: 0.9 }}>Can log in and access Workived.</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Employee</strong>
            <span style={{ fontSize: 13, opacity: 0.9 }}>Has an HR profile for attendance, leave, and claims.</span>
          </div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            One person can be both. <a href="/people" style={{ textDecoration: 'underline', fontWeight: 600 }}>Add employees in People</a> after inviting.
          </div>
        </div>
      </Banner>
    </section>
  )
}

// ── Team members section ───────────────────────────────────────────────────────

function TeamMembersSection({
  members,
  isLoading,
  isFreePlan = false,
}: {
  members: MemberWithProfile[]
  isLoading: boolean
  isFreePlan?: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'missing_hr'>('all')
  const missingCount = members.filter((m) => !m.has_hr_profile).length
  const filtered = filter === 'missing_hr' ? members.filter((m) => !m.has_hr_profile) : members

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle id="team" description={`${members.length} member${members.length !== 1 ? 's' : ''} in this workspace`}>
          Team members
        </SectionTitle>

        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setFilter('all')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
            style={
              filter === 'all'
                ? { background: 'rgba(255,255,255,0.12)', color: S.text }
                : { color: S.textDim }
            }
          >
            All
          </button>
          <button
            onClick={() => setFilter('missing_hr')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
            style={
              filter === 'missing_hr'
                ? { background: 'rgba(255,255,255,0.12)', color: S.text }
                : { color: S.textDim }
            }
          >
            Missing HR
            {missingCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-xs font-bold"
                style={{ background: 'rgba(212,64,64,0.25)', color: '#F87171', fontSize: 10 }}
              >
                {missingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: S.textDim }}>
          {filter === 'missing_hr' ? 'All members have an HR profile.' : 'No members yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-4 py-2">
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>HR Profile</span>
          </div>
          <div style={{ height: 1, background: S.divider }} />
          {filtered.map((m) => (
            <MemberRow key={m.id} member={m} isFreePlan={isFreePlan} />
          ))}
        </div>
      )}
    </section>
  )
}

function MemberRow({ member, isFreePlan = false }: { member: MemberWithProfile; isFreePlan?: boolean }) {
  const currentUser = useAuthStore((s) => s.user)
  const updateMemberRole = useUpdateMemberRole()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isOwnProfile = currentUser?.id === member.user_id
  const canChangeRole = !isOwnProfile && member.role !== 'owner'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false)
      }
    }
    if (showRoleDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showRoleDropdown])

  const handleRoleChange = (newRole: MemberRole) => {
    if (newRole === member.role) {
      setShowRoleDropdown(false)
      return
    }
    updateMemberRole.mutate(
      { memberId: member.id, data: { role: newRole } },
      { onSuccess: () => setShowRoleDropdown(false) },
    )
  }

  const hrStatus = !member.has_hr_profile
    ? null
    : member.hr_profile_active
      ? 'active'
      : 'archived'

  return (
    <div
      className="grid grid-cols-[1fr_100px_120px] gap-4 items-center px-4 py-3 rounded-lg transition-colors hover:bg-white/[0.03]"
      data-testid={`members-row-${member.id}`}
    >
      {/* Name + email */}
      <div className="min-w-0">
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text }} className="truncate">
          {member.full_name}
          {isOwnProfile && <span style={{ color: S.textDim, marginLeft: 6, fontWeight: 400 }}>(You)</span>}
        </p>
        <p style={{ fontSize: 12, color: S.textDim }} className="truncate">{member.email}</p>
      </div>

      {/* Role */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => canChangeRole && setShowRoleDropdown(!showRoleDropdown)}
          disabled={!canChangeRole || updateMemberRole.isPending}
          className={`text-xs font-medium px-2 py-0.5 rounded ${canChangeRole ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          style={{ background: 'rgba(155,143,247,0.15)', color: '#9B8FF7' }}
        >
          {member.role}
          {canChangeRole && <span style={{ marginLeft: 4 }}>▾</span>}
        </button>

        {showRoleDropdown && (
          <div
            className="absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg z-10 min-w-[180px]"
            style={{ background: 'rgba(30,30,35,0.98)', border: `1px solid ${S.inputBorder}` }}
          >
            {ROLES.filter((r) => r.value !== 'owner').map((role) => {
              const isDisabled = role.isPro && isFreePlan
              const isCurrent = role.value === member.role
              return (
                <button
                  key={role.value}
                  onClick={() => !isDisabled && handleRoleChange(role.value)}
                  disabled={isDisabled}
                  className={`w-full px-4 py-2 text-left text-xs transition-colors ${
                    isDisabled ? 'cursor-not-allowed opacity-40' : isCurrent ? 'cursor-default' : 'hover:bg-white/5'
                  }`}
                  style={{ color: isCurrent ? '#9B8FF7' : 'rgba(255,255,255,0.85)', fontWeight: isCurrent ? 600 : 500 }}
                >
                  <div>{role.label}{role.isPro && isFreePlan ? ' (Pro)' : ''}</div>
                  <div style={{ fontSize: 10, color: S.textDim, marginTop: 2 }}>{role.description}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* HR status */}
      <div className="flex justify-end">
        {hrStatus === 'active' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.ok }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.ok, display: 'inline-block' }} />
            Linked
          </span>
        )}
        {hrStatus === 'archived' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: S.textDim }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
            Archived
          </span>
        )}
        {hrStatus === null && (
          <a
            href={`/people/new?user_id=${member.user_id}`}
            className="text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'rgba(155,143,247,0.8)' }}
          >
            Add →
          </a>
        )}
      </div>
    </div>
  )
}

// ── Pending invitations section ────────────────────────────────────────────────

function PendingInvitationsSection() {
  const { data: invitations, isLoading, refetch } = useInvitations()
  const revokeInvitation = useRevokeInvitation()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <SectionTitle id="pending">Pending invitations</SectionTitle>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
          style={{ color: S.textMuted }}
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : !invitations?.length ? (
        <p style={{ fontSize: 14, color: S.textDim }}>No pending invitations.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_auto] gap-4 px-4 py-2">
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</span>
          </div>
          <div style={{ height: 1, background: S.divider }} />
          {invitations.map((inv: PendingInvitation) => (
            <InvitationRow
              key={inv.id}
              invitation={inv}
              copiedId={copiedId}
              onCopyLink={handleCopyLink}
              onRevoke={(id) => revokeInvitation.mutate(id)}
              revoking={revokeInvitation.isPending}
            />
          ))}
        </div>
      )}
    </section>
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
    <div className="grid grid-cols-[1fr_80px_auto] gap-4 items-center px-4 py-3 rounded-lg transition-colors hover:bg-white/[0.03]" data-testid={`members-invitation-row-${invitation.id}`}>
      {/* Email + expiry */}
      <div className="min-w-0">
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text }} className="truncate">{invitation.email}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {isExpired ? (
            <span style={{ fontSize: 12, color: C.err, fontWeight: 500 }}>Expired</span>
          ) : (
            <span style={{ fontSize: 12, color: S.textDim }}>
              Expires {new Date(invitation.expires_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Role */}
      <span
        className="text-xs font-medium px-2 py-0.5 rounded w-fit"
        style={{ background: 'rgba(155,143,247,0.15)', color: '#9B8FF7' }}
      >
        {invitation.role}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        {!isExpired && (
          <button
            onClick={() => onCopyLink(invitation.invite_url, invitation.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
            style={{ color: S.textMuted }}
          >
            {copiedId === invitation.id ? 'Copied!' : 'Copy link'}
          </button>
        )}
        <button
          onClick={() => onRevoke(invitation.id)}
          disabled={revoking}
          data-testid={`members-revoke-btn-${invitation.id}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:bg-white/5"
          style={{ color: C.err }}
        >
          Revoke
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

function MembersPage() {
  const { data: org } = useOrganisation()
  const { data: members = [], isLoading: loadingMembers } = useMembers()

  const isFreePlan = org?.plan === 'free'

  return (
    <div className="min-h-screen flex flex-col" data-testid="members-page" style={{ background: moduleBackgrounds.settings }}>
      {/* Header */}
      <div className="px-11 pt-10 pb-2">
        <WorkivedLogo size={32} showWordmark variant="light" />
      </div>

      <main className="flex-1 px-11 py-7 pb-32">
        {/* Title */}
        <div className="mb-8">
          <h1
            style={{
              fontSize: typography.h1.size,
              fontWeight: typography.h1.weight,
              letterSpacing: typography.h1.tracking,
              color: colors.ink0,
            }}
          >
            Workspace Members
          </h1>
          <p style={{ fontSize: 14, color: S.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            Manage who can access {org?.name ?? 'your workspace'}.
          </p>
        </div>

        {/* Two-column layout: sidebar + content */}
        <div className="flex gap-12">
          <SideNav />

          <div className="flex-1 flex flex-col gap-8">
            <InviteSection isFreePlan={isFreePlan} />
            <Divider />
            <TeamMembersSection members={members} isLoading={loadingMembers} isFreePlan={isFreePlan} />
            <Divider />
            <PendingInvitationsSection />
          </div>
        </div>
      </main>
    </div>
  )
}
