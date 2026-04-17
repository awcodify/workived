# Workived — Vite + React Frontend Agent

Senior frontend engineer building Workived web app.

## Identity
- Clean, accessible, performant React
- Vite + React SPA (NO SSR)
- TypeScript strict mode (no `any`)
- Small, composable components
- No business logic in components

## Stack
```
Vite 8, React 19, TanStack Router (type-safe file-based routing),
TanStack Query v5 (server state), Zustand (client state),
React Hook Form + Zod, axios (JWT interceptors),
Tailwind CSS v4, shadcn/ui, Plus Jakarta Sans,
Vitest + RTL + MSW
```

**Why Vite over Next.js:** Pure SPA behind JWT wall (no SSR/SEO). See `docs/adr/001-vite-react-over-nextjs.md`.
**Landing page:** Separate Astro app in `apps/landing/` (future).

## Project structure
```
src/
├── routes/               # TanStack Router file-based
│   ├── __root.tsx        # Root layout
│   ├── _auth/            # Unauthenticated (login)
│   └── _app/             # Authenticated (dock + auth guard)
├── components/
│   ├── ui/               # shadcn/ui (auto-generated)
│   └── workived/         # App components
├── lib/
│   ├── api/              # axios client + endpoint modules
│   ├── hooks/            # TanStack Query wrappers
│   ├── stores/           # Zustand (auth, org)
│   ├── utils/            # money, date, cn
│   └── validations/      # Zod schemas
└── types/api.ts          # TypeScript types matching API
```

## Routing (TanStack Router)

**Auth guard:**
```tsx
// src/routes/_app/route.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})
```

**Type-safe params:**
```tsx
// src/routes/_app/people/$id/route.tsx
export const Route = createFileRoute('/_app/people/$id')({
  component: EmployeeDetail,
})
function EmployeeDetail() {
  const { id } = Route.useParams()  // type-safe string
  const { data } = useEmployee(id)
}
```

## Design system (from `../../design/tokens.ts`)

**Module backgrounds** (full-screen worlds):
```
overview:   #0C0C0F (deep violet night)
people:     #F5F0E8 (warm cream)
attendance: #E8F5EE (fresh green)
leave/claims: #F3F2FB (soft violet)
tasks:      #FDF4E3 (warm amber)
```

**Colors (CSS custom props):**
```
--accent: #6357E8, --ok: #12A05C, --warn: #C97B2A, --err: #D44040
```

**Typography:**
Plus Jakarta Sans (install via `@fontsource-variable/plus-jakarta-sans`)
- Display/headings: weight 800, `tracking-tighter`
- Body: weight 400-500

**Status indicators:** Small colored squares (7×7px, border-radius 2px) — NEVER pills/badges.

**Avatars:** Rounded squares (9-12px border-radius) — NEVER circles. Use `getAvatarColor(id)` from tokens for deterministic colors.

**Dock:** Floating bottom nav. Background/icon/label colors change per module (see `dockThemes` in tokens).

**NO borders** between table rows — use spacing + hover states instead.

## API client

**axios with JWT interceptor:**
```tsx
// lib/api/client.ts
axios.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axios.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      // Try refresh, or logout
    }
    return Promise.reject(err)
  }
)
```

**Per-module API files:**
```
lib/api/auth.ts, lib/api/employees.ts, lib/api/attendance.ts, ...
```

## State management

**Zustand for auth/org:**
```tsx
// lib/stores/auth.ts
export const useAuthStore = create<AuthState>()(
  persist((set) => ({
    user: null,
    accessToken: null,
    setAuth: (user, token) => set({ user, accessToken: token }),
    logout: () => set({ user: null, accessToken: null }),
  }), { name: 'workived-auth' })
)
```

**TanStack Query for server state:**
```tsx
// lib/hooks/useEmployees.ts
export const useEmployees = (filters?: EmployeeFilters) =>
  useQuery({
    queryKey: ['employees', filters],
    queryFn: () => employeesAPI.list(filters),
    staleTime: 60_000,
  })
```

## Forms (React Hook Form + Zod)

```tsx
const schema = z.object({ email: z.string().email(), ... })
type FormData = z.infer<typeof schema>

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
})
```

## Money/Date utils

**Money format:**
```tsx
// lib/utils/money.ts
formatMoney(amount: number, currency: 'IDR' | 'AED' | 'MYR' | 'SGD')
// IDR no decimals: 10000 → "Rp 10,000"
// AED/MYR/SGD with decimals: 1000 → "AED 10.00"
```

**Date format:**
```tsx
// lib/utils/date.ts
formatDate(date: string, orgTimezone: string, format?: string)
// Always format in org's timezone from API
```

## data-testid (non-negotiable)

Every component you write **must** include `data-testid` on all meaningful elements. This is mandatory — no exceptions.

**Naming convention:** `{scope}-{element}` in kebab-case.
- `scope` = component or page context (e.g. `people`, `invite`, `leave-form`)
- `element` = what it is (e.g. `row`, `search-input`, `submit-btn`, `empty-state`)

**What always gets a testid:**
- Page/screen root container → `data-testid="{module}-page"`
- Every `<button>` → `data-testid="{scope}-{action}-btn"`
- Every `<input>` / `<select>` / `<textarea>` → `data-testid="{scope}-{field}-input"`
- Every list row/card → `data-testid="{scope}-row"` (use `{scope}-row-{id}` if iterated)
- Every modal/sheet container → `data-testid="{scope}-modal"`
- Every form → `data-testid="{scope}-form"`
- Loading skeleton → `data-testid="{scope}-skeleton"`
- Empty state → `data-testid="{scope}-empty"`
- Error state → `data-testid="{scope}-error"`

**Examples:**
```tsx
// Page root
<div data-testid="people-page">

// Search input
<input data-testid="people-search-input" ... />

// Table row (iterated)
<div key={emp.id} data-testid={`people-row-${emp.id}`}>

// CTA button
<button data-testid="people-add-btn">Add employee</button>

// Modal
<div data-testid="employee-detail-modal">

// Form + fields
<form data-testid="invite-form">
  <input data-testid="invite-email-input" />
  <select data-testid="invite-role-select" />
  <button data-testid="invite-submit-btn">Send invite</button>
</form>

// States
<div data-testid="people-skeleton" />
<div data-testid="people-empty" />
```

**Before committing, verify:**
- [ ] Page root has `data-testid`
- [ ] All buttons have `data-testid`
- [ ] All inputs/selects have `data-testid`
- [ ] All iterated rows have `data-testid` with unique suffix
- [ ] Loading/empty/error states have `data-testid`

## Testing (non-negotiable)

- Every component → `{Component}.test.tsx` in same commit
- Vitest + React Testing Library + MSW (mock API)
- Test: rendering, user interactions, loading/error/empty states
- Coverage target: critical paths (forms, auth, data display)
- **Use `data-testid` selectors** in tests — never query by text for interactive elements
- Same `data-testid` values work in **Playwright E2E** tests via `page.getByTestId()`

**Pattern:**
```tsx
// Component.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

describe('EmployeeList', () => {
  it('renders empty state when no employees', () => {
    render(<EmployeeList employees={[]} />)
    expect(screen.getByTestId('people-empty')).toBeInTheDocument()
  })

  it('renders rows for each employee', () => {
    render(<EmployeeList employees={[mockEmp]} />)
    expect(screen.getByTestId(`people-row-${mockEmp.id}`)).toBeInTheDocument()
  })
})
```

## DON'Ts

- No raw `fetch` (use api client)
- No business logic in components (extract to hooks/services)
- No inline styles except dynamic values from design tokens
- No hardcoded colors/spacing (use Tailwind + tokens)
- No `any` types (use `unknown` or proper types)
- No `useEffect` for data fetching (use TanStack Query)
- No localStorage for sensitive data (Zustand persist uses secure storage)
