import { describe, test, expect } from 'vitest'
import { extractInviteToken } from './url'

describe('extractInviteToken', () => {
  test('extracts token from a valid invite URL', () => {
    expect(extractInviteToken('https://app.workived.com/invite?token=abc123')).toBe('abc123')
  })

  test('extracts token when URL has multiple query params', () => {
    expect(extractInviteToken('https://app.workived.com/invite?foo=bar&token=xyz789&baz=1')).toBe('xyz789')
  })

  test('returns empty string when token param is missing', () => {
    expect(extractInviteToken('https://app.workived.com/invite?other=value')).toBe('')
  })

  test('returns empty string for URL with no query params', () => {
    expect(extractInviteToken('https://app.workived.com/invite')).toBe('')
  })

  test('returns empty string for invalid URL', () => {
    expect(extractInviteToken('not-a-url')).toBe('')
  })

  test('returns empty string for empty string', () => {
    expect(extractInviteToken('')).toBe('')
  })

  test('handles token with special characters', () => {
    expect(extractInviteToken('https://app.workived.com/invite?token=abc%3D123')).toBe('abc=123')
  })
})
