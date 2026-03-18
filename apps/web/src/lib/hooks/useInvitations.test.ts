import { describe, it, expect } from 'vitest'
import { invitationKeys } from './useInvitations'

describe('useInvitations', () => {
  it('exports stable query keys', () => {
    expect(invitationKeys.list).toEqual(['invitations'])
  })

  it('query keys are referentially stable', () => {
    expect(invitationKeys.list).toBe(invitationKeys.list)
  })
})
