# Workived — Screen Specifications

All screens use Plus Jakarta Sans. Import tokens from `apps/web/design/tokens.ts`.

---

## Navigation — Floating Dock

**Concept:** No top nav, no sidebar. A floating dock sits at the bottom of every screen.
The dock colour adapts to the current module background.

**Modules in dock order:**
1. Overview (grid icon)
2. People (person icon)
3. Attendance (clock icon)
4. Leave (calendar icon)
5. Claims (chart line icon)
6. Tasks (checkmark icon)

**Dock behaviour:**
- Background, border, icon, and label colours all change per module — see `tokens.dockThemes`
- Active item has a slightly brighter background
- Workived logo appears top-left of every module screen

**Logo mark:**
- 28×28px rounded square (border-radius 8px)
- Background and square colours change per module — see `tokens.logoMarkColors`
- 4 squares in a 2×2 grid with decreasing opacity: 100%, 55%, 55%, 25%
- Logo text: "Work" in module primary colour, "ived" in module accent colour

---

## Screen 1 — Overview

**Background:** `#0C0C0F` (deep violet night)

**Layout (top to bottom):**

### Logo bar
- Workived logo mark + text top-left
- No other nav elements

### Greeting
- Label: "MONDAY · 16 MARCH 2026" — 11px, 600 weight, rgba(255,255,255,0.3), uppercase, letter-spacing 0.12em
- Heading: "Good morning," + newline + "[Name] 👋" — 44px, 800 weight, white. Name in `#9B8FF7`
- Live clock below: 13px monospace, rgba(255,255,255,0.22)

### Metrics strip
- 4 columns, gap 2px, no outer radius except first/last corners rounded 16px
- Each metric: padding 26px 24px, background rgba(255,255,255,0.03), border rgba(255,255,255,0.06)
- Metric number: 46px, 800 weight, coloured (purple/coral/teal/amber per meaning)
- Label: 11px, 600 weight, rgba(255,255,255,0.3), uppercase, letter-spacing 0.06em
- Delta: 12px, 500 weight, coloured

### Activity feed
- Section label: 11px, 700 weight, rgba(255,255,255,0.25), uppercase, letter-spacing 0.1em
- Each item: icon square (36×36, border-radius 10px, coloured bg) + text + timestamp
- Text: 13px, rgba(255,255,255,0.6). Name bold in white.
- Timestamp: 11px monospace, rgba(255,255,255,0.2)
- Divider between items: 1px rgba(255,255,255,0.05)

---

## Screen 2 — People

**Background:** `#F5F0E8` (warm cream)

**Layout:**

### Header row
- Title: "People" — 44px, 800 weight, `#1A1208`, tracking -0.05em
- Subtitle: "52 employees across 6 departments" — 14px, `#9C8B6E`
- "+ Add employee" button — top right, `#1A1208` bg, `#F5F0E8` text, border-radius 12px

### Employee card grid
- 3 columns, gap 12px
- Each card: white bg, border-radius 16px, border 1px rgba(26,18,8,0.06), padding 22px
- Hover: translateY(-2px) + box-shadow

**Card contents:**
- Avatar: 44×44px, border-radius 12px, coloured bg with initials (800 weight)
- Name: 15px, 700 weight, `#1A1208`, tracking -0.02em
- Role: 12px, `#9C8B6E`
- Footer row: department tag (left) + status indicator (right)

**Department tag:**
- 11px, 600 weight, `#9C8B6E`, background `#F5F0E8`, padding 3px 9px, border-radius 6px

**Status indicator — small coloured square:**
- 7×7px square, border-radius 2px (NOT a pill)
- Colour from `tokens.statusConfig`
- Text: 12px, 600 weight, same colour as square
- Never use background containers or pill shapes for status

**Last card — "+ Add employee" placeholder:**
- Same card dimensions, dashed border 1.5px rgba(26,18,8,0.12)
- Centred plus icon + "Add employee" text in `#9C8B6E`

---

## Screen 3 — Attendance

**Background:** `#E8F5EE` (fresh green)

**Layout:**

### Header
- Title: "Attendance" — 44px, 800 weight, `#0A2E1A`
- Subtitle: date string, 14px, `#4A7A5A`

### Live time block (hero card)
- Background: `#0A2E1A` (deep dark green), border-radius 20px, padding 30px 34px
- Contents in a horizontal row with separators:
  - Live time: 56px, 800 weight, white, monospace font — ticks every second
  - Separator: 1px × 64px, rgba(255,255,255,0.12)
  - Stat clusters: number (30px, 800) + label (11px, uppercase, rgba(255,255,255,0.35))
  - Numbers: clocked-in green, late amber, on-leave grey, absent red

### Attendance list
- Column headers: 10px, 700 weight, `#4A7A5A`, uppercase, letter-spacing 0.08em
- Columns: Employee | Clock in | Hours | Status
- Each row: white bg, border-radius 12px, margin-bottom 3px, padding 14px 20px
- Row hover: `#F0FAF4`
- No borders between rows — spacing creates separation

**Row contents:**
- Avatar: 32×32px, border-radius 9px
- Name: 13px, 600 weight, `#0A2E1A`
- Dept: 11px, `#4A7A5A`
- Time: 13px, monospace, `#4A7A5A`
- Status: small square (7×7, border-radius 2px) + 12px 600 weight text

---

## Screen 4 — Tasks (Kanban)

**Background:** `#FDF4E3` (warm amber)

**Layout:**

### Header row
- Title: "Tasks" — 44px, 800 weight, `#2A1800`
- "+ New task" button — `#2A1800` bg, `#FDF4E3` text

### Pro nudge banner (free tier only)
- White bg, border-radius 12px, subtle violet border
- Small star icon in `#EFEDFD` square
- Text: "Pro: subtasks, dependencies, time tracking and Gantt view"
- "Upgrade →" button in `#6357E8`

### Kanban columns (3 visible: To do, In progress, Done)
- 3 equal columns, gap 14px

**Column header:**
- 3px × 18px coloured bar (border-radius 2px)
- Column title: 11px, 700 weight, uppercase, letter-spacing 0.07em, `#8C6A30`
- Count: 12px, 700 weight, `#C49040`

**Task card:**
- White bg, border-radius 14px, border 1px rgba(42,24,0,0.06), padding 16px
- Hover: translateY(-1px)
- Title: 13px, 600 weight, `#2A1800`, line-height 1.45
- Priority: small coloured square (6×6, border-radius 1px) + 11px 700 weight text
- Department tag: 11px, 600 weight, `#C49040`, `#FDF4E3` bg, padding 2px 8px, border-radius 5px
- Footer (separated by top border): assignee avatar (22×22, border-radius 6px) + due date right-aligned

**Done column:** cards at 40% opacity, title has text-decoration: line-through

---

## Screen 5 — People List (table view)

**Background:** `#F3F2FB`

**Layout:**

### Stats strip
- 4 cards, `#FFFFFF` bg, border-radius 12px, border 1px rgba(99,87,232,0.08)
- Label: 10px, 600 weight, `#B0AEBE`, uppercase
- Number: 22px, 600 weight, coloured

### Filter row
- Search input with search icon prefix
- Filter pill buttons: active = `#1F1D2B` bg / white text, inactive = white bg / `#72708A` text
- Sort dropdown right-aligned

### Employee table
- White bg card, border-radius 14px
- Table header: 10px, 600 weight, `#B0AEBE`, uppercase, background `#FAFAFD`
- Rows: NO borders between rows — only top border on hover (rgba(99,87,232,0.04) bg)
- Employee cell: avatar (32×32, border-radius 10px) + name (13px, 500) + employee code (11px monospace, `#B0AEBE`)
- Status: small square (7×7, border-radius 2px) + 12px 500 weight text
- Type: plain 11px, 500 weight, `#B0AEBE` — no background
- Action: "→" in `#B0AEBE`, hover turns `#6357E8`

### Pagination
- Info text left: "Showing 1–8 of 52 employees" — 12px, `#B0AEBE`
- Page buttons right: 30×30px, border-radius 7px, border 1.5px rgba(99,87,232,0.15)
- Active page: `#1F1D2B` bg, white text

---

## Screen 6 — Claims

**Background:** `#F3F2FB`

**Two-column layout:**

### Left — Claims list
Same table pattern as People list.
Status column uses small coloured squares.
Amount column: 13px, 600 weight, monospace, `#0F0E13`

Filter tabs above table (All / Pending / Approved / Rejected) — minimal, no pill shapes:
- Active tab: `#1F1D2B` text, background `#F3F2FB`
- Inactive tab: `#B0AEBE` text

### Right — Submit claim panel
- White card, border-radius 14px, padding 20px
- All form inputs: background `#FAFAFD`, border 1.5px rgba(99,87,232,0.15), border-radius 9px
- Focus: border `#6357E8`, box-shadow 0 0 0 3px rgba(99,87,232,0.1)
- Receipt upload: dashed border zone, upload icon in `#EFEDFD` square, hover darkens border to `#6357E8`
- Submit button: `#1F1D2B` bg, white text, full width, border-radius 10px
- Approver note: 11px, `#B0AEBE`, centre-aligned

---

## Screen 7 — Leave

**Background:** `#F3F2FB` (soft violet)

**Layout:**

### Header row
- Title: "Leave" — 44px, 800 weight, `#0F0E13`, tracking -0.05em
- Subtitle: "March 2026" — 14px, `#72708A`
- "+ Request leave" button — top right, `#1F1D2B` bg, white text, border-radius 12px

### Balance strip
- 4 cards, white bg, border-radius 12px, border 1px rgba(99,87,232,0.08), padding 18px 20px
- Label: 10px, 600 weight, `#B0AEBE`, uppercase, letter-spacing 0.06em
- Available days: 22px, 700 weight, `#0F0E13`
- Used / total: 12px, `#B0AEBE` — e.g. "3 used · 12 total"
- Leave types: Annual, Sick, Public Holiday, Unpaid

### Filter tabs
- Minimal tabs: All / Pending / Approved / Rejected
- Active: `#1F1D2B` text, `#EDECF4` background, border-radius 7px
- Inactive: `#B0AEBE` text, no background
- No pill shapes, no underlines

### Leave request table
- White bg card, border-radius 14px
- Table header: 10px, 600 weight, `#B0AEBE`, uppercase, background `#FAFAFD`
- Columns: Employee | Type | Dates | Duration | Status | Action
- Rows: NO borders — spacing separates. Hover: rgba(99,87,232,0.03) bg
- Employee cell: avatar (32×32, border-radius 10px) + name (13px, 500 weight) + department (11px, `#B0AEBE`)
- Type: 13px, 500 weight, `#0F0E13`
- Dates: 13px monospace, `#72708A`
- Duration: 13px, 600 weight, `#0F0E13` — "3 days"
- Status: small square (7×7, border-radius 2px) + 12px 500 weight text (pending/approved/rejected)
- Action: "→" in `#B0AEBE`, hover turns `#6357E8`

### Request Leave drawer (slides in from right)
See **Drawers & Modals** section below.

---

## Screen 8 — Employee Detail (`/people/[id]`)

**Background:** `#F5F0E8` (warm cream) — same module as People

**Layout (two columns on desktop, stacked on mobile):**

### Left column — identity card (sticky)
- White card, border-radius 16px, border 1px rgba(26,18,8,0.06), padding 28px
- Avatar: 72×72px, border-radius 14px
- Name: 22px, 700 weight, `#1A1208`, tracking -0.03em
- Role + department: 14px, `#9C8B6E`
- Status square below role
- Divider: 1px rgba(26,18,8,0.06), margin 18px 0
- Detail rows (label + value pairs):
  - Label: 11px, 600 weight, `#9C8B6E`, uppercase, letter-spacing 0.05em
  - Value: 13px, 500 weight, `#1A1208`
  - Fields: Employee ID, Email, Phone, Start date, Employment type, Contract end (if applicable)
- Edit button: full width, outlined, `#1A1208` border, border-radius 10px, 13px 600 weight

### Right column — tabbed content
**Tabs:** Overview · Leave · Claims · Documents · Activity
- Active tab: `#1A1208` text, background white, border-radius 8px
- Inactive: `#9C8B6E`
- Tab bar: `#F5F0E8` background, padding 4px, border-radius 10px, no borders

**Overview tab:**
- 3 stat cards (white, border-radius 12px): Days absent / Leave balance / Open claims
- Recent activity feed — same pattern as Overview screen but on warm cream bg

**Leave tab:**
- Balance strip (same as Screen 7)
- Leave history table — same columns as Screen 7 leave table

**Claims tab:**
- Claims history table — same pattern as Screen 6 left panel

**Documents tab (Pro gate):**
- `<ProGate>` wraps entire tab content
- Empty state shows document upload illustration + "Upload contracts, IDs, offer letters"
- File row: icon (12×12 coloured square by file type) + filename + uploaded date + download icon

**Activity tab:**
- Chronological audit log of all changes to this employee record
- Row: timestamp (11px mono, `#9C8B6E`) + actor avatar + action text (13px)
- Action text: "Danu updated employment type from Full-time to Contract"

---

## Drawers & Modals

All drawers slide in from the right. All modals are centred overlays.
Backdrop: rgba(15,14,19,0.4) with blur(4px).

### Drawer — Request Leave
**Width:** 440px desktop / full-width mobile
**Background:** white, border-radius 16px 0 0 16px on left edge
**Padding:** 28px

- Title: "Request leave" — 20px, 700 weight, `#0F0E13`
- Close button: top-right, `#B0AEBE` × icon

**Form fields (stacked, gap 16px):**
- Leave type: segmented control — Annual / Sick / Unpaid / Other
  - Active segment: `#1F1D2B` bg, white text
  - Inactive: white bg, `#72708A` text
  - Border: 1.5px rgba(99,87,232,0.15), border-radius 9px
- Start date / End date: two date pickers side by side, same input style as Claims
- Duration (auto-calculated): 13px, `#72708A` — "3 working days"
- Notes: textarea, 4 rows, same input style
- File attachment (optional): dashed border zone, upload icon in `#EFEDFD` square

**Submit button:** `#1F1D2B` bg, white text, full width, border-radius 10px

**Taps to complete (mobile):** 4 — tap type · set dates · add note (optional) · submit

### Drawer — Add Employee
**Width:** 480px desktop / full-width mobile

- Title: "Add employee" — 20px, 700 weight, `#1A1208`
- Two-column form layout (name + email on same row, etc.)
- Same input style as Claims panel
- Fields: Full name · Email · Phone · Job title · Department · Employment type · Start date
- Submit: "+ Add employee" full-width button

**Taps to complete (mobile):** Minimum 6 fields to fill + 1 submit = 7 interactions

### Modal — Confirm action (approve/reject leave, etc.)
- White card, border-radius 16px, width 360px, padding 28px, shadow-xl
- Icon: 40×40 coloured square (border-radius 10px) — green for approve, red for reject
- Title: 17px, 700 weight, `#0F0E13`
- Body: 13px, `#72708A`
- Actions: Cancel (outlined) + Confirm (filled) — gap 8px, both border-radius 9px

---

## State specifications (all screens)

### Loading state
Use skeleton loaders — never spinners for layout-level loading.

**Skeleton pattern:**
- Background: rgba(0,0,0,0.06) on light modules / rgba(255,255,255,0.06) on dark (Overview)
- Border-radius matches the real element (card → 16px skeleton, text → 6px skeleton)
- Animation: shimmer left-to-right, 1.4s ease-in-out, infinite
- Never show partial data — either skeleton or real data, never mixed

**Per-screen skeleton:**
- Overview metrics strip: 4 placeholder boxes same dimensions as metric cards
- People grid: 6 placeholder cards, same 3-column layout
- Attendance list: 8 placeholder rows, same height as real rows
- Leave / Claims table: 6 placeholder rows
- Employee detail: left column skeleton + right column tab skeleton

### Empty state
Never show a blank white space. Every list needs an empty state.

**Empty state anatomy:**
- Illustration: a 48×48 icon square (module accent bg, border-radius 14px) — not a generic "empty box"
- Heading: 15px, 700 weight, module text colour — specific to context
- Body: 13px, muted colour — actionable hint
- CTA button (when appropriate): same style as module primary button

**Per-screen empty states:**

| Screen | Icon colour | Heading | Body |
|--------|-------------|---------|------|
| People — no employees | `#EAE4D8` bg, `#7C5C2E` icon | "No employees yet" | "Add your first team member to get started." |
| People — search no results | same | "No results for "[query]"" | "Try a different name or clear the filter." |
| Attendance — no records today | `#D0EDD9` bg, `#0A6E35` icon | "No clock-ins yet today" | "Records appear here as employees check in." |
| Leave — no requests | `#DEDAF8` bg, `#6357E8` icon | "No leave requests" | "Requests submitted by your team appear here." |
| Claims — no claims | `#DEDAF8` bg, `#6357E8` icon | "No claims submitted" | "Approved claims will appear here once submitted." |
| Tasks — no tasks | `#EDE3CE` bg, `#A06820` icon | "Nothing to do yet" | "Create your first task to get the team moving." |
| Employee detail — no documents (Pro gate) | `#DEDAF8` bg, `#6357E8` icon | "No documents uploaded" | "Upload contracts, IDs, and offer letters." |

### Error state
For API failures that prevent a section from loading.

**Error pattern:**
- Same layout position as the section that failed
- Icon: `#FDECEC` bg, `#D44040` icon — 40×40, border-radius 10px
- Heading: "Couldn't load [section name]" — 14px, 600 weight, `#0F0E13`
- Body: "Check your connection and try again." — 12px, `#72708A`
- Retry button: small, outlined, `#D44040` border, `#D44040` text, border-radius 8px

**Inline error (form fields):**
- Border turns `#D44040`, box-shadow 0 0 0 3px rgba(212,64,64,0.1)
- Error text below field: 11px, `#AE2E2E`

**Toast notifications (transient feedback):**
- Bottom-centre of screen, above dock
- Success: `#0F0E13` bg, white text, green left border 3px
- Error: `#0F0E13` bg, white text, red left border 3px
- Width: 320px max, border-radius 10px, padding 12px 16px
- Auto-dismiss: 4s. Never stack more than 3.

**The Attendance live clock — API failure:**
- Clock display shows "--:--:--" in `rgba(255,255,255,0.2)`
- Stat numbers show "—" in `rgba(255,255,255,0.2)`
- Small error pill below clock: `#D44040` square (5×5) + "Live data unavailable" in 11px white/40%

---

## General rules (all screens)

1. **Status indicators are ALWAYS small coloured squares** (7×7px, border-radius 2px)
   Never use pills, badges, or rounded chips for status.

2. **Row separation is spacing, not borders**
   Use hover background changes and consistent row padding — not horizontal dividers.

3. **Avatars are rounded squares** (border-radius 9–12px depending on size)
   Never use circles for avatars.

4. **All monetary values** shown in correct currency with `formatMoney()` from `lib/utils/money.ts`

5. **All timestamps** shown in org local timezone using `formatDate()` from `lib/utils/date.ts`

6. **Pro features** shown but gated with `<ProGate>` component — greyed out with upgrade CTA overlay

7. **Empty states** must be designed for every list — never show a blank white space
   See **State specifications** section for per-screen empty state copy and icon colours.

8. **Loading states** use skeleton loaders — never spinners for layout-level loading.
   Skeletons match the shape of real content. No mixed skeleton/real data.

9. **Error states** follow the error pattern in **State specifications** — red icon square + retry.
   Inline form errors: red border + 11px error text below the field.

10. **Drawers** slide in from the right at 440–480px width (full-width on mobile).
    All drawers use a backdrop of rgba(15,14,19,0.4) + blur(4px).
    See **Drawers & Modals** section for full specs.
