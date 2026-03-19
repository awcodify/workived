import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useRole, useCanEditOrgSettings, useCanInvite, useHasOrg } from './useRole'
import { useAuthStore } from '@/lib/stores/auth'

function makeToken(role: string, orgId?: string): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload: Record<string, unknown> = { uid: 'u1', role }
  if (orgId !== undefined) payload['oid'] = orgId
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.sig`
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null })
})

describe('useRole', () => {
  it('returns null when unauthenticated', () => {
    const { result } = renderHook(() => useRole())
    expect(result.current).toBeNull()
  })

  it('returns the role from the JWT', () => {
    useAuthStore.setState({ accessToken: makeToken('admin') })
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('admin')
  })

  it('returns owner role', () => {
    useAuthStore.setState({ accessToken: makeToken('owner') })
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('owner')
  })
})

describe('useCanEditOrgSettings', () => {
  it('returns true for owner', () => {
    useAuthStore.setState({ accessToken: makeToken('owner') })
    const { result } = renderHook(() => useCanEditOrgSettings())
    expect(result.current).toBe(true)
  })

  it('returns true for admin', () => {
    useAuthStore.setState({ accessToken: makeToken('admin') })
    const { result } = renderHook(() => useCanEditOrgSettings())
    expect(result.current).toBe(true)
  })

  it('returns false for member', () => {
    useAuthStore.setState({ accessToken: makeToken('member') })
    const { result } = renderHook(() => useCanEditOrgSettings())
    expect(result.current).toBe(false)
  })

  it('returns false for hr_admin', () => {
    useAuthStore.setState({ accessToken: makeToken('hr_admin') })
    const { result } = renderHook(() => useCanEditOrgSettings())
    expect(result.current).toBe(false)
  })

  it('returns false when unauthenticated', () => {
    const { result } = renderHook(() => useCanEditOrgSettings())
    expect(result.current).toBe(false)
  })
})

describe('useCanInvite', () => {
  it('returns true for owner', () => {
    useAuthStore.setState({ accessToken: makeToken('owner') })
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(true)
  })

  it('returns true for admin', () => {
    useAuthStore.setState({ accessToken: makeToken('admin') })
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(true)
  })

  it('returns true for hr_admin', () => {
    useAuthStore.setState({ accessToken: makeToken('hr_admin') })
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(true)
  })

  it('returns false for member', () => {
    useAuthStore.setState({ accessToken: makeToken('member') })
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(false)
  })

  it('returns false for manager', () => {
    useAuthStore.setState({ accessToken: makeToken('manager') })
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(false)
  })

  it('returns false when unauthenticated', () => {
    const { result } = renderHook(() => useCanInvite())
    expect(result.current).toBe(false)
  })
})

describe('useHasOrg', () => {
  it('returns false when unauthenticated', () => {
    const { result } = renderHook(() => useHasOrg())
    expect(result.current).toBe(false)
  })

  it('returns false when token has no org_id', () => {
    useAuthStore.setState({ accessToken: makeToken('member') })
    const { result } = renderHook(() => useHasOrg())
    expect(result.current).toBe(false)
  })

  it('returns false when org_id is empty string', () => {
    useAuthStore.setState({ accessToken: makeToken('member', '') })
    const { result } = renderHook(() => useHasOrg())
    expect(result.current).toBe(false)
  })

  it('returns true when token contains a non-empty org_id', () => {
    useAuthStore.setState({ accessToken: makeToken('owner', 'org-abc') })
    const { result } = renderHook(() => useHasOrg())
    expect(result.current).toBe(true)
  })
})
