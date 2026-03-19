import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useRole, useCanEditOrgSettings, useCanInvite } from './useRole'
import { useAuthStore } from '@/lib/stores/auth'

function makeToken(role: string): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode({ uid: 'u1', oid: 'o1', role })}.sig`
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
