# Sprint 5: Leave Module — Design Guidelines

**Designer:** Workived Design Team  
**Module:** Leave Management  
**Date:** March 20, 2026  
**Status:** Ready for implementation

---

## 1. Design Philosophy

**Module Identity:**  
Leave is calm, organized, and respectful — a soft, light environment in contrast to the dark attendance/people worlds. The light violet background (#F3F2FB) creates a professional, approachable space for sensitive HR interactions.

**Key Principles:**
1. **Clarity over decoration** — Leave requests are formal, status always visible
2. **Balance at a glance** — Employee should see available days immediately
3. **Respectful interactions** — Approval/rejection flows are serious, require intentional action
4. **Mobile-first** — Most employees will submit leave from mobile during commute

---

## 2. Color System

### Module Background
```
Background: #F3F2FB (ink50 — soft violet)
```

### Module Theme (from design tokens)
```typescript
leave: {
  text:         '#0F0E13',      // ink900 — primary text
  textMuted:    '#72708A',      // ink500 — secondary text
  surface:      '#FFFFFF',      // white cards
  surfaceHover: '#F3F2FB',      // soft violet hover
  accent:       '#6357E8',      // primary accent
  accentText:   '#FFFFFF',      // white text on accent
  border:       'rgba(99,87,232,0.10)',  // subtle violet border
  input:        '#FFFFFF',      // white input
  inputBorder:  'rgba(99,87,232,0.12)',  // violet input border
}
```

### Status Colors
```typescript
pending:   '#C97B2A' (warn)     // Orange — awaiting action
approved:  '#12A05C' (ok)       // Green — confirmed
rejected:  '#D44040' (err)      // Red — declined
cancelled: '#B0AEBE' (ink300)   // Grey — withdrawn
```

### Policy Type Colors (for calendar view)
Use deterministic colors based on policy name hash:
```typescript
const policyColors = [
  { bg: '#EFEDFD', border: '#6357E8', text: '#4A3FBF' },  // Violet
  { bg: '#E8F7EE', border: '#12A05C', text: '#0D7A45' },  // Green
  { bg: '#FDF2E3', border: '#C97B2A', text: '#A0601A' },  // Amber
  { bg: '#FDECEC', border: '#D44040', text: '#AE2E2E' },  // Red
  { bg: '#F3F2FB', border: '#72708A', text: '#72708A' },  // Neutral
]
```

---

## 3. Typography Hierarchy

### Page Headers
```typescript
Module title:   44px, weight 800, tracking -0.05em, color #0F0E13
Subtitle:       14px, weight 400, color #72708A
```

### Section Headers
```typescript
H2: 22px, weight 700, tracking -0.03em, color #0F0E13
H3: 16px, weight 700, tracking -0.02em, color #0F0E13
```

### Body Text
```typescript
Body:    14px, weight 400, line-height 1.6, color #0F0E13
Label:   13px, weight 500, tracking -0.01em, color #72708A
Caption: 11px, weight 500, tracking 0.04em, color #72708A
```

### Numbers (days, counts)
```typescript
Large number:  32px, weight 800, tracking -0.04em, color #0F0E13
Medium number: 22px, weight 700, tracking -0.02em, color #0F0E13
Small number:  16px, weight 700, color #0F0E13
```

### Monospace (dates, times)
```typescript
Font: SF Mono / Fira Code
Size: 12px, weight 400, tracking 0.02em, color #72708A
```

---

## 4. Component Designs

### 4.1 Balance Card

**Visual Structure:**
```
┌─────────────────────────────────────────┐
│ Annual Leave                      24    │  ← Policy name + available days (large)
│ 30 days granted • 2 carried over        │  ← Breakdown (caption)
│                                          │
│ [████████████░░░░░░░] 18 / 30           │  ← Visual bar + used / total
│                                          │
│ Used: 5 days • Pending: 3 days          │  ← Details (caption)
└─────────────────────────────────────────┘
```

**Specs:**
- **Card:** White background (#FFFFFF), border-radius: 14px, padding: 20px
- **Border:** 1px solid rgba(99,87,232,0.10)
- **Shadow:** None (flat design)
- **Hover:** Background → #F3F2FB, transform: translateY(-1px), duration: 150ms

**Available Days (large number):**
- Font-size: 32px, weight: 800, color: #6357E8 (accent)
- Position: Top-right, aligned to baseline with policy name

**Progress Bar:**
- Height: 8px, border-radius: 4px
- Background: #EDECF4 (ink100)
- Fill: #6357E8 (accent) for used, #C97B2A (warn) for pending overlay
- Margin: 12px 0

**Breakdown Labels:**
- Font-size: 11px, weight: 500, color: #72708A
- Spacing: 4px vertical gap

**Mobile (<640px):**
- Stack vertically, large number below policy name
- Progress bar full-width

---

### 4.2 Request Card

**Visual Structure:**
```
┌─────────────────────────────────────────────────┐
│ [●] Pending              Mar 25 – Mar 27 (3 days) │  ← Status + dates
│                                                   │
│ Annual Leave                                      │  ← Policy name
│ Reason: Family emergency                          │  ← Reason (truncated)
│                                                   │
│ [Cancel]                    [View details →]     │  ← Actions (if pending)
└─────────────────────────────────────────────────┘
```

**Specs:**
- **Card:** Same as Balance Card (white, 14px radius, 20px padding)
- **Hover:** Background → #F3F2FB
- **Status square:** 7×7px, border-radius: 2px (NOT full circle)
- **Gap:** 12px between sections

**Status Badge:**
```tsx
<StatusSquare status="pending" />
```
- Position: Top-left
- Font-size: 12px, weight: 600, uppercase

**Date Range:**
- Font: SF Mono, 12px, color: #72708A
- Position: Top-right (desktop), below status (mobile)
- Format: "Mar 25 – Mar 27 (3 days)"

**Actions:**
- **Cancel button:** Text button, color: #D44040, hover: lighten 10%
- **View details:** Link, color: #6357E8, arrow icon (lucide-react)
- Spacing: 16px gap between buttons

**Mobile (<640px):**
- Stack status and dates vertically
- Actions full-width, Cancel above View

---

### 4.3 Request Form

**Layout:**
```
┌─────────────────────────────────────────┐
│ Submit Leave Request              [×]   │  ← Modal header
│─────────────────────────────────────────│
│                                          │
│ Leave Type *                             │
│ [Select leave type ▼]                   │  ← Dropdown
│                                          │
│ Date Range *                             │
│ [Mar 20, 2026 ─────→ Mar 22, 2026]      │  ← Date range picker
│                                          │
│ Working days: 3 days                     │  ← Real-time calculation
│ Available balance: 24 days               │
│                                          │
│ Reason (optional)                        │
│ [Textarea 3 rows]                        │
│                                          │
│─────────────────────────────────────────│
│         [Cancel]    [Submit Request]    │  ← Footer actions
└─────────────────────────────────────────┘
```

**Specs:**
- **Modal:** Width: 480px (desktop), full-width (mobile)
- **Background:** White with subtle shadow
- **Border-radius:** 18px (desktop), 0 (mobile sheet from bottom)
- **Padding:** 24px (desktop), 20px (mobile)

**Form Fields:**
- **Label:** 13px, weight: 500, color: #0F0E13, margin-bottom: 6px
- **Input:** 14px, padding: 12px, border-radius: 10px
- **Border:** 1px solid rgba(99,87,232,0.12), focus: 2px solid #6357E8
- **Error:** Border color: #D44040, helper text below field

**Date Range Picker:**
- Two inputs side-by-side (desktop), stacked (mobile)
- Calendar dropdown with disabled weekends/holidays (visual indicator)
- "Working days" label updates in real-time as dates change

**Real-time Feedback:**
```
✓ Working days: 3 days
✓ Available balance: 24 days

// If insufficient:
⚠ Working days: 10 days
⚠ Available balance: 5 days (insufficient)
```
- Use ✓ (green #12A05C) and ⚠ (orange #C97B2A) icons
- Font-size: 12px, semi-bold

**Submit Button:**
- Full accent button: background #6357E8, color #FFFFFF
- Height: 44px, border-radius: 10px, font-size: 14px, weight: 600
- Disabled state: opacity: 0.5, cursor: not-allowed
- Hover: Darken 5%

**Mobile (<640px):**
- Use shadcn `Sheet` component (slides up from bottom)
- Full-width inputs
- Submit button sticky at bottom

---

### 4.4 Approval Dialog

**Layout:**
```
┌─────────────────────────────────────────┐
│ Review Leave Request                    │
│─────────────────────────────────────────│
│                                          │
│ Employee: John Doe                       │
│ Leave type: Annual Leave                 │
│ Dates: Mar 25 – Mar 27 (3 days)         │
│ Reason: Family emergency                 │
│                                          │
│ Note (optional for approval, required   │
│ for rejection)                           │
│ [Textarea 2 rows]                        │
│                                          │
│─────────────────────────────────────────│
│   [Cancel]  [Reject]     [Approve]      │
└─────────────────────────────────────────┘
```

**Specs:**
- Same modal structure as Request Form
- **Reject button:** Red (#D44040), secondary style
- **Approve button:** Green (#12A05C), primary style
- **Button order:** Cancel (left), Reject (center), Approve (right)

**Validation:**
- Rejection requires note (min 10 chars)
- Show error under textarea if rejected without note

---

### 4.5 Leave Calendar

**Month Grid:**
```
         March 2026              [< >]
─────────────────────────────────────────
Mon  Tue  Wed  Thu  Fri  Sat  Sun
                          1    2
 3    4    5    6    7    8    9
10   11   12   13   14   15   16
17   18   19  [20] [21]  22   23
24   25   26   27   28   29   30
31
─────────────────────────────────────────
[20-21] John Doe — Annual Leave (2 days)
```

**Specs:**
- **Grid:** 7 columns, border-collapse: separate, gap: 2px
- **Cell:** 48px × 48px (desktop), 40px × 40px (mobile)
- **Cell background:** #FFFFFF, border-radius: 6px
- **Hover:** Background → #F3F2FB
- **Today:** Border: 2px solid #6357E8

**Leave Blocks:**
- **Visual:** Colored bar inside cell (bottom half of cell)
- **Height:** 4px, border-radius: 2px
- **Color:** Policy-based (use deterministic hash)
- **Tooltip on hover:** "John Doe — Annual Leave (Mar 20-21)"

**Multi-day Leave:**
- Span cells horizontally if contiguous
- If wraps to next row, split into separate blocks

**Weekend/Holiday:**
- Cell background: #F3F2FB (dimmed)
- Text color: #B0AEBE (muted)

**Mobile (<640px):**
- Switch to list view instead of grid
- Show entries as cards with date + employee + policy

---

### 4.6 Status Square

**Design (already exists):**
```typescript
<StatusSquare status="pending" />
```

**Specs:**
- Square: 7×7px, border-radius: 2px (NOT circle, NOT pill)
- Label: 12px, weight: 600, gap: 6px
- Color matches status (from statusConfig in tokens)

**Usage:**
- List views: At start of request card
- Detail views: Near header
- NEVER use pills or badges — only squares

---

### 4.7 Policy Form (Admin)

Similar to Request Form but fields:
- **Name:** Text input (max 100 chars)
- **Days per year:** Number input (0-365)
- **Carry over days:** Number input (0-365)
- **Min tenure days:** Number input (0+)
- **Requires approval:** Checkbox

---

## 5. Layout Patterns

### Page Structure
```
┌─────────────────────────────────────────┐
│ [Logo]                        [Avatar]  │  ← Minimal top nav (if needed)
│                                          │
│          LEAVE                           │  ← Module title
│          24 days available               │  ← Subtitle
│                                          │
│ ┌────────────┐ ┌────────────┐           │
│ │ Balance 1  │ │ Balance 2  │           │  ← Balance cards (grid)
│ └────────────┘ └────────────┘           │
│                                          │
│ ─────────────────────────────────────   │  ← Section divider
│                                          │
│ My Requests                              │  ← Section header
│ ┌──────────────────────────────────┐    │
│ │ Request card 1                   │    │
│ ├──────────────────────────────────┤    │
│ │ Request card 2                   │    │
│ └──────────────────────────────────┘    │
│                                          │
│                                          │
│          [...dock...]                    │  ← Floating dock at bottom
└─────────────────────────────────────────┘
```

### Grid System
- **Balance cards:** 2 columns (desktop), 1 column (mobile)
- **Request list:** 1 column full-width
- **Gap:** 16px between cards
- **Container max-width:** 1200px, centered

### Spacing
```typescript
Page padding:     px-6 py-8 (mobile), px-11 py-10 (desktop)
Bottom padding:   pb-28 (dock clearance)
Section gap:      mb-8 (32px)
Card gap:         gap-4 (16px)
```

---

## 6. Interactive States

### Hover States
```typescript
Card hover:
  background: #F3F2FB (surfaceHover)
  transform: translateY(-1px)
  transition: all 150ms ease-out

Button hover:
  Primary: darken 5%
  Secondary: opacity 0.9
  Text: opacity 0.7

Link hover:
  color: darken accent 10%
  text-decoration: underline
```

### Focus States
```typescript
Input focus:
  border: 2px solid #6357E8
  outline: none
  box-shadow: 0 0 0 3px rgba(99,87,232,0.1)

Button focus:
  outline: 2px solid #6357E8
  outline-offset: 2px
```

### Disabled States
```typescript
Button disabled:
  opacity: 0.5
  cursor: not-allowed

Input disabled:
  background: #F3F2FB
  color: #B0AEBE
  cursor: not-allowed
```

### Loading States
```typescript
Skeleton:
  background: linear-gradient(90deg, #EDECF4 25%, #F3F2FB 50%, #EDECF4 75%)
  animation: shimmer 1.5s infinite
  border-radius: same as component
```

---

## 7. Mobile Patterns

### Breakpoints
```css
sm: 640px
md: 768px
lg: 1024px
```

### Mobile-specific Components

**Bottom Sheet (for forms):**
- Slides up from bottom
- Full-width, rounded top corners (18px)
- Drag handle: 32px × 4px, centered, #DDDBE8
- Backdrop: rgba(0,0,0,0.4)

**Touch Targets:**
- Minimum: 44×44px (iOS guideline)
- Buttons: py-3 px-4 (minimum)
- List items: min-height: 56px

**Mobile Navigation:**
- Tabs: Full-width, horizontal scroll if needed
- Filters: Horizontal chips, scroll
- Sort: Bottom sheet picker

**Mobile List:**
- Cards stack vertically, gap: 3px
- Swipe actions: NOT implemented in Sprint 5 (defer)

---

## 8. Accessibility

### ARIA Labels
```tsx
<button aria-label="Submit leave request">Submit</button>
<input aria-describedby="balance-error" />
<div role="status" aria-live="polite">{message}</div>
```

### Keyboard Navigation
- Tab order: logical top-to-bottom, left-to-right
- Enter: Submit forms, activate buttons
- Escape: Close modals/dialogs
- Arrow keys: Navigate date picker, calendar

### Color Contrast
- Text on white: WCAG AA (4.5:1 minimum)
- Status colors tested: All pass AA
- Links: Underline on hover (not color alone)

### Screen Readers
- Status squares: Include text label, not icon alone
- Form errors: aria-invalid + aria-describedby
- Loading states: aria-busy="true"

---

## 9. Animation Guidelines

### Timing
```typescript
Fast:    100ms  (hover feedback)
Normal:  150ms  (transitions)
Slow:    300ms  (modals, sheets)
```

### Easing
```css
Ease-out: cubic-bezier(0.16, 1, 0.3, 1)  /* Material Design standard */
Ease-in:  cubic-bezier(0.4, 0, 1, 1)
```

### Animations

**Card hover:**
```css
transition: all 150ms ease-out;
transform: translateY(-1px);
```

**Modal enter:**
```css
@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
animation: modal-enter 200ms ease-out;
```

**Bottom sheet enter:**
```css
@keyframes sheet-enter {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
animation: sheet-enter 300ms cubic-bezier(0.16, 1, 0.3, 1);
```

**Skeleton shimmer:**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
animation: shimmer 1.5s infinite;
```

### No Animation
- Respect `prefers-reduced-motion`
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Empty States

### No Balances
```
[Calendar icon]
No leave balances yet
Ask your HR admin to set up leave policies.
```

### No Requests
```
[Inbox icon]
No leave requests yet
Submit your first request using the button above.
```

### No Pending Approvals
```
[Check icon]
All caught up!
No pending leave requests to review.
```

**Specs:**
- Icon: 48px, color: #B0AEBE
- Heading: 16px, weight: 700, color: #0F0E13
- Body: 14px, color: #72708A
- Spacing: 8px gap, center-aligned
- Container: Min-height: 240px, center content

---

## 11. Error States

### Form Errors
```tsx
<input className="border-red-500" />
<p className="text-xs text-[#D44040] mt-1">
  End date must be after start date
</p>
```

### API Errors
```tsx
<div className="bg-[#FDECEC] border border-[#D44040] rounded-lg p-4">
  <p className="text-sm font-semibold text-[#AE2E2E]">
    Failed to submit request
  </p>
  <p className="text-xs text-[#72708A] mt-1">
    {errorMessage}
  </p>
</div>
```

### Insufficient Balance
```tsx
<div className="bg-[#FDF2E3] border border-[#C97B2A] rounded-lg p-3">
  <p className="text-sm font-semibold text-[#A0601A]">
    ⚠ Insufficient balance
  </p>
  <p className="text-xs text-[#72708A] mt-1">
    You only have 5 days available but requested 10 days.
  </p>
</div>
```

---

## 12. Success States

### Request Submitted
```tsx
<div className="bg-[#E8F7EE] border border-[#12A05C] rounded-lg p-4">
  <p className="text-sm font-semibold text-[#0D7A45]">
    ✓ Leave request submitted
  </p>
  <p className="text-xs text-[#72708A] mt-1">
    Your manager will review your request shortly.
  </p>
</div>
```

**Auto-dismiss:** After 3 seconds, fade out

---

## 13. Responsive Behavior

### Desktop (≥1024px)
- 2-column balance grid
- Side-by-side date inputs
- Table-like request list
- Calendar month grid

### Tablet (640px - 1023px)
- 2-column balance grid
- Stacked date inputs
- Card-based request list
- Calendar month grid (smaller cells)

### Mobile (<640px)
- 1-column balance stack
- Stacked date inputs
- Card-based request list (compact)
- Calendar → list view

---

## 14. Design Tokens Reference

All values sourced from `design/tokens.ts`. Never hardcode.

```typescript
import {
  moduleBackgrounds,
  moduleThemes,
  colors,
  typography,
  spacing,
  radius,
  statusConfig,
} from '@/design/tokens'

const t = moduleThemes.leave

// Usage:
style={{
  background: moduleBackgrounds.leave,
  color: t.text,
  fontSize: typography.body.size,
  padding: spacing[6],
  borderRadius: radius.lg,
}}
```

---

## 15. Figma Assets

**Status:** Design system tokens already implemented in code.  
**No Figma mockups** — build directly from this spec.

**Why?** Faster iteration, code is source of truth, design tokens ensure consistency.

---

## 16. Implementation Checklist

- [ ] Balance cards with progress bars
- [ ] Request cards with status squares
- [ ] Request form (modal on desktop, sheet on mobile)
- [ ] Date range picker with exclusions
- [ ] Approval dialog (approve/reject)
- [ ] Leave calendar (month grid + list view on mobile)
- [ ] Policy form (admin)
- [ ] Empty states (all 3 scenarios)
- [ ] Error states (form + API + insufficient balance)
- [ ] Success toasts (auto-dismiss)
- [ ] Loading skeletons (all lists)
- [ ] Hover states (all interactive elements)
- [ ] Focus states (keyboard navigation)
- [ ] Mobile responsive (all breakpoints tested)
- [ ] Accessibility (ARIA labels, keyboard nav, screen reader)
- [ ] Animation (respect prefers-reduced-motion)

---

## 17. Design QA Checklist

Before marking component as done:

**Visual:**
- [ ] Colors match moduleThemes.leave exactly
- [ ] Typography sizes/weights from design tokens
- [ ] Spacing uses spacing scale (no arbitrary values)
- [ ] Border-radius matches radius scale
- [ ] Status squares are 7×7px, border-radius 2px (NOT circles)
- [ ] Hover states work (background + transform)
- [ ] No visual bugs on mobile (Safari iOS, Chrome Android)

**Interactive:**
- [ ] All buttons have 44×44px minimum touch target
- [ ] Forms validate client-side before API call
- [ ] Loading states show during API calls
- [ ] Success/error messages display correctly
- [ ] Keyboard navigation works (tab, enter, escape)

**Accessibility:**
- [ ] Color contrast passes WCAG AA
- [ ] ARIA labels on all interactive elements
- [ ] Screen reader announces status changes
- [ ] Focus visible on all focusable elements
- [ ] No flashing/blinking that could trigger seizures

---

**Design Complete. Ready for Engineer Implementation! 👨‍💻**
