/**
 * Workived Changelog — static typed entries
 * Add new entries at the top of the array (newest first).
 * Redeploy to publish — no backend needed.
 */

export type ChangelogType = 'feature' | 'fix' | 'improvement' | 'announcement'

export interface ChangelogEntry {
  /** Unique ID — use incrementing integers */
  id: number
  /** ISO date string (YYYY-MM-DD) */
  date: string
  type: ChangelogType
  title: string
  description: string
  /** Optional module tag for context */
  module?: string
}

export const changelog: ChangelogEntry[] = [
  {
    id: 8,
    date: '2026-03-28',
    type: 'feature',
    title: 'Install Workived as an app',
    description: 'Workived is now a Progressive Web App! Add it to your home screen for instant access — no app store needed.',
  },
  {
    id: 7,
    date: '2026-03-28',
    type: 'feature',
    title: 'System Changelog',
    description: 'You\'re looking at it! Stay up to date with new features, fixes, and improvements.',
  },
  {
    id: 6,
    date: '2026-03-27',
    type: 'fix',
    title: 'Task comments now work correctly',
    description: 'Fixed an issue where task comments would fail to post due to a missing database column.',
    module: 'Tasks',
  },
  {
    id: 5,
    date: '2026-03-27',
    type: 'fix',
    title: 'Task filter "All" shows all tasks',
    description: 'Selecting "All" in the assignee filter no longer incorrectly shows only unassigned tasks.',
    module: 'Tasks',
  },
  {
    id: 4,
    date: '2026-03-27',
    type: 'fix',
    title: 'Accurate task status counts',
    description: 'Done column count now correctly includes all completed tasks, even those completed before the status tracking update.',
    module: 'Tasks',
  },
  {
    id: 3,
    date: '2026-03-27',
    type: 'fix',
    title: 'Attendance shows correct present count',
    description: 'The attendance summary now accurately counts employees who checked in on time.',
    module: 'Attendance',
  },
  {
    id: 2,
    date: '2026-03-27',
    type: 'fix',
    title: 'Sick leave cap corrected to 365 days',
    description: 'Leave policies now enforce a maximum of 365 days per year instead of the previous incorrect 999.',
    module: 'Leave',
  },
  {
    id: 1,
    date: '2026-03-27',
    type: 'fix',
    title: 'Claims show correct currency for UAE orgs',
    description: 'Claims budget cards now display AED for UAE organisations instead of defaulting to IDR.',
    module: 'Claims',
  },
]

/** Get the latest entry ID for "What's New" comparison */
export function getLatestChangelogId(): number {
  return changelog[0]?.id ?? 0
}
