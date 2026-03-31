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
    id: 12,
    date: '2026-03-31',
    type: 'fix',
    title: 'UAE leave policies now match the law',
    description: 'Maternity Leave (60 days) and Paternity Leave (5 days) are now correctly set up for UAE organisations. The confusing "Parental Leave" entry has been removed.',
    module: 'Leave',
  },
  {
    id: 11,
    date: '2026-03-31',
    type: 'feature',
    title: 'Email notifications are here',
    description: 'Workived now sends email notifications for invitations and welcome messages. More notification types coming soon.',
    module: 'System',
  },
  {
    id: 10,
    date: '2026-03-28',
    type: 'feature',
    title: 'Create unlimited leave policies',
    description: 'You can now mark a leave policy as "Unlimited" — perfect for sick leave or flexible PTO. Employees see ∞ instead of a confusing day count.',
    module: 'Leave',
  },
  {
    id: 9,
    date: '2026-03-28',
    type: 'feature',
    title: 'Leave and claims now match your team\'s employment types',
    description: 'You can now choose which employment types (full-time, part-time, contract, intern) are eligible for each leave policy and claim category. Only matching employees will see and use them.',
    module: 'Leave & Claims',
  },
  {
    id: 8,
    date: '2026-03-28',
    type: 'feature',
    title: 'Install Workived on your phone',
    description: 'Add Workived to your home screen for instant access — opens like a native app, no app store needed.',
  },
  {
    id: 7,
    date: '2026-03-28',
    type: 'feature',
    title: 'What\'s New page',
    description: 'You\'re reading it! Check here anytime for the latest updates, improvements, and fixes.',
  },
  {
    id: 6,
    date: '2026-03-27',
    type: 'fix',
    title: 'Task comments are back',
    description: 'Posting comments on tasks works again — sorry about that!',
    module: 'Tasks',
  },
  {
    id: 5,
    date: '2026-03-27',
    type: 'fix',
    title: '"All" filter now shows everyone\'s tasks',
    description: 'Choosing "All" in the assignee dropdown now correctly shows tasks from the whole team.',
    module: 'Tasks',
  },
  {
    id: 4,
    date: '2026-03-27',
    type: 'fix',
    title: 'Done column counts are now correct',
    description: 'The number next to "Done" now reflects all completed tasks, including older ones.',
    module: 'Tasks',
  },
  {
    id: 3,
    date: '2026-03-27',
    type: 'fix',
    title: 'Present count restored in attendance',
    description: 'The attendance summary card now shows the right number of employees who checked in on time.',
    module: 'Attendance',
  },
  {
    id: 2,
    date: '2026-03-27',
    type: 'fix',
    title: 'Leave policy day limit corrected',
    description: 'Leave policies now cap at 365 days per year as intended.',
    module: 'Leave',
  },
  {
    id: 1,
    date: '2026-03-27',
    type: 'fix',
    title: 'Correct currency for UAE companies',
    description: 'Claims budgets now show AED for UAE organisations instead of the wrong currency.',
    module: 'Claims',
  },
]

/** Get the latest entry ID for "What's New" comparison */
export function getLatestChangelogId(): number {
  return changelog[0]?.id ?? 0
}
