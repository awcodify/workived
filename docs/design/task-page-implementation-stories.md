# Task Page Redesign — Implementation Stories

**Epic:** Task Page Mobile-First Redesign
**Designer:** Design Role | **Date:** April 3, 2026
**Reference Docs:**
- [Design Document](./task-page-redesign.md)
- [Wireframes](./task-page-wireframes.md)

---

## Epic Summary

**Problem:** Current task page is desktop-only. Mobile users cannot effectively manage tasks on small screens. The 3-column Kanban breaks at <640px, making task management frustrating on mobile devices.

**Solution:** Redesign with mobile-first approach:
- Tab navigation for single-column view on mobile
- Enhanced task cards with more visible metadata
- Persistent team workload sidebar on desktop
- Smart task grouping to reduce cognitive load
- Quick actions menu for faster task management

**Business Value:**
- 40% of HR managers work on mobile during meetings
- Faster task completion = less admin overhead
- Better team workload visibility = improved delegation
- Completion celebrations = increased engagement

---

## Stories (Prioritized)

### 🔴 Phase 1: Mobile Responsiveness (Must Have)

#### **Story 1.1: Mobile Tab Navigation**
**As a** mobile user  
**I want** to switch between task columns via tabs  
**So that** I can see all my tasks without horizontal scrolling

**Acceptance Criteria:**
- [ ] Tab bar shows at top on mobile (<640px)
- [ ] Tabs show column name + count (e.g., "To Do (5)")
- [ ] Active tab highlighted with solid background
- [ ] Tap tab → Switch to that column (smooth animation)
- [ ] Swipe left/right → Navigate between columns
- [ ] URL updates with active column (e.g., `?column=progress`)

**Design:** See wireframes section 4
**Effort:** M (5 days)
**Files:** `apps/web/src/routes/_app/tasks/route.tsx`, new component `ColumnTabNav.tsx`

---

#### **Story 1.2: Mobile-Optimized Task Cards**
**As a** mobile user  
**I want** task cards optimized for touch targets  
**So that** I can easily tap and interact with tasks

**Acceptance Criteria:**
- [ ] Card min-height: 88px (44px touch target + padding)
- [ ] Tap card → Opens detail modal
- [ ] Long-press (0.5s) → Opens quick actions menu
- [ ] Avatar size: 32px (visible on small screens)
- [ ] Due date badge: 12px font (legible)

**Design:** See wireframes section 8
**Effort:** S (2 days)
**Files:** `apps/web/src/components/tasks/TaskCard.tsx`

---

#### **Story 1.3: Mobile Team Workload Bottom Sheet**
**As a** mobile user  
**I want** to check team workload before assigning  
**So that** I don't overload busy colleagues

**Acceptance Criteria:**
- [ ] "Team 👥" button in header on mobile
- [ ] Tap → Bottom sheet slides up
- [ ] Shows status summary (😊 3 available, etc.)
- [ ] Shows all employees with workload
- [ ] Swipe down or tap X → Close
- [ ] Sheet has drag handle for discoverability

**Design:** See wireframes section 5
**Effort:** M (4 days)
**Files:** New components `TeamWorkloadSheet.tsx`, `EmployeeWorkloadItem.tsx`

---

### 🟡 Phase 2: Enhanced Task Cards (Should Have)

#### **Story 2.1: Assignee Avatar on Cards**
**As a** user  
**I want** to see who's assigned to each task  
**So that** I don't need to click every card

**Acceptance Criteria:**
- [ ] Avatar overlaps top-right corner (32px circle)
- [ ] Shows first letter if no photo
- [ ] Hover → Tooltip with full name + workload
- [ ] Mobile: Tap avatar → Show quick info
- [ ] Unassigned tasks show empty circle with "+"

**Design:** See wireframes section 8 (card states)
**Effort:** S (2 days)
**Files:** `apps/web/src/components/tasks/TaskCard.tsx`, new `AssigneeAvatar.tsx`

---

#### **Story 2.2: Due Date Badge on Cards**
**As a** user  
**I want** to see due dates on task cards  
**So that** I can prioritize urgent work

**Acceptance Criteria:**
- [ ] Badge bottom-left corner (12px font)
- [ ] Format: "📅 Apr 5" or "📅 Due today"
- [ ] No due date → Badge hidden
- [ ] Truncate long dates on mobile

**Design:** See wireframes section 8
**Effort:** XS (1 day)
**Files:** `apps/web/src/components/tasks/TaskCardFooter.tsx`

---

#### **Story 2.3: Overdue Indicator**
**As a** user  
**I want** overdue tasks to stand out visually  
**So that** I address them immediately

**Acceptance Criteria:**
- [ ] Red pulsing border (2px, subtle animation)
- [ ] "⚠️ OVERDUE" badge in red
- [ ] Pulse animation: 2s interval (not constant)
- [ ] Respect `prefers-reduced-motion` (no animation)

**Design:** See wireframes section 8 (overdue state)
**Effort:** S (2 days)
**Files:** New component `OverdueBadge.tsx`, update `TaskCard.tsx`

---

#### **Story 2.4: Due Today Left Border**
**As a** user  
**I want** tasks due today to be highlighted  
**So that** I focus on immediate priorities

**Acceptance Criteria:**
- [ ] Yellow/amber left border (4px thick)
- [ ] "⚡ Due today" badge
- [ ] Only shows if due date = today
- [ ] Does not conflict with overdue styling

**Design:** See wireframes section 8 (due today state)
**Effort:** XS (1 day)
**Files:** `apps/web/src/components/tasks/TaskCard.tsx`

---

### 🟢 Phase 3: Smart Grouping (Nice to Have)

#### **Story 3.1: Auto-Group Tasks by Urgency**
**As a** user with many tasks  
**I want** tasks auto-grouped by urgency  
**So that** I don't scroll endlessly

**Acceptance Criteria:**
- [ ] Groups: "URGENT", "DUE THIS WEEK", "BACKLOG"
- [ ] Each group collapsible (click header)
- [ ] URGENT always expanded
- [ ] BACKLOG collapsed by default
- [ ] Remember user's collapse state (localStorage)

**Design:** See wireframes section 2 (desktop with sidebar)
**Effort:** M (5 days)
**Files:** New component `TaskGroupSection.tsx`, update `StatusColumn`

---

#### **Story 3.2: Overdue Tasks Group**
**As a** user  
**I want** overdue tasks at the top of each column  
**So that** I address them first

**Acceptance Criteria:**
- [ ] Separate "⚠️ OVERDUE" group at top
- [ ] Always expanded (user cannot collapse)
- [ ] Sorted by how overdue (oldest first)
- [ ] Shows "X days overdue" in group header

**Design:** See wireframes section 2
**Effort:** S (2 days)
**Files:** Update `TaskGroupSection.tsx`

---

#### **Story 3.3: Expand/Collapse All Button**
**As a** user  
**I want** to expand/collapse all groups at once  
**So that** I can quickly scan or focus

**Acceptance Criteria:**
- [ ] Button in column header: "Expand All" / "Collapse All"
- [ ] Toggles all groups in that column
- [ ] Icon changes: ⬇️ (expand) / ⬆️ (collapse)
- [ ] Keyboard shortcut: `Ctrl+E` (expand), `Ctrl+C` (collapse)

**Design:** See wireframes section 2
**Effort:** XS (1 day)
**Files:** Update `StatusColumn`

---

### 🔵 Phase 4: Quick Actions (Nice to Have)

#### **Story 4.1: Context Menu on Right-Click/Long-Press**
**As a** user  
**I want** quick actions without opening the modal  
**So that** I can edit tasks faster

**Acceptance Criteria:**
- [ ] Desktop: Right-click card → Menu
- [ ] Mobile: Long-press (0.5s) → Menu
- [ ] Actions: Mark Done, Move to..., Reassign, Delete, View Details
- [ ] Menu closes on action or click outside
- [ ] ESC key closes menu

**Design:** See wireframes section 6
**Effort:** M (4 days)
**Files:** New component `TaskQuickActions.tsx` (use Radix ContextMenu)

---

#### **Story 4.2: Keyboard Shortcuts**
**As a** power user  
**I want** keyboard shortcuts for common actions  
**So that** I can manage tasks without mouse

**Acceptance Criteria:**
- [ ] `D` → Mark selected task done
- [ ] `M` → Move to... (opens submenu)
- [ ] `E` → Edit (opens modal)
- [ ] `Backspace` → Delete (with confirmation)
- [ ] `?` → Show keyboard shortcuts help

**Design:** Not in wireframes (add help modal)
**Effort:** M (3 days)
**Files:** New component `KeyboardShortcuts.tsx`, update `TasksPage`

---

#### **Story 4.3: Inline Reassign (Dropdown)**
**As a** user  
**I want** to reassign tasks from the context menu  
**So that** I don't open the full modal

**Acceptance Criteria:**
- [ ] Context menu → "Reassign..." → Submenu
- [ ] Shows all employees with workload indicators
- [ ] Select employee → Updates task immediately
- [ ] Shows success toast: "Task reassigned to [name]"

**Design:** Extension of wireframes section 6
**Effort:** S (2 days)
**Files:** Update `TaskQuickActions.tsx`

---

### 🟣 Phase 5: Team Sidebar (Desktop Only)

#### **Story 5.1: Persistent Team Sidebar (Desktop)**
**As a** desktop user  
**I want** persistent team workload sidebar  
**So that** I always see team capacity

**Acceptance Criteria:**
- [ ] Only shows on >1024px screens
- [ ] Right side of page (300px wide)
- [ ] Fixed position (scrolls with page)
- [ ] Shows status summary at top
- [ ] Shows all employees below
- [ ] Collapsible (minimize to icon bar)

**Design:** See wireframes section 2 (desktop with sidebar)
**Effort:** L (7 days)
**Files:** New component `TeamWorkloadSidebar.tsx`, update layout

---

#### **Story 5.2: Employee Filter on Click**
**As a** user  
**I want** to click an employee in the sidebar  
**So that** I see only their tasks

**Acceptance Criteria:**
- [ ] Click employee → Highlight their row
- [ ] All task cards for other employees fade (20% opacity)
- [ ] Active filter badge shows in header: "Filtered: [name]"
- [ ] Click X or click employee again → Clear filter

**Design:** Extension of wireframes section 2
**Effort:** S (2 days)
**Files:** Update `TeamWorkloadSidebar.tsx`, `TasksPage`

---

#### **Story 5.3: Task Preview on Hover**
**As a** user  
**I want** to see an employee's tasks on hover  
**So that** I know what they're working on

**Acceptance Criteria:**
- [ ] Hover employee in sidebar → Tooltip
- [ ] Shows 3 most urgent tasks (truncated titles)
- [ ] Format: "• Task title (Due Apr 5)"
- [ ] If >3 tasks, show "...and 2 more"
- [ ] Click tooltip → Filter to that employee

**Design:** Extension of wireframes section 2
**Effort:** M (3 days)
**Files:** Update `EmployeeWorkloadItem.tsx`

---

### 🎉 Phase 6: Delight (Low Priority)

#### **Story 6.1: Completion Celebration (Confetti)**
**As a** user  
**I want** a celebration when I complete tasks  
**So that** I feel rewarded for progress

**Acceptance Criteria:**
- [ ] Confetti bursts when task marked done
- [ ] Animation: 0.8s duration, center origin
- [ ] Confetti colors match module background
- [ ] Respect `prefers-reduced-motion` (skip animation)
- [ ] User preference toggle in settings

**Design:** See wireframes section 7
**Effort:** S (2 days)
**Files:** New component `CompletionCelebration.tsx` (use `canvas-confetti`)

---

#### **Story 6.2: Streak Counter**
**As a** user  
**I want** to see my daily completion streak  
**So that** I stay motivated

**Acceptance Criteria:**
- [ ] Tracks tasks completed today
- [ ] Shows message after 3, 5, 10 completions
- [ ] Messages: "Great start! 🎉", "You're on fire! 🔥", "Productivity machine! 💪"
- [ ] Resets at midnight (org timezone)
- [ ] Optional sound effect (ding)

**Design:** See wireframes section 7
**Effort:** S (2 days)
**Files:** Update `CompletionCelebration.tsx`, new hook `useStreakCounter`

---

#### **Story 6.3: Sound Effects (Optional)**
**As a** user  
**I want** subtle sound feedback on actions  
**So that** the app feels more responsive

**Acceptance Criteria:**
- [ ] Task complete: Soft "ding" (0.5s)
- [ ] Task created: Gentle "pop" (0.3s)
- [ ] User can disable in settings
- [ ] Default: OFF (opt-in)
- [ ] Respect browser autoplay policies

**Design:** Not in wireframes (settings panel)
**Effort:** XS (1 day)
**Files:** New `useSoundEffects` hook, update settings page

---

## Technical Considerations

### Responsive CSS Strategy
```css
/* Mobile-first approach */
.kanban-board {
  /* Mobile: Single column */
  display: flex;
  flex-direction: column;
}

@media (min-width: 640px) {
  /* Tablet: 2 columns */
  .kanban-board {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1024px) {
  /* Desktop: 3 columns + sidebar */
  .kanban-board {
    grid-template-columns: repeat(3, 1fr);
    margin-right: 320px; /* Space for sidebar */
  }
}
```

### State Management
- **Active column (mobile):** URL search param `?column=todo|progress|done`
- **Collapsed groups:** localStorage per user: `tasks.collapsed.{listId}.{groupKey}`
- **Sidebar minimized:** localStorage: `tasks.sidebar.minimized`
- **Sound effects:** localStorage: `tasks.sounds.enabled`

### Performance
- **Virtualization:** If >50 tasks per column, implement virtual scrolling (react-window)
- **Debounce filters:** 300ms delay on search input
- **Memoize groups:** useMemo for grouping logic
- **Intersection Observer:** Load avatars only when visible

### Accessibility
- [ ] All buttons have ARIA labels
- [ ] Keyboard navigation (Tab, Arrow keys)
- [ ] Screen reader announces drag-drop
- [ ] Focus trap in modals and bottom sheets
- [ ] Skip to content link
- [ ] Color contrast: WCAG AA minimum (4.5:1)

---

## Testing Checklist

### Manual Testing
- [ ] Mobile: iPhone 12 (390px), Samsung S21 (360px)
- [ ] Tablet: iPad (768px), iPad Pro (1024px)
- [ ] Desktop: 1280px, 1920px, 2560px
- [ ] Touch gestures: Swipe, long-press
- [ ] Keyboard navigation: All shortcuts work
- [ ] Screen reader: VoiceOver (iOS), TalkBack (Android)

### Automated Testing
- [ ] Unit tests: All new components (98% coverage)
- [ ] Integration: Tab navigation, drag-drop
- [ ] E2E: Complete task flow (mobile + desktop)
- [ ] Visual regression: Chromatic snapshots
- [ ] Accessibility: axe-core, Lighthouse

---

## Design Assets Needed

- [ ] Figma mockups (all breakpoints)
- [ ] Icon set: Group headers (URGENT, DUE THIS WEEK, etc.)
- [ ] Sound effects: ding.mp3, pop.mp3
- [ ] Animation specs: Confetti, pulse, slide

**Figma Link:** (To be created)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing (98%+ coverage)
- [ ] E2E tests for critical flows
- [ ] Accessibility audit passed (axe-core)
- [ ] Visual regression tests passed
- [ ] Code review approved
- [ ] Design review approved
- [ ] QA signed off
- [ ] Documentation updated (if API changes)

---

## Estimation Summary

| Phase | Stories | Total Effort |
|-------|---------|--------------|
| Phase 1: Mobile | 3 | 11 days (M+M+S) |
| Phase 2: Cards | 4 | 6 days (S+XS+S+XS) |
| Phase 3: Grouping | 3 | 8 days (M+S+XS) |
| Phase 4: Quick Actions | 3 | 9 days (M+M+S) |
| Phase 5: Sidebar | 3 | 12 days (L+S+M) |
| Phase 6: Delight | 3 | 5 days (S+S+XS) |
| **TOTAL** | **19 stories** | **51 days** |

**Recommended Sprint Allocation:**
- Sprint N: Phase 1 (mobile-first) — **Must have**
- Sprint N+1: Phase 2 (enhanced cards) — **Should have**
- Sprint N+2: Phase 3 + 4 (grouping + quick actions) — **Nice to have**
- Sprint N+3: Phase 5 + 6 (sidebar + delight) — **Low priority**

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Mobile task completion time | N/A (broken) | <10s per task |
| Desktop task completion time | ~15s | <5s (with quick actions) |
| Mobile usability score (SUS) | N/A | >80/100 |
| User satisfaction | N/A | >4.5/5 stars |
| Overdue task awareness | ~50% | >90% notice within 5s |
| Team workload checks | Low (hidden) | >30% users check sidebar |

---

**Next Actions:**
1. ✅ Design review with PO (validate business value)
2. ⏳ Architect review (technical feasibility)
3. ⏳ Create Figma mockups
4. ⏳ Break stories into Linear issues
5. ⏳ Prioritize with team (Sprint N planning)

---

_Document maintained by: Designer Role_
_Last updated: April 3, 2026_
