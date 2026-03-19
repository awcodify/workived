/**
 * Extract the invitation token from an invite URL.
 * Prefers URLSearchParams for robustness, falls back to empty string.
 */
export function extractInviteToken(inviteUrl: string): string {
  try {
    const url = new URL(inviteUrl)
    return url.searchParams.get('token') ?? ''
  } catch {
    return ''
  }
}
