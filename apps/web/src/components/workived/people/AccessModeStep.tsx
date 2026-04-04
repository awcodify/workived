import { UserCheck, Mail, UserPlus } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { colors, moduleThemes } from '@/design/tokens'
import { useUnlinkedMembers } from '@/lib/hooks/useInvitations'

const t = moduleThemes.people

type EmailMode = 'member' | 'new' | 'skip'

interface AccessModeCardProps {
  icon: React.ReactNode
  title: string
  description: string
  value: EmailMode
  selected: boolean
  onSelect: () => void
}

function AccessModeCard({
  icon,
  title,
  description,
  selected,
  onSelect,
}: AccessModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-all text-left hover:shadow-sm h-full"
      style={{
        borderColor: selected ? colors.accent : t.border,
        background: selected ? `${colors.accentDim}` : t.surface,
      }}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            background: selected ? colors.accent : t.input,
            color: selected ? '#FFFFFF' : t.textMuted,
          }}
        >
          {icon}
        </div>
        <span className="text-sm font-bold" style={{ color: t.text }}>
          {title}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
        {description}
      </p>
    </button>
  )
}

interface AccessModeStepProps {
  form: UseFormReturn<any>
}

export function AccessModeStep({ form }: AccessModeStepProps) {
  const emailMode = form.watch('email_mode') as EmailMode
  const { data: unlinkedMembers = [], isLoading: loadingMembers } = useUnlinkedMembers()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-2" style={{ color: t.text }}>
          How will this person access Workived?
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
          Choose whether to give this employee workspace login access or create an HR-only profile.
        </p>
      </div>

      {/* Access mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AccessModeCard
          icon={<Mail size={20} />}
          title="Invite new person"
          description="They'll receive an invitation email to join your workspace. Once accepted, they can log in and access their employee profile, leave requests, and attendance tracking."
          value="new"
          selected={emailMode === 'new'}
          onSelect={() => {
            form.setValue('email_mode', 'new')
            form.setValue('selected_user_id', '')
          }}
        />

        <AccessModeCard
          icon={<UserCheck size={20} />}
          title="Link existing member"
          description="Connect this employee profile to someone who already has a workspace account. This links their login to their HR record for attendance and leave tracking."
          value="member"
          selected={emailMode === 'member'}
          onSelect={() => {
            form.setValue('email_mode', 'member')
            form.setValue('email', '')
          }}
        />

        <AccessModeCard
          icon={<UserPlus size={20} />}
          title="HR record only"
          description="Create an employee profile without login access. Perfect for contractors, part-time staff, or field workers who don't need digital workspace access. You can send an invite later."
          value="skip"
          selected={emailMode === 'skip'}
          onSelect={() => {
            form.setValue('email_mode', 'skip')
            form.setValue('selected_user_id', '')
            form.setValue('email', '')
          }}
        />
      </div>

      {/* Conditional inputs */}
      {emailMode === 'member' && (
        <div
          className="p-5 rounded-xl space-y-4"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          {loadingMembers ? (
            <p className="text-sm" style={{ color: t.textMuted }}>
              Loading workspace members…
            </p>
          ) : unlinkedMembers.length === 0 ? (
            <div
              className="p-4 rounded-lg text-center"
              style={{ background: colors.accentDim }}
            >
              <p className="text-sm font-medium" style={{ color: t.text }}>
                All workspace members already have HR records
              </p>
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                Invite new members from Settings → Members first, or choose "Invite new person" above.
              </p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
                  Select member
                </span>
                <select
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{
                    background: t.input,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                  {...form.register('selected_user_id')}
                >
                  <option value="">— Choose a member —</option>
                  {unlinkedMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
                {form.formState.errors.selected_user_id && (
                  <p className="text-xs mt-1.5" style={{ color: colors.err }}>
                    {form.formState.errors.selected_user_id.message as string}
                  </p>
                )}
              </label>
            </>
          )}
        </div>
      )}

      {emailMode === 'new' && (
        <div
          className="p-5 rounded-xl space-y-4"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block" style={{ color: t.text }}>
              Email address
            </span>
            <input
              type="email"
              placeholder="name@company.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              style={{
                background: t.input,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
              }}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-xs mt-1.5" style={{ color: colors.err }}>
                {form.formState.errors.email.message as string}
              </p>
            )}
          </label>
        </div>
      )}
    </div>
  )
}
