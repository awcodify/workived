import { useState } from 'react'
import { UserPlus, ChevronLeft, Check, Loader2, X } from 'lucide-react'
import type { InvitationInput, MemberRole } from '@/types/api'
import { colors } from '@/design/tokens'

interface InvitationsStepProps {
  invitations: InvitationInput[]
  onNext: (invitations: InvitationInput[]) => void
  onBack: () => void
  isSubmitting: boolean
}

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
]

export function InvitationsStep({
  invitations: initialInvitations,
  onNext,
  onBack,
  isSubmitting,
}: InvitationsStepProps) {
  const [invitations, setInvitations] = useState<InvitationInput[]>(
    initialInvitations.length > 0
      ? initialInvitations
      : [{ email: '', role: 'member' }],
  )

  const addInvitation = () => {
    if (invitations.length < 10) {
      setInvitations([...invitations, { email: '', role: 'member' }])
    }
  }

  const removeInvitation = (index: number) => {
    setInvitations(invitations.filter((_, i) => i !== index))
  }

  const updateInvitation = (index: number, updates: Partial<InvitationInput>) => {
    setInvitations(
      invitations.map((inv, i) => (i === index ? { ...inv, ...updates } : inv)),
    )
  }

  const handleFinish = () => {
    const validInvitations = invitations.filter((inv) => inv.email.trim().length > 0)
    onNext(validInvitations)
  }

  return (
    <div>
      <div className="mb-10 text-center">
        <div 
          className="mb-4 inline-flex h-16 w-16 items-center justify-center"
          style={{ borderRadius: 16, background: colors.warnDim }}
        >
          <UserPlus className="h-8 w-8" style={{ color: colors.warn }} />
        </div>
        <h2 className="mb-3 text-4xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em' }}>
          Invite Team Members
        </h2>
        <p className="text-base" style={{ color: colors.ink500 }}>
          Add up to 10 team members (optional - you can invite more later)
        </p>
      </div>

      <div className="mb-8 space-y-4">
        {invitations.map((invitation, index) => (
          <div
            key={index}
            className="flex items-center gap-3"
            style={{
              borderRadius: 14,
              border: `1px solid ${colors.ink150}`,
              background: colors.ink0,
              padding: '14px 18px',
              boxShadow: '0 1px 6px 0 rgba(0,0,0,0.03)',
            }}
          >
            <input
              type="email"
              value={invitation.email}
              onChange={(e) => updateInvitation(index, { email: e.target.value })}
              placeholder="colleague@example.com"
              className="flex-1 px-4 py-2 text-base"
              style={{
                borderRadius: 10,
                border: `1px solid ${colors.ink150}`,
                background: colors.ink0,
                color: colors.ink900,
              }}
            />

            <select
              value={invitation.role}
              onChange={(e) => updateInvitation(index, { role: e.target.value as MemberRole })}
              className="px-4 py-2 text-base font-medium"
              style={{
                borderRadius: 10,
                border: `1px solid ${colors.ink150}`,
                background: colors.ink0,
                color: colors.ink700,
              }}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>

            {invitations.length > 1 && (
              <button
                onClick={() => removeInvitation(index)}
                className="p-2 transition-opacity hover:opacity-70"
                style={{ 
                  borderRadius: 8,
                  color: colors.err 
                }}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}

        {invitations.length < 10 && (
          <button
            onClick={addInvitation}
            className="w-full px-4 py-4 text-base font-medium transition-all hover:border-opacity-60"
            style={{
              borderRadius: 14,
              border: `2px dashed ${colors.ink150}`,
              background: colors.ink0,
              color: colors.ink500,
            }}
          >
            + Add another member
          </button>
        )}
      </div>

      <div 
        className="mb-8"
        style={{
          borderRadius: 14,
          border: `1px solid ${colors.accentDim}`,
          background: colors.accentDim,
          padding: '18px 22px',
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: colors.accent }}>
          <strong>Tip:</strong> You can skip invitations and add team members later from
          Settings → Team.
        </p>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 font-semibold transition-all hover:bg-opacity-60 disabled:opacity-50"
          style={{
            borderRadius: 12,
            border: `1px solid ${colors.ink150}`,
            background: colors.ink0,
            color: colors.ink700,
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={handleFinish}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.accentMid} 0%, ${colors.accent} 100%)`,
            color: colors.ink0,
            boxShadow: !isSubmitting ? '0 4px 14px 0 rgba(99,87,232,0.25)' : 'none',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Completing Setup...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Finish Setup
            </>
          )}
        </button>
      </div>
    </div>
  )
}
