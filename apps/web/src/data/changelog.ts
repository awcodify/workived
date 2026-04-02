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
    id: 24,
    date: '2026-04-02',
    type: 'feature',
    title: 'Work schedule management',
    description: 'Create, edit, and deactivate work schedules from Attendance → Schedules. Useful for managing shifts, part-time hours, and flexible arrangements without re-running the setup wizard.',
    module: 'Attendance',
  },
  {
    id: 23,
    date: '2026-04-01',
    type: 'feature',
    title: 'Per-employee work schedule override',
    description: 'Employees can now be assigned a specific work schedule that overrides the org default. Useful for shift workers, part-time staff, or remote employees in different timezones. Set it from the employee edit page.',
    module: 'People',
  },
  {
    id: 22,
    date: '2026-04-01',
    type: 'feature',
    title: 'Lifetime-limited leave policies (Hajj)',
    description: 'Leave policies can now have a lifetime usage limit. Hajj leave is automatically set to once per employment, complying with Indonesian and UAE labor law. The system blocks requests after the limit is reached.',
    module: 'Leave',
  },
  {
    id: 21,
    date: '2026-04-01',
    type: 'improvement',
    title: 'Leave policies now open in a modal',
    description: 'Creating and editing leave policies now happens in a quick modal instead of navigating to a separate page. Faster workflow, no context switching.',
    module: 'Leave',
  },
  {
    id: 20,
    date: '2026-04-01',
    type: 'feature',
    title: 'Known Issues page added',
    description: 'You can now check the Known Issues page from the settings menu to see bugs we know about and are working to fix.',
    module: 'System',
  },
  {
    id: 19,
    date: '2026-04-01',
    type: 'feature',
    title: 'Task board now has Tasks vs Approvals filter',
    description: 'Toggle between All, Tasks only, or Approvals only on the task board. Your selection is saved in the URL so you can bookmark or share it.',
    module: 'Tasks',
  },
  {
    id: 18,
    date: '2026-04-01',
    type: 'feature',
    title: 'Upgrade prompt for Pro features',
    description: 'When you hit a Pro feature limit (like the 25 employee cap), you now see a friendly upgrade prompt instead of a generic error.',
  },
  {
    id: 17,
    date: '2026-04-01',
    type: 'fix',
    title: 'Employee form now shows specific error messages',
    description: 'Adding an employee with a duplicate email now shows "email already exists" instead of a generic error.',
    module: 'People',
  },
  {
    id: 16,
    date: '2026-04-01',
    type: 'fix',
    title: 'Setup review now shows work schedule details',
    description: 'The setup wizard review step now correctly displays your selected work schedule days and hours.',
    module: 'Setup',
  },
  {
    id: 15,
    date: '2026-04-01',
    type: 'fix',
    title: 'New employees now see leave balances immediately after joining',
    description: 'Leave balances are now created automatically when an employee accepts an invitation, so they no longer need to visit the leave page first.',
    module: 'Leave',
  },
  {
    id: 14,
    date: '2026-04-01',
    type: 'fix',
    title: 'Attendance present count now updates after clock-in',
    description: 'The attendance page now refreshes team data automatically so the present/late/absent counts reflect reality without needing a page reload.',
    module: 'Attendance',
  },
  {
    id: 13,
    date: '2026-04-01',
    type: 'fix',
    title: 'Task board Done count now shows correctly',
    description: 'The Done stat in the task board header was always showing 0. Fixed to count completed tasks even when the "Show completed" toggle is off.',
    module: 'Tasks',
  },
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
