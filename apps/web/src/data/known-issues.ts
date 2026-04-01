/**
 * Workived Known Issues — static typed entries
 * Add new entries at the top of the array (newest first).
 * Remove resolved entries after 30 days.
 * Redeploy to publish — no backend needed.
 */

export type IssueStatus = 'investigating' | 'fixing' | 'resolved'

export interface KnownIssue {
  /** Unique ID — use incrementing integers */
  id: number
  /** ISO date string when issue was first reported (YYYY-MM-DD) */
  reported: string
  status: IssueStatus
  title: string
  description: string
  /** Optional module tag for context */
  module?: string
  /** Optional estimated fix date (YYYY-MM-DD) */
  eta?: string
}

export const knownIssues: KnownIssue[] = [
  // Add known issues here as they are discovered.
  // Example:
  // {
  //   id: 1,
  //   reported: '2026-04-01',
  //   status: 'fixing',
  //   title: 'Clock-in sometimes records wrong timezone',
  //   description: 'If your browser timezone differs from your organisation timezone, clock-in time may be recorded in the wrong timezone. Workaround: ensure your device timezone matches your org settings.',
  //   module: 'Attendance',
  //   eta: '2026-04-07',
  // },
]
