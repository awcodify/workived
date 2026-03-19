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
