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
    id: 29,
    date: '2026-04-26',
    type: 'improvement',
    title: 'Task board revamp — filters, editor, and collapsible columns',
    description: 'Filters now support multi-select for priority and labels, and search includes task codes. The task editor has a richer experience — subtasks, linked tasks, attachments, custom fields, and a time picker for due dates. Columns can be expanded or collapsed; the board remembers how many you want open at once and swaps smartly when the limit is hit.',
    module: 'Tasks',
  },
  {
    id: 28,
    date: '2026-04-29',
    type: 'feature',
    title: 'Drag-and-drop org chart editing',
    description: 'Drag any card onto another to reassign reporting lines. Changes are staged locally so you can rearrange multiple people before saving in one go. Pending cards show an amber dot and a save bar at the bottom. Connector lines are now smooth curves that follow the nearest card edge.',
    module: 'People',
  },
  {
    id: 27,
    date: '2026-04-14',
    type: 'improvement',
    title: 'Reports redesigned with light theme',
    description: 'The Reports module now uses a clean light background matching the rest of the app. Easier to read at a glance and more consistent across modules.',
    module: 'Reports',
  },
  {
    id: 26,
    date: '2026-04-14',
    type: 'feature',
    title: 'Grade distribution chart in Reports',
    description: 'A new donut chart shows how your team is distributed across performance grades (A/B/C/D) with percentages. Quickly see if most of your team is performing well or needs attention.',
    module: 'Reports',
  },
  {
    id: 25,
    date: '2026-04-14',
    type: 'improvement',
    title: 'Scorecard factor explanations',
    description: 'Each performance factor (Attendance, Punctuality, Leave, Tasks) now shows a plain-English explanation of what is measured and how the score is calculated. No more guessing why someone got a certain score.',
    module: 'Reports',
  },
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
    id: 21,
    date: '2026-04-01',
    type: 'improvement',
    title: 'Leave policies now open in a modal',
    description: 'Creating and editing leave policies now happens in a quick modal instead of navigating to a separate page. Faster workflow, no context switching.',
    module: 'Leave',
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
    id: 11,
    date: '2026-03-31',
    type: 'feature',
    title: 'Email notifications are here',
    description: 'Workived now sends email notifications for invitations and welcome messages. More notification types coming soon.',
    module: 'System',
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
    id: 5,
    date: '2026-03-27',
    type: 'fix',
    title: '"All" filter now shows everyone\'s tasks',
    description: 'Choosing "All" in the assignee dropdown now correctly shows tasks from the whole team.',
    module: 'Tasks',
  }
]

/** Get the latest entry ID for "What's New" comparison */
export function getLatestChangelogId(): number {
  return changelog[0]?.id ?? 0
}
