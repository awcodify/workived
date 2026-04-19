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
import { colors, typography, radius } from '@/design/tokens'

const C = {
  err: colors.err,
  errDim: colors.errDim,
  errText: colors.errText,
  ok: colors.ok,
  okDim: colors.okDim,
  okText: colors.okText,
  warn: colors.warn,
  accent: colors.accent,
  accentDim: colors.accentDim,
}
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

// ── Page palette (matches company settings / landing dark-bg) ──────────────────

const pageBg    = '#0A0A12'
const surfaceBg = 'rgba(255,255,255,0.035)'
const cardBg    = 'rgba(255,255,255,0.055)'
const text      = '#FFFFFF'
const textSec   = 'rgba(255,255,255,0.50)'
const textDim   = 'rgba(255,255,255,0.28)'
const border    = 'rgba(255,255,255,0.06)'
const inputBg   = 'rgba(255,255,255,0.05)'
const inputBdr  = 'rgba(255,255,255,0.10)'

// ── Shared components ──────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: border }} />
}

function SectionTitle({ id, children, description }: { id?: string; children: React.ReactNode; description?: string }) {
  return (
    <div id={id} className="scroll-mt-8">
      <h2 style={{ fontSize: typography.h3.size, fontWeight: typography.h3.weight, color: text, letterSpacing: typography.h3.tracking }}>{children}</h2>
      {description && (
        <p style={{ fontSize: typography.body.size, color: textSec, marginTop: 6, lineHeight: 1.5 }}>{description}</p>
      )}
    </div>
  )
}

function Banner({ variant, message, children }: { variant: 'success' | 'error' | 'warning' | 'info'; message?: string; children?: React.ReactNode }) {
  const styles = {
    success: { bg: 'rgba(18,160,92,0.12)', bdr: C.ok, fg: '#6EE7B7' },
    error:   { bg: 'rgba(212,64,64,0.12)', bdr: C.err, fg: '#FCA5A5' },
    warning: { bg: 'rgba(201,123,42,0.12)', bdr: C.warn, fg: '#FCD34D' },
    info:    { bg: 'rgba(99,87,232,0.12)', bdr: C.accent, fg: colors.accentMid },
  }
  const s = styles[variant]
  return (
    <div role="alert" aria-live="polite" className="px-4 py-3"
      style={{ background: s.bg, borderLeft: `3px solid ${s.bdr}`, color: s.fg, borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: typography.label.weight, fontFamily: typography.fontFamily }}>
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
              className="w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.lg, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p style={{ fontSize: typography.label.size, color: C.err, marginTop: 6, fontWeight: typography.label.weight }}>
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <select
            data-testid="members-invite-role-select"
            className="w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
            style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.lg, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
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
            className="px-5 py-2.5 transition-all disabled:opacity-50 whitespace-nowrap"
            style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 600, fontFamily: typography.fontFamily }}
          >
            {inviteMember.isPending ? 'Sending...' : 'Send invite'}
          </button>
        </div>
      </form>

      {lastInvite && (
        <Banner variant="success">
          <div className="flex items-center justify-between gap-3">
            <span style={{ fontWeight: 600 }}>Invitation sent to {lastInvite.email}</span>
            <button
              onClick={() => handleCopyLink(lastInvite.invite_url, lastInvite.id)}
              className="px-3 py-1 shrink-0 transition-all hover:opacity-80"
              style={{ background: 'rgba(18,160,92,0.25)', color: '#6EE7B7', borderRadius: radius.md, fontSize: typography.caption.size, fontWeight: 600 }}
            >
              {copiedId === lastInvite.id ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </Banner>
      )}

      <Banner variant="info">
        <div style={{ lineHeight: 1.7 }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Workspace Member</strong>
            <span style={{ fontSize: typography.label.size, opacity: 0.9 }}>Can log in and access Workived.</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Employee</strong>
            <span style={{ fontSize: typography.label.size, opacity: 0.9 }}>Has an HR profile for attendance, leave, and claims.</span>
          </div>
          <div style={{ fontSize: typography.label.size, opacity: 0.9 }}>
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

        <div className="flex items-center gap-1 p-1" style={{ background: inputBg, borderRadius: radius.lg }}>
          <button
            onClick={() => setFilter('all')}
            className="px-3 py-1.5 transition-all"
            style={
              filter === 'all'
                ? { background: cardBg, color: text, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }
                : { color: textDim, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }
            }
          >
            All
          </button>
          <button
            onClick={() => setFilter('missing_hr')}
            className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
            style={
              filter === 'missing_hr'
                ? { background: cardBg, color: text, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }
                : { color: textDim, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }
            }
          >
            Missing HR
            {missingCount > 0 && (
              <span
                className="px-1.5 py-0.5"
                style={{ background: 'rgba(212,64,64,0.25)', color: '#FCA5A5', fontSize: typography.tiny.size, fontWeight: 600, borderRadius: radius.sm }}
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
            <div key={i} className="h-14 animate-pulse" style={{ background: cardBg, borderRadius: radius.lg }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: typography.body.size, color: textDim }}>
          {filter === 'missing_hr' ? 'All members have an HR profile.' : 'No members yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-4 py-2.5">
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking }}>Member</span>
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking }}>Role</span>
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking, textAlign: 'right' }}>HR Profile</span>
          </div>
          <div style={{ height: 1, background: border }} />
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
      className="grid grid-cols-[1fr_100px_120px] gap-4 items-center px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
      style={{ borderRadius: radius.lg }}
      data-testid={`members-row-${member.id}`}
    >
      {/* Name + email */}
      <div className="min-w-0">
        <p style={{ fontSize: typography.body.size, fontWeight: 600, color: text }} className="truncate">
          {member.full_name}
          {isOwnProfile && <span style={{ color: textDim, marginLeft: 6, fontWeight: 400 }}>(You)</span>}
        </p>
        <p style={{ fontSize: typography.label.size, color: textDim }} className="truncate">{member.email}</p>
      </div>

      {/* Role */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => canChangeRole && setShowRoleDropdown(!showRoleDropdown)}
          disabled={!canChangeRole || updateMemberRole.isPending}
          className={`px-2.5 py-1 ${canChangeRole ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          style={{ background: 'rgba(155,143,247,0.15)', color: '#9B8FF7', borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}
        >
          {member.role}
          {canChangeRole && <span style={{ marginLeft: 4 }}>&#9662;</span>}
        </button>

        {showRoleDropdown && (
          <div
            className="absolute top-full left-0 mt-1 py-1 shadow-lg z-10 min-w-[200px]"
            style={{ background: '#12121C', border: `1px solid ${inputBdr}`, borderRadius: radius.lg }}
          >
            {ROLES.filter((r) => r.value !== 'owner').map((role) => {
              const isDisabled = role.isPro && isFreePlan
              const isCurrent = role.value === member.role
              return (
                <button
                  key={role.value}
                  onClick={() => !isDisabled && handleRoleChange(role.value)}
                  disabled={isDisabled}
                  className={`w-full px-4 py-2.5 text-left transition-colors ${
                    isDisabled ? 'cursor-not-allowed opacity-40' : isCurrent ? 'cursor-default' : 'hover:bg-white/5'
                  }`}
                  style={{ color: isCurrent ? '#9B8FF7' : 'rgba(255,255,255,0.85)', fontWeight: isCurrent ? 600 : 500, fontSize: typography.label.size }}
                >
                  <div>{role.label}{role.isPro && isFreePlan ? ' (Pro)' : ''}</div>
                  <div style={{ fontSize: typography.caption.size, color: textDim, marginTop: 3 }}>{role.description}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* HR status */}
      <div className="flex justify-end">
        {hrStatus === 'active' && (
          <span className="flex items-center gap-1.5" style={{ color: colors.ok, fontSize: typography.label.size, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: colors.ok, display: 'inline-block' }} />
            Linked
          </span>
        )}
        {hrStatus === 'archived' && (
          <span className="flex items-center gap-1.5" style={{ color: textDim, fontSize: typography.label.size, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
            Archived
          </span>
        )}
        {hrStatus === null && (
          <a
            href={`/people/new?user_id=${member.user_id}`}
            className="transition-opacity hover:opacity-80"
            style={{ color: 'rgba(155,143,247,0.8)', fontSize: typography.label.size, fontWeight: 600 }}
          >
            Add &rarr;
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
          className="px-3 py-1.5 transition-all hover:bg-white/5"
          style={{ color: textSec, borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: 600 }}
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse" style={{ background: cardBg, borderRadius: radius.lg }} />
          ))}
        </div>
      ) : !invitations?.length ? (
        <p style={{ fontSize: typography.body.size, color: textDim }}>No pending invitations.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_auto] gap-4 px-4 py-2.5">
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking }}>Email</span>
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking }}>Role</span>
            <span style={{ fontSize: typography.caption.size, fontWeight: typography.tiny.weight, color: textDim, textTransform: 'uppercase', letterSpacing: typography.tiny.tracking, textAlign: 'right' }}>Actions</span>
          </div>
          <div style={{ height: 1, background: border }} />
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
    <div className="grid grid-cols-[1fr_80px_auto] gap-4 items-center px-4 py-3.5 transition-colors hover:bg-white/[0.03]" style={{ borderRadius: radius.lg }} data-testid={`members-invitation-row-${invitation.id}`}>
      {/* Email + expiry */}
      <div className="min-w-0">
        <p style={{ fontSize: typography.body.size, fontWeight: 600, color: text }} className="truncate">{invitation.email}</p>
        <div className="flex items-center gap-2 mt-1">
          {isExpired ? (
            <span style={{ fontSize: typography.label.size, color: C.err, fontWeight: 500 }}>Expired</span>
          ) : (
            <span style={{ fontSize: typography.label.size, color: textDim }}>
              Expires {new Date(invitation.expires_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Role */}
      <span
        className="px-2.5 py-1 w-fit"
        style={{ background: 'rgba(155,143,247,0.15)', color: '#9B8FF7', borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}
      >
        {invitation.role}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        {!isExpired && (
          <button
            onClick={() => onCopyLink(invitation.invite_url, invitation.id)}
            className="px-3 py-1.5 transition-all hover:bg-white/5"
            style={{ color: textSec, borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: 600 }}
          >
            {copiedId === invitation.id ? 'Copied!' : 'Copy link'}
          </button>
        )}
        <button
          onClick={() => onRevoke(invitation.id)}
          disabled={revoking}
          data-testid={`members-revoke-btn-${invitation.id}`}
          className="px-3 py-1.5 transition-all disabled:opacity-50 hover:bg-white/5"
          style={{ color: C.err, borderRadius: radius.lg, fontSize: typography.label.size, fontWeight: 600 }}
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
    <div className="min-h-screen relative" data-testid="members-page" style={{ background: pageBg, fontFamily: typography.fontFamily }}>
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,87,232,0.14) 0%, transparent 60%)' }} />

      {/* Accent line at top */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${C.accent}, transparent 70%)` }} />

      <div className="w-full px-6 md:px-11 pt-12 pb-24 relative z-10">
        {/* Header */}
        {org && (
          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: C.accent, color: '#FFFFFF', borderRadius: radius.lg, fontSize: typography.body.size, fontWeight: 800 }}>
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <p style={{ color: text, fontSize: typography.h3.size, fontWeight: typography.h3.weight, letterSpacing: typography.h3.tracking }}>{org.name}</p>
              <p style={{ color: textDim, fontSize: typography.label.size }}>Workspace members</p>
            </div>
          </div>
        )}

        {/* All sections stacked */}
        <div className="flex flex-col gap-10">
          <section className="p-7" style={{ background: surfaceBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
            <InviteSection isFreePlan={isFreePlan} />
          </section>

          <section className="p-7" style={{ background: surfaceBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
            <TeamMembersSection members={members} isLoading={loadingMembers} isFreePlan={isFreePlan} />
          </section>

          <section className="p-7" style={{ background: surfaceBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
            <PendingInvitationsSection />
          </section>
        </div>
      </div>
    </div>
  )
}
