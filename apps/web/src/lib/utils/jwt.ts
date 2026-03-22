// Decode the payload section of a JWT for UI-only purposes.
// Never use this for security decisions — the backend validates signatures.
// This is only used to gate UI elements based on the role claim.

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → standard base64
    const base64 = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return null
  }
}

// Returns the `role` claim from the JWT, or null if unreadable.
// Claim key is `role` per services/internal/platform/middleware/auth.go.
export function parseJwtRole(token: string | null): string | null {
  if (!token) return null
  const payload = parseJwtPayload(token)
  if (!payload) return null
  return typeof payload['role'] === 'string' ? payload['role'] : null
}

// Returns the org_id claim from the JWT, or null if the user has no org yet.
// Claim key is `oid` per services/internal/platform/middleware/auth.go (Claims.OrgID json:"oid").
// OrgID is uuid.UUID (not a pointer), so no-org tokens carry the zero UUID
// "00000000-0000-0000-0000-000000000000" rather than an empty string.
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

export function parseJwtOrgId(token: string | null): string | null {
  if (!token) return null
  const payload = parseJwtPayload(token)
  if (!payload) return null
  const oid = payload['oid']
  return typeof oid === 'string' && oid !== '' && oid !== ZERO_UUID ? oid : null
}

// Returns whether the authenticated member has subordinates (direct reports).
// Claim key is `has_sub` per services/internal/platform/middleware/auth.go.
// Used for team-level permissions (leave/claims/attendance approvals).
export function parseJwtHasSubordinate(token: string | null): boolean {
  if (!token) return false
  const payload = parseJwtPayload(token)
  if (!payload) return false
  return payload['has_sub'] === true
}
