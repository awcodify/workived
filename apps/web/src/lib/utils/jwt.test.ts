import { describe, it, expect } from 'vitest'
import { parseJwtPayload, parseJwtRole, parseJwtOrgId } from './jwt'

// Build a minimal JWT with a given payload (unsigned — for test purposes only)
function makeToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.fakesig`
}

describe('parseJwtPayload', () => {
  it('returns parsed payload from a valid JWT', () => {
    const token = makeToken({ uid: 'abc', role: 'admin', oid: 'org-1' })
    expect(parseJwtPayload(token)).toMatchObject({ uid: 'abc', role: 'admin', oid: 'org-1' })
  })

  it('returns null for a non-JWT string', () => {
    expect(parseJwtPayload('not.a.jwt.with.extra')).toBeNull()
    expect(parseJwtPayload('onlyone')).toBeNull()
  })

  it('returns null for malformed base64 in payload', () => {
    expect(parseJwtPayload('header.!!!invalid!!!.sig')).toBeNull()
  })
})

describe('parseJwtRole', () => {
  it('extracts role from a valid token', () => {
    expect(parseJwtRole(makeToken({ role: 'admin' }))).toBe('admin')
    expect(parseJwtRole(makeToken({ role: 'owner' }))).toBe('owner')
    expect(parseJwtRole(makeToken({ role: 'member' }))).toBe('member')
    expect(parseJwtRole(makeToken({ role: 'hr_admin' }))).toBe('hr_admin')
  })

  it('returns null for null token', () => {
    expect(parseJwtRole(null)).toBeNull()
  })

  it('returns null if role claim is missing', () => {
    expect(parseJwtRole(makeToken({ uid: 'abc' }))).toBeNull()
  })

  it('returns null if role claim is not a string', () => {
    expect(parseJwtRole(makeToken({ role: 42 }))).toBeNull()
  })

  it('returns null for an invalid token', () => {
    expect(parseJwtRole('bad.token')).toBeNull()
  })
})

describe('parseJwtOrgId', () => {
  it('extracts oid from a valid token', () => {
    expect(parseJwtOrgId(makeToken({ oid: 'org-abc', role: 'owner' }))).toBe('org-abc')
  })

  it('returns null for null token', () => {
    expect(parseJwtOrgId(null)).toBeNull()
  })

  it('returns null if oid claim is missing', () => {
    expect(parseJwtOrgId(makeToken({ role: 'member' }))).toBeNull()
  })

  it('returns null if oid is an empty string', () => {
    expect(parseJwtOrgId(makeToken({ oid: '' }))).toBeNull()
  })

  it('returns null if oid is the zero UUID (no org assigned in backend)', () => {
    expect(parseJwtOrgId(makeToken({ oid: '00000000-0000-0000-0000-000000000000' }))).toBeNull()
  })

  it('returns null for an invalid token', () => {
    expect(parseJwtOrgId('bad.token')).toBeNull()
  })
})
