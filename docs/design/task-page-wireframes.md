# Task Page Redesign — Wireframes
**Visual Layout Reference**

---

## 1. Desktop Layout (>1024px) — Current View

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  Header                                                                   [DateTime] [🔔]    │
│  ════════════════════════════════════════════════════════════════════════════════════════════│
│  Tasks                                                                                       │
│  18 total · 5 in progress · 12 done                                                        │
│                                                                                              │
│  Team (7)  [😊 3] [⚡ 2] [🔥 1] [✈️ 1]     [All|Tasks|Approvals]  [🔍Search] [Filters]     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┬────────────────────────────────┬──────────────────────────┐
│  To Do (5)         [+ Add]     │  In Progress (3)    [+ Add]    │  Done (12) ✓  [+ Add]   │
│  ════════                      │  ════════════                  │  ══════                  │
│                                │                                │                          │
│  ┌──────────────────────────┐ │  ┌──────────────────────────┐ │  ┌────────────────────┐ │
│  │ 📌  Fix login bug  [@]   │ │  │ 📌  Design homepage [@]  │ │  │ [Completed tasks]  │ │
│  │                          │ │  │                          │ │  │ (collapsed)        │ │
│  │ #urgent-bug              │ │  │ #product                 │ │  │                    │ │
│  │ 📅 Apr 5 (overdue) ⚠️    │ │  │ 📅 Apr 8                 │ │  │ [Show all 12...]   │ │
│  │                     [⋮]  │ │  │                     [⋮]  │ │  │                    │ │
│  └──────────────────────────┘ │  └──────────────────────────┘ │  └────────────────────┘ │
│                                │                                │                          │
│  ┌──────────────────────────┐ │  ┌──────────────────────────┐ │                          │
│  │ 📌  Write docs      [@]  │ │  │ 📌  Code review     [@]  │ │                          │
│  │                          │ │  │                          │ │                          │
│  │ #documentation           │ │  │ #development             │ │                          │
│  │ 📅 Apr 10                │ │  │ 📅 Apr 6                 │ │                          │
│  │                     [⋮]  │ │  │                     [⋮]  │ │                          │
│  └──────────────────────────┘ │  └──────────────────────────┘ │                          │
│                                │                                │                          │
│  [+ Add task...]               │  [+ Add task...]               │                          │
│                                │                                │                          │
└────────────────────────────────┴────────────────────────────────┴──────────────────────────┘
```

---

## 2. Desktop with Team Sidebar (>1024px) — REDESIGNED

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Tasks                                                            [DateTime] [🔔]             │
│  18 total · 5 in progress · 12 done                                                          │
│                                                                                               │
│  [All|Tasks|Approvals]  [🔍Search] [Filters]                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┬───────────────────────┐
│                                                                      │  TEAM STATUS          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  ══════════════       │
│  │ To Do (5)    │  │ In Progress  │  │ Done (12) ✓  │             │                       │
│  │    [+ Add]   │  │    (3)       │  │    [+ Add]   │             │  😊 3 available       │
│  └──────────────┘  │    [+ Add]   │  └──────────────┘             │  ⚡ 2 busy            │
│                    └──────────────┘                                │  🔥 1 overloaded      │
│  📌 URGENT (1)                                                      │  ✈️ 1 on leave        │
│  ──────────────                                                     │  ─────────────────    │
│  ┌──────────────────────────┐                                      │                       │
│  │ 📌 Fix bug          [@]  │                                      │  ┌─────────────────┐ │
│  │ #urgent                  │                                      │  │ • Sarah Chen    │ │
│  │ 📅 Apr 5 ⚠️ OVERDUE      │                                      │  │   ⚡ 3 tasks    │ │
│  │                     [⋮]  │                                      │  │   busy          │ │
│  └──────────────────────────┘                                      │  └─────────────────┘ │
│                                                                      │                       │
│  📅 DUE THIS WEEK (3)                                               │  ┌─────────────────┐ │
│  ──────────────────────                                             │  │ • Ali Rahman    │ │
│  ┌──────────────────────────┐                                      │  │   😊 1 task     │ │
│  │ 📌 Write docs       [@]  │                                      │  │   available     │ │
│  │ #documentation           │                                      │  └─────────────────┘ │
│  │ 📅 Apr 10                │                                      │                       │
│  │                     [⋮]  │                                      │  ┌─────────────────┐ │
│  └──────────────────────────┘                                      │  │ • Maya Patel    │ │
│                                                                      │  │   😊 2 tasks    │ │
│  💤 BACKLOG (1)                                                     │  │   available     │ │
│  ────────────────                                                   │  └─────────────────┘ │
│  [Click to expand...]                                               │                       │
│                                                                      │  ┌─────────────────┐ │
│  [+ Add task...]                                                    │  │ • Fatima Ahmed  │ │
│                                                                      │  │   ✈️ On leave   │ │
└─────────────────────────────────────────────────────────────────────┤  │   Until Apr 10  │ │
                                                                       │  └─────────────────┘ │
                                                                       │                       │
                                                                       │  [🔽 Minimize]        │
                                                                       └───────────────────────┘
```

**Key Changes:**
- ✅ Persistent team sidebar on right (collapsible)
- ✅ Tasks auto-grouped by urgency/due date
- ✅ Overdue badge clearly visible
- ✅ Each employee shows workload status
- ✅ Click employee → Filter tasks

---

## 3. Tablet Layout (640px - 1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│  Tasks                                   [DateTime] [🔔]        │
│  18 total · 5 in progress · 12 done                            │
│                                                                 │
│  Team: [😊 3] [⚡ 2] [🔥 1] [✈️ 1]   [All|Tasks|Approvals]     │
│  [🔍Search] [Filters]                                           │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┬────────────────────────────────┐
│  To Do (5)         [+ Add]     │  In Progress (3)    [+ Add]    │
│  ════════                      │  ════════════                  │
│                                │                                │
│  📌 URGENT (1)                 │  ┌──────────────────────────┐ │
│  ┌──────────────────────────┐ │  │ Design homepage     [@]  │ │
│  │ Fix bug             [@]  │ │  │ #product                 │ │
│  │ 📅 Apr 5 ⚠️ OVERDUE      │ │  │ 📅 Apr 8                 │ │
│  └──────────────────────────┘ │  └──────────────────────────┘ │
│                                │                                │
│  📅 DUE THIS WEEK (3)          │  ┌──────────────────────────┐ │
│  ┌──────────────────────────┐ │  │ Code review         [@]  │ │
│  │ Write docs          [@]  │ │  │ #development             │ │
│  │ 📅 Apr 10                │ │  │ 📅 Apr 6                 │ │
│  └──────────────────────────┘ │  └──────────────────────────┘ │
│                                │                                │
│  [+ Add task...]               │  [+ Add task...]               │
└────────────────────────────────┴────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Done (12) ✓                                    [+ Add]        │
│  ══════                                                        │
│                                                                │
│  [Collapsed - Click to show 12 completed tasks]               │
└────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ 2 columns side-by-side (To Do + In Progress)
- ✅ Done column wraps to full width below
- ✅ Team badges in header (no sidebar)

---

## 4. Mobile Layout (<640px) — REDESIGNED

### Tab 1: To Do Column

```
┌──────────────────────────────────────┐
│  Tasks              [🔔] [Team 👥]   │
│  18 total · 5 in progress · 12 done │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ┏━━━━━━━┓ ┌─────────┐ ┌──────────┐  │
│ ┃ To Do ┃ │ Progress│ │   Done   │  │ ← Tabs
│ ┗━━━━━━━┛ └─────────┘ └──────────┘  │
│        5        3           12       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  [🔍 Search tasks...]     [Filters]  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  📌 URGENT (1)                       │
│  ──────────────                      │
│  ┌────────────────────────────────┐ │
│  │ 📌  Fix login bug              │ │
│  │                           [@]  │ │
│  │ #urgent-bug                    │ │
│  │ 📅 Apr 5  ⚠️ OVERDUE           │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  📅 DUE THIS WEEK (3)                │
│  ─────────────────────               │
│  ┌────────────────────────────────┐ │
│  │ 📌  Write documentation        │ │
│  │                           [@]  │ │
│  │ #documentation                 │ │
│  │ 📅 Apr 10                      │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 📌  Update CI/CD pipeline      │ │
│  │                           [@]  │ │
│  │ #infra                         │ │
│  │ 📅 Apr 8                       │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  💤 BACKLOG (1)                     │
│  ────────────                        │
│  [Collapsed - Tap to expand]        │
│                                      │
│  ┌────────────────────────────────┐ │
│  │     + Add new task...          │ │
│  └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘

Swipe left → or tap "Progress" tab →
```

### Tab 2: In Progress Column (after swipe)

```
┌──────────────────────────────────────┐
│  Tasks              [🔔] [Team 👥]   │
│  18 total · 5 in progress · 12 done │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ┌─────────┐ ┏━━━━━━━━━┓ ┌──────────┐│
│ │  To Do  │ ┃ Progress┃ │   Done   ││
│ └─────────┘ ┗━━━━━━━━━┛ └──────────┘│
│      5            3           12     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  [🔍 Search tasks...]     [Filters]  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ┌────────────────────────────────┐ │
│  │ 📌  Design new homepage        │ │
│  │                           [@]  │ │
│  │ #product                       │ │
│  │ 📅 Apr 8                       │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 📌  Code review: PR #234       │ │
│  │                           [@]  │ │
│  │ #development                   │ │
│  │ 📅 Apr 6                       │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 📌  Test payment flow          │ │
│  │                           [@]  │ │
│  │ #qa                            │ │
│  │ 📅 Apr 7                       │ │
│  │                          [⋮]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │     + Add new task...          │ │
│  └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘

← Swipe right    Swipe left → or tap "Done"
```

---

## 5. Mobile: Team Workload Bottom Sheet

**Trigger:** Tap "Team 👥" button in header

```
┌──────────────────────────────────────┐
│  Tasks view continues above...      │
│  (50% dimmed overlay)                │
│                                      │
│                                      │
└──────────────────────────────────────┘
        ⬆️ Bottom sheet slides up

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ══════  (drag handle)              ┃
┃                                      ┃
┃  TEAM STATUS                    [✕] ┃
┃  ════════════                        ┃
┃                                      ┃
┃  😊 3 available                      ┃
┃  ⚡ 2 busy                           ┃
┃  🔥 1 overloaded                     ┃
┃  ✈️ 1 on leave                       ┃
┃  ───────────────────────────────     ┃
┃                                      ┃
┃  ┌────────────────────────────────┐ ┃
┃  │ • Sarah Chen                   │ ┃
┃  │   ⚡ 3 tasks · busy             │ ┃
┃  └────────────────────────────────┘ ┃
┃                                      ┃
┃  ┌────────────────────────────────┐ ┃
┃  │ • Ali Rahman                   │ ┃
┃  │   😊 1 task · available        │ ┃
┃  └────────────────────────────────┘ ┃
┃                                      ┃
┃  ┌────────────────────────────────┐ ┃
┃  │ • Maya Patel                   │ ┃
┃  │   😊 2 tasks · available       │ ┃
┃  └────────────────────────────────┘ ┃
┃                                      ┃
┃  ┌────────────────────────────────┐ ┃
┃  │ • Fatima Ahmed                 │ ┃
┃  │   ✈️ On leave until Apr 10     │ ┃
┃  └────────────────────────────────┘ ┃
┃                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

(Swipe down or tap X to close)
```

---

## 6. Task Card: Quick Actions Menu

**Desktop: Right-click or hover [⋮]**
**Mobile: Long-press card**

```
┌────────────────────────────────┐
│ 📌  Fix login bug         [@]  │
│                                │
│ #urgent-bug                    │
│ 📅 Apr 5  ⚠️ OVERDUE           │
│                          [⋮]   │ ← Click/Long-press
└────────────────────────────────┘
              ↓
   ┌─────────────────────────┐
   │ ✓ Mark as Done          │
   │ → Move to In Progress   │
   │ 👤 Reassign...          │
   │ 📅 Change Due Date...   │
   │ ─────────────────────   │
   │ 🗑️ Delete               │
   │ ─────────────────────   │
   │ 🔍 View Full Details    │
   └─────────────────────────┘
```

---

## 7. Completion Celebration

**When task moved to "Done" or marked complete:**

```
┌────────────────────────────────────────┐
│                                        │
│         ✨ 🎉 ✨                       │
│            🎊                         │
│       ┌──────────────┐                │
│       │  TASK DONE!  │                │
│       └──────────────┘                │
│         ✨ 🎉 ✨                       │
│                                        │
│     🔥 You're on fire!                │
│     5 tasks completed today           │
│                                        │
└────────────────────────────────────────┘
```

**Animation:**
1. Confetti bursts from center (0.8s)
2. Task card shrinks and fades (0.5s)
3. Streak message appears (if >3 tasks)
4. Auto-dismiss after 2s (or tap to dismiss)

---

## 8. Task Card States Reference

### Normal State
```
┌────────────────────────────────┐
│ 📌              [@Sarah]       │ ← Priority pin + avatar
│                                │
│  Fix login authentication      │ ← Title (bold, 14px)
│  issue on Safari browser       │    (2-line truncate)
│                                │
│  #urgent-bug · 📅 Apr 5        │ ← Tag + due date
│                          [⋮]   │ ← Quick actions
└────────────────────────────────┘
```

### Overdue State
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ← Red pulsing border
┃ 📌              [@Sarah]       ┃
┃                                ┃
┃  Fix login authentication      ┃
┃  issue on Safari browser       ┃
┃                                ┃
┃  #urgent · 📅 Apr 5 ⚠️ OVERDUE ┃ ← Red badge
┃                          [⋮]   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Due Today State
```
┌────────────────────────────────┐
│ 📌              [@Sarah]       │
│ ║                              │ ← Yellow left border
│ ║ Review marketing proposal    │
│ ║                              │
│ ║ #product · ⚡ 📅 Due today   │ ← Lightning emoji
│ ║                        [⋮]   │
└────────────────────────────────┘
```

### Approval Task State
```
┌────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Purple tape stripe
│ 📌              [@You]         │
│                                │
│  Approve: Ali's leave request  │
│  (June 15-20)                  │
│                                │
│  [Approve] [Reject]            │ ← Action buttons
│  #leave-approval · 📅 Today    │
│                          [⋮]   │
└────────────────────────────────┘
```

### Completed State
```
┌────────────────────────────────┐
│ ✓                [@Sarah]      │ ← Checkmark instead of pin
│                                │
│  Fix login authentication      │ ← Grayed out
│  issue on Safari browser       │    (50% opacity)
│                                │
│  #urgent · ✓ Done Apr 5        │
│                          [⋮]   │
└────────────────────────────────┘
```

### Dragging State
```
    ┌────────────────────────────────┐
   ╱│ 📌              [@Sarah]       │╲  ← Rotated + shadow
  │ │                                │ │
  │ │  Fix login authentication      │ │
  │ │  issue on Safari browser       │ │
  │ │                                │ │
  │ │  #urgent · 📅 Apr 5            │ │
   ╲│                          [⋮]   │╱
    └────────────────────────────────┘
          (Lifted 3D effect)
```

---

## Color Reference (from design/tokens.ts)

### Priority Colors
- **Urgent:** #FF9999 (pink/red) — text: #5C1A1A
- **High:** #B19CD9 (purple) — text: #3D2A56
- **Medium:** #99EBFF (cyan) — text: #0D4552
- **Low:** #FFE066 (yellow) — text: #5C4D00

### Status Colors
- **Overdue:** #EF4444 (red) — border + pulse
- **Due today:** #F59E0B (amber/yellow) — left border
- **Completed:** #D5DBDB (gray) — card background

### Workload Status
- **Available:** #10B981 (green) — 😊
- **Busy:** #F59E0B (amber) — ⚡
- **Overloaded:** #EF4444 (red) — 🔥
- **On leave:** #8B5CF6 (purple) — ✈️

---

## Responsive Behavior Summary

| Screen Size | Columns | Team | Grouping | Gestures |
|-------------|---------|------|----------|----------|
| Mobile (<640px) | 1 (tabs) | Bottom sheet | Yes | Swipe, long-press |
| Tablet (640-1024px) | 2 + 1 wrap | Header badges | Yes | Click, hover |
| Desktop (>1024px) | 3 | Right sidebar | Yes | Click, hover, drag |

---

## Interaction Patterns

### On Mobile
- **Switch columns:** Tap tabs or swipe left/right
- **Open task:** Tap card
- **Quick actions:** Long-press card (0.5s)
- **View team:** Tap "Team 👥" button → bottom sheet
- **Close sheet:** Swipe down or tap X

### On Tablet/Desktop
- **Open task:** Click card
- **Quick actions:** Right-click card or click [⋮]
- **Drag task:** Click + hold + drag to column
- **Filter by person:** Click employee in sidebar
- **Collapse section:** Click section header

---

**Next:** Create Figma mockups based on these wireframes
**Reference:** All measurements follow `design/tokens.ts` spacing scale
