import { describe, it, expect } from 'vitest'
import { invitationKeys } from './useInvitations'

describe('useInvitations', () => {
  it('exports stable query keys', () => {
    expect(invitationKeys.list).toEqual(['invitations'])
  })

  it('query keys are referentially stable', () => {
    expect(invitationKeys.list).toBe(invitationKeys.list)
  })

  it('exports unlinkedMembers query key', () => {
    expect(invitationKeys.unlinkedMembers).toEqual(['unlinked-members'])
  })

  it('unlinkedMembers key is referentially stable', () => {
    expect(invitationKeys.unlinkedMembers).toBe(invitationKeys.unlinkedMembers)
  })

  it('exports members query key', () => {
    expect(invitationKeys.members).toEqual(['org-members'])
  })

  it('members key is referentially stable', () => {
    expect(invitationKeys.members).toBe(invitationKeys.members)
  })

  it('exports mine query key', () => {
    expect(invitationKeys.mine).toEqual(['my-invitations'])
  })

  it('mine key is referentially stable', () => {
    expect(invitationKeys.mine).toBe(invitationKeys.mine)
  })
})
