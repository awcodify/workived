# Task Page Redesign — Design Document
**Designer Role** | **Date:** April 3, 2026

---

## Current State Analysis

### ✅ What's Working
- **Sticky note cards** — Playful, color-coded by priority, unique identity
- **Drag-and-drop** — Intuitive status changes
- **Team workload badges** — Quick team capacity check
- **Hand-drawn dividers** — Adds personality to the interface
- **Approval tasks highlighted** — Clear visual distinction

### ❌ UX Problems to Solve

| Problem | Impact | Current Behavior |
|---------|--------|------------------|
| **Desktop-only Kanban** | Mobile users can't see all 3 columns | 3-column grid breaks at small screens |
| **Hidden task details** | Must click every card to see due date, assignee | Only title visible on card |
| **Overwhelming when 20+ tasks** | Vertical scrolling per column is painful | No grouping/collapsing |
| **No quick actions** | Every edit requires modal open | Must open detail modal for simple changes |
| **Unclear overdue status** | Overdue tasks blend in with others | No visual urgency indicator |
| **Team workload buried** | Hidden in dropdown, hard to discover | Small badges at top, easy to miss |

---

## Redesign Solution

### 1️⃣ **Mobile-First: Tabbed Column View**

**Problem:** 3-column Kanban doesn't work on mobile (viewport <640px).

**Solution:** On mobile, show **one column at a time** with tab navigation at the top.

```
┌─────────────────────────────────────┐
│  To Do (5)  │ In Progress (3)  │ Done (12) │ ← Tabs
├─────────────────────────────────────┤
│                                     │
│  [Task Card]                        │
│  [Task Card]                        │
│  [Task Card]                        │
│                                     │
│  + Add Task                         │
│                                     │
└─────────────────────────────────────┘
```

**Interaction:**
- Tap tab → Switch column (smooth slide animation)
- Swipe left/right → Navigate between columns
- Long-press task → Quick actions menu (Move to..., Mark Done, Delete)

**CSS Implementation:**
```css
/* Mobile: Single column with tabs */
@media (max-width: 640px) {
  .kanban-board {
    display: flex;
    flex-direction: column;
  }
  
  .column-tabs {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 10;
    background: inherit;
  }
  
  .column-container {
    display: none; /* Hide non-active columns */
  }
  
  .column-container.active {
    display: flex;
  }
}

/* Desktop: 3-column grid */
@media (min-width: 641px) {
  .kanban-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }
  
  .column-tabs {
    display: none; /* Hide tabs on desktop */
  }
}
```

---

### 2️⃣ **Enhanced Task Card: Show More, Click Less**

**Problem:** Cards only show title. Must click to see assignee, due date, priority.

**Solution:** Redesigned card with:
- **Assignee avatar** (top-right corner, overlap)
- **Due date** (bottom-left, small badge)
- **Overdue badge** (red pulse animation if past due)
- **Quick actions** (hover/long-press reveals 3-dot menu)

#### **New Card Layout**

```
┌─────────────────────────────────────┐
│ [Priority Pin]          [Avatar] ◄── Always visible
│                                     │
│  Task Title Here                    │
│  (2 line truncate)                  │
│                                     │
│  📌 #leave-approvals  📅 Apr 5  ◄── Tags + Due date
│                                     │
│  [Overdue Badge]         [⋮ Menu] ◄── Only if relevant
└─────────────────────────────────────┘
```

**Visual Changes:**
- **Overdue tasks:** Gentle red pulsing border (not aggressive)
- **Due today:** Yellow left border (⚡ emoji)
- **Assignee avatar:** 32px circle, overlaps top-right corner
- **Approval tasks:** Purple tape stripe across top (maintains existing distinction)

**Component Structure:**
```tsx
<TaskCard>
  <PriorityPin color={priority} />
  <AssigneeAvatar employee={assignee} workload={workload} />
  
  <Title truncate={2}>{task.title}</Title>
  
  <CardFooter>
    <TagList tags={task.tags} max={2} />
    <DueDateBadge date={task.due_date} />
  </CardFooter>
  
  {isOverdue && <OverduePulse />}
  <QuickActionsMenu onHover />
</TaskCard>
```

---

### 3️⃣ **Smart Grouping: Reduce Visual Overload**

**Problem:** 20+ tasks in a column = endless scrolling.

**Solution:** Auto-group tasks within each column:

```
┌─────────────────────────────┐
│  To Do (18)                 │
├─────────────────────────────┤
│                             │
│  📌 URGENT (3) ──────────  ◄── Collapsible section
│    [Task Card]              │
│    [Task Card]              │
│    [Task Card]              │
│                             │
│  📅 DUE THIS WEEK (5) ────  │
│    [Task Card]              │
│    [Task Card]              │
│    [5 more...] ◀── Collapsed by default if >5
│                             │
│  💤 BACKLOG (10) ────────   │
│    [Collapsed - click to expand]
│                             │
└─────────────────────────────┘
```

**Grouping Rules:**
1. **Urgent tasks** (priority = urgent) → Always expanded
2. **Due this week** → Expanded by default
3. **No due date / >7 days away** → Collapsed by default
4. **Overdue** → Separate group at top, always expanded

**User Preference:**
- Remember collapse/expand state per group (localStorage)
- "Expand All" / "Collapse All" button in column header

---

### 4️⃣ **Quick Actions: Inline Editing**

**Problem:** Opening modal for simple changes (reassign, change due date, mark done) is slow.

**Solution:** Right-click or long-press → Context menu with:

```
┌─────────────────────────┐
│ ✓ Mark as Done          │
│ → Move to In Progress   │
│ 👤 Reassign...          │
│ 📅 Change Due Date...   │
│ 🗑️ Delete               │
│ ─────────────────────   │
│ 🔍 View Full Details    │
└─────────────────────────┘
```

**Keyboard Shortcuts:**
- `D` → Mark done
- `M` → Move to... (opens submenu)
- `E` → Edit (opens modal)
- `Backspace` → Delete (with confirmation)

**Implementation Notes:**
- Use Radix UI ContextMenu component
- Respect accessibility (focus trap, ESC to close)
- Show keyboard hints on hover

---

### 5️⃣ **Team Workload: Persistent Sidebar**

**Problem:** Workload badges are hidden in dropdown, easy to miss.

**Solution:** On desktop (>1024px), show **persistent right sidebar** with live team status:

```
Desktop Layout (>1024px):
┌──────────────────────────────────────────────────┐
│  Header                                          │
├────────────────────────────────┬─────────────────┤
│                                │  TEAM STATUS    │
│  [To Do] [In Progress] [Done]  │  ─────────────  │
│                                │  😊 3 available │
│  [Task Cards...]               │  ⚡ 2 busy      │
│                                │  🔥 1 overload  │
│                                │  ✈️ 1 on leave  │
│                                │                 │
│                                │  [Employee 1]   │
│                                │  [Employee 2]   │
│                                │  [Employee 3]   │
│                                │  ...            │
└────────────────────────────────┴─────────────────┘
```

**Sidebar Features:**
- **Status summary** at top (same badges as current)
- **Employee list** below (sorted by workload)
- Each employee shows:
  - Avatar + name
  - Task count (e.g., "3 tasks")
  - Workload indicator (green/yellow/red dot)
  - Hover → Quick preview of their tasks
- Click employee → Filter tasks to show only theirs
- Collapsible (minimize to icon bar if user wants more space)

**Mobile (<1024px):**
- Sidebar hidden by default
- Access via floating button (bottom-right)
- Opens as bottom sheet (slides up)

---

### 6️⃣ **Celebration Moments: Task Completion**

**Problem:** Marking a task done feels mechanical. No dopamine hit.

**Solution:** When dragging to "Done" or clicking "Mark as Done":
1. **Confetti burst** (brief, 0.8s duration)
2. **Card transforms** → Shrinks and fades into column
3. **Sound effect** (optional, user can disable) — soft "ding"
4. **Streak counter** (if completing 3+ tasks in one session) — "🔥 You're on fire! 5 tasks done today"

**Implementation:**
- Use `canvas-confetti` library (lightweight)
- Respect `prefers-reduced-motion` (no animation if user has accessibility settings)
- Store completion count in session (reset daily)
- Show encouraging messages:
  - 3 tasks: "Great start! 🎉"
  - 5 tasks: "You're on fire! 🔥"
  - 10 tasks: "Productivity machine! 💪"

---

## Visual Design Specifications

### Typography
- **Column headers:** Permanent Marker (existing), 20px, letter-spacing: 1px
- **Task titles:** Inter (system font), 14px, weight: 500, line-height: 1.4
- **Task metadata:** Inter, 12px, weight: 400, color: rgba(0,0,0,0.6)
- **Section headers (groups):** Inter, 11px, weight: 700, uppercase, letter-spacing: 0.5px

### Spacing
- **Column gap:** 2rem (desktop), 0 (mobile)
- **Card gap:** 8px (vertical)
- **Card padding:** 16px (all sides)
- **Card corner radius:** 4px (sticky note style)

### Colors (from tokens.ts)
- **Module background:** `moduleBackgrounds.tasks` (#F5F5F0)
- **Priority pins:**
  - Urgent: #FF9999 (pink/red)
  - High: #B19CD9 (purple)
  - Medium: #99EBFF (cyan)
  - Low: #FFE066 (yellow)
- **Overdue border:** #EF4444 (pulse animation)
- **Due today badge:** #F59E0B (yellow/amber)

### Animations
- **Card drag:** `rotate(${rotation + 2}deg) scale(1.05)` (maintain existing)
- **Column switch (mobile):** `transform: translateX()` + `transition: 0.3s ease-out`
- **Overdue pulse:** 
  ```css
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  }
  ```

---

## Component Architecture

### New Components to Create

```
apps/web/src/components/tasks/
├── TaskCard.tsx               (refactor existing, add footer)
├── TaskCardFooter.tsx         (tags + due date badge)
├── TaskQuickActions.tsx       (context menu)
├── TaskGroupSection.tsx       (collapsible group)
├── ColumnTabNav.tsx           (mobile tabs)
├── TeamWorkloadSidebar.tsx    (desktop sidebar)
├── TeamWorkloadSheet.tsx      (mobile bottom sheet)
├── EmployeeWorkloadItem.tsx   (sidebar list item)
├── CompletionCelebration.tsx  (confetti + streak)
└── OverdueBadge.tsx           (red pulse)
```

### Updated Components

- **StatusColumn** (route.tsx)
  - Add grouping logic
  - Add expand/collapse state
  - Responsive: hide on mobile if not active tab
  
- **TasksPage** (route.tsx)
  - Add mobile tab state
  - Add sidebar toggle state
  - Add completion celebration trigger

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` | **Mobile:** Single column, tab navigation, bottom sheet for team |
| `640px - 1024px` | **Tablet:** 2 columns side-by-side, team badges in header (existing) |
| `> 1024px` | **Desktop:** 3 columns + persistent sidebar |

---

## Accessibility Checklist

- [ ] Keyboard navigation for all actions (tab, arrow keys, shortcuts)
- [ ] Focus indicators on all interactive elements
- [ ] ARIA labels for icon buttons
- [ ] Screen reader announces drag-drop state changes
- [ ] Respect `prefers-reduced-motion` (disable animations)
- [ ] Sufficient color contrast (WCAG AA minimum)
- [ ] Touch targets ≥44px on mobile

---

## Implementation Priority (Sprints)

### Phase 1: Mobile Responsiveness (Sprint N)
- Column tab navigation
- Mobile-friendly card layout
- Bottom sheet team view
- Touch gestures (swipe between columns)

### Phase 2: Enhanced Cards (Sprint N+1)
- Assignee avatar overlay
- Due date badge
- Overdue indicator
- Tag display

### Phase 3: Smart Grouping (Sprint N+2)
- Auto-group by urgency/due date
- Collapse/expand sections
- Persist user preferences

### Phase 4: Quick Actions (Sprint N+3)
- Context menu
- Inline editing
- Keyboard shortcuts
- Bulk actions

### Phase 5: Team Sidebar (Sprint N+4)
- Desktop persistent sidebar
- Employee filter
- Workload details
- Task preview on hover

### Phase 6: Delight (Sprint N+5)
- Completion celebration
- Streak counter
- Sound effects (optional)
- Micro-interactions polish

---

## Design Tokens Usage

All colors reference `design/tokens.ts`:

```tsx
import { moduleBackgrounds, typography, colors } from '@/design/tokens'

// Module background
style={{ background: moduleBackgrounds.tasks }}

// Typography
style={{ 
  fontFamily: typography.fontFamily,
  fontSize: typography.body.size,
}}

// Colors
style={{ 
  color: colors.ink700,
  borderColor: colors.ink150,
}}
```

**No hardcoded colors allowed.** If a new color is needed, add it to tokens.ts first.

---

## Figma Mockups (To Be Created)

- [ ] Mobile: Tab navigation flow
- [ ] Desktop: 3-column + sidebar layout
- [ ] Task card: All states (normal, hover, overdue, dragging)
- [ ] Quick actions menu
- [ ] Team sidebar (expanded/collapsed)
- [ ] Completion celebration animation

**Figma Link:** (To be added after mockups created)

---

## User Testing Plan

### Test Scenarios
1. **Mobile task management:** Can users switch columns and move tasks easily?
2. **Quick actions discovery:** Do users find the context menu intuitive?
3. **Overdue awareness:** Do users notice overdue tasks quickly?
4. **Team workload usage:** Do users check team status before assigning?
5. **Completion satisfaction:** Does the celebration feel rewarding or annoying?

### Success Metrics
- Task completion time (target: <10s for simple edits)
- Mobile usability score (target: >80 SUS score)
- Overdue task awareness (target: 90% notice within 5s)
- User satisfaction (target: 4.5/5 stars)

---

## Open Questions for Discussion

1. **Grouping behavior:** Should we allow custom groups (e.g., "Marketing tasks", "Bug fixes")?
2. **Sidebar position:** Right side (as proposed) or left side?
3. **Default collapsed state:** Should "Backlog" be collapsed by default?
4. **Celebration opt-out:** Global setting or per-completion?
5. **Mobile gestures:** Swipe to complete (like email apps)?

---

## Design Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-04-03 | Mobile: Tabs over horizontal scroll | Horizontal scrolling loses context; tabs keep spatial model clear |
| 2026-04-03 | Keep sticky note aesthetic | Core brand differentiator; users love it |
| 2026-04-03 | Auto-group by urgency + due date | Reduces cognitive load for large task lists |
| 2026-04-03 | Sidebar on desktop only | Mobile needs full screen for task cards |
| 2026-04-03 | Confetti for completion | Positive reinforcement increases engagement |

---

**Next Steps:**
1. Review with PO (validate business value)
2. Review with Architect (technical feasibility)
3. Create Figma mockups
4. Break down into implementable stories
5. Move to Linear for sprint planning

---

_Document maintained by: Designer Role_
_Last updated: April 3, 2026_
