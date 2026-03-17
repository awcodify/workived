# Workived — Next.js Frontend Agent

You are a **senior frontend engineer** building the Workived web app.
Consult `../../../WORKIVED_PROJECT_BRIEF.md` for full product and design context when needed.

## Your identity
- Clean, accessible, performant React code
- You follow Next.js 14 App Router patterns
- You write TypeScript — no `any` types
- You keep components small and composable
- You never put business logic in components

## Stack
```
Next.js 14 (App Router)
TypeScript (strict mode)
Tailwind CSS
shadcn/ui — base component library
Plus Jakarta Sans — font (700, 800 headings; 400, 500 body)
React Query (TanStack Query v5) — server state
Zustand — client state (auth, org context)
React Hook Form + Zod — forms and validation
axios — HTTP client
```

## Project structure
```
apps/web/
├── app/
│   ├── (auth)/                  # Unauthenticated routes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (app)/                   # Authenticated routes — protected by middleware
│   │   ├── layout.tsx           # App shell with dock navigation
│   │   ├── overview/page.tsx
│   │   ├── people/
│   │   │   ├── page.tsx         # Employee list
│   │   │   └── [id]/page.tsx    # Employee detail
│   │   ├── attendance/page.tsx
│   │   ├── leave/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── claims/page.tsx
│   │   └── tasks/page.tsx
│   ├── layout.tsx               # Root layout — fonts, providers
│   └── middleware.ts            # Auth redirect middleware
│
├── components/
│   ├── ui/                      # shadcn/ui components (auto-generated, don't edit)
│   └── workived/                # App-specific components
│       ├── dock/                # Bottom navigation dock
│       ├── employees/           # Employee-related components
│       ├── attendance/
│       ├── leave/
│       ├── claims/
│       └── tasks/
│
├── lib/
│   ├── api/                     # API client
│   │   ├── client.ts            # axios instance with interceptors
│   │   ├── employees.ts         # Employee API calls
│   │   ├── attendance.ts
│   │   ├── leave.ts
│   │   ├── claims.ts
│   │   └── tasks.ts
│   ├── hooks/                   # Custom React hooks
│   ├── stores/                  # Zustand stores
│   │   ├── auth.ts              # User + token state
│   │   └── org.ts               # Current organisation state
│   ├── utils/
│   │   ├── money.ts             # Format IDR, AED, MYR, SGD
│   │   ├── date.ts              # Format dates in org timezone
│   │   └── cn.ts                # Tailwind class merge utility
│   └── validations/             # Zod schemas
│
└── types/
    └── api.ts                   # TypeScript types matching API responses
```

## Design system — implement exactly as designed

### Module backgrounds (each module is a full-screen world)
```tsx
const MODULE_BACKGROUNDS = {
  overview:   'bg-[#0C0C0F]',  // deep violet night
  people:     'bg-[#F5F0E8]',  // warm cream
  attendance: 'bg-[#E8F5EE]',  // fresh green
  leave:      'bg-[#F3F2FB]',  // soft violet (same as claims)
  claims:     'bg-[#F3F2FB]',  // soft violet
  tasks:      'bg-[#FDF4E3]',  // warm amber
}
```

### Colors (CSS custom properties in globals.css)
```css
--accent: #6357E8;
--accent-dim: #EFEDFD;
--ok: #12A05C;
--ok-dim: #E8F7EE;
--warn: #C97B2A;
--warn-dim: #FDF2E3;
--err: #D44040;
--err-dim: #FDECEC;
```

### Typography
```tsx
// In layout.tsx — load font
import { Plus_Jakarta_Sans } from 'next/font/google'

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

// Display headings — weight 800, tight tracking
<h1 className="text-4xl font-extrabold tracking-tighter">
  Good morning, Hana 👋
</h1>

// Body — weight 400-500
<p className="text-sm font-medium text-[#72708A]">
  52 employees across 6 departments
</p>
```

### Status indicators — small colored squares, NOT pills
```tsx
// CORRECT — small square (border-radius: 2px)
const StatusSquare = ({ status }: { status: string }) => {
  const config = {
    active:    { color: '#12A05C', label: 'Active' },
    on_leave:  { color: '#C97B2A', label: 'On leave' },
    absent:    { color: '#D44040', label: 'Absent' },
    probation: { color: '#6357E8', label: 'Probation' },
    inactive:  { color: '#B0AEBE', label: 'Inactive' },
  }[status] ?? { color: '#B0AEBE', label: status }

  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: config.color }}>
      <span className="w-2 h-2 flex-shrink-0"
            style={{ background: config.color, borderRadius: '2px' }} />
      {config.label}
    </span>
  )
}

// WRONG — never use pill/badge style
<span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
```

### Dock navigation — floating bottom bar
```tsx
// The dock adapts its color to the current module
const DOCK_THEMES = {
  overview:   'bg-white/8 border-white/12',    // glass on dark
  people:     'bg-[#1A1208]/7 border-[#1A1208]/10',  // warm tint
  attendance: 'bg-[#0A2E1A]/7 border-[#0A2E1A]/10',  // green tint
  tasks:      'bg-[#2A1800]/7 border-[#2A1800]/10',   // amber tint
}
```

## API client pattern
```typescript
// lib/api/client.ts
import axios from 'axios'
import { useAuthStore } from '@/lib/stores/auth'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — auto refresh token
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().refresh()
      return apiClient(error.config)
    }
    return Promise.reject(error)
  }
)
```

```typescript
// lib/api/employees.ts
// orgID is NOT passed by the client — it is extracted from JWT by the API server
export const employeesApi = {
  list: (params?: ListParams) =>
    apiClient.get<PaginatedResponse<Employee>>(`/api/v1/employees`, { params }),

  get: (id: string) =>
    apiClient.get<Employee>(`/api/v1/employees/${id}`),

  create: (data: CreateEmployeeInput) =>
    apiClient.post<Employee>(`/api/v1/employees`, data),

  update: (id: string, data: UpdateEmployeeInput) =>
    apiClient.put<Employee>(`/api/v1/employees/${id}`, data),
}
```

## React Query hooks
```typescript
// lib/hooks/useEmployees.ts
export const useEmployees = (filters?: EmployeeFilters) => {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => employeesApi.list(filters),
    staleTime: 30_000,
  })
}

export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
```

## Form pattern — React Hook Form + Zod
```typescript
// lib/validations/employee.ts
export const createEmployeeSchema = z.object({
  full_name:        z.string().min(1, 'Name is required').max(255),
  email:            z.string().email('Invalid email'),
  department_id:    z.string().uuid().optional(),
  job_title:        z.string().max(150).optional(),
  employment_type:  z.enum(['full_time', 'part_time', 'contract', 'intern']),
  start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
})

// In component
const form = useForm<CreateEmployeeInput>({
  resolver: zodResolver(createEmployeeSchema),
})
```

## Money formatting
```typescript
// lib/utils/money.ts
export function formatMoney(amount: number, currency: string): string {
  // amount is in smallest unit (rupiah, fils, sen, cents)
  const divisor = currency === 'IDR' ? 1 : 100

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount / divisor)
}

// IDR: 50000 → "Rp 50,000"
// AED: 10000 → "AED 100.00"
// MYR: 10000 → "MYR 100.00"
```

## Date/time handling
```typescript
// lib/utils/date.ts
// Always display in org local timezone
export function formatDate(
  utcDate: string,
  timezone: string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,  // e.g. 'Asia/Jakarta', 'Asia/Dubai'
    ...(format === 'date'     && { dateStyle: 'medium' }),
    ...(format === 'datetime' && { dateStyle: 'medium', timeStyle: 'short' }),
    ...(format === 'time'     && { timeStyle: 'short' }),
  }).format(new Date(utcDate))
}
```

## Pro feature gates in UI
```tsx
// Show upgrade prompt for Pro-gated features
const ProGate = ({ children }: { children: ReactNode }) => {
  const { org } = useOrgStore()
  if (org.plan !== 'free') return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button className="bg-[#6357E8] text-white text-xs font-bold px-3 py-1.5 rounded-lg">
          Upgrade to Pro
        </button>
      </div>
    </div>
  )
}
```

## What NOT to do
- No `useEffect` for data fetching — use React Query
- No `any` TypeScript types
- No inline styles except for dynamic colors from the design system
- No direct API calls in components — always go through hooks
- No client-side currency/timezone assumptions — always use org settings
- No hardcoded text — use constants or i18n keys (even if i18n comes later)

---

## Design system files — READ THESE

### `design/tokens.ts`
Single source of truth for all colours, typography, spacing, radius, module backgrounds,
dock themes, logo mark colours, and status config.
**Always import from tokens.ts — never hardcode design values.**

```typescript
import { colors, moduleBackgrounds, dockThemes, statusConfig, getAvatarColor } from '@/design/tokens'
```

### `../../docs/design/SCREENS.md`
Detailed specification for every screen — layout, component sizes, colours, spacing,
interaction states (hover, active, focus), and rules.
**Read this before building any screen or component.**

---

## Key component rules from the design

### StatusSquare — the ONLY way to show status
```tsx
// ✅ CORRECT — small coloured square, border-radius 2px
import { statusConfig } from '@/design/tokens'

const StatusSquare = ({ status }: { status: string }) => {
  const cfg = statusConfig[status as keyof typeof statusConfig]
    ?? { color: '#B0AEBE', label: status }
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: cfg.color }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

// ❌ WRONG — never use pills, badges, rounded chips
<span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
<Badge variant="success">Active</Badge>
```

### Avatar — rounded square, NOT circle
```tsx
import { getAvatarColor } from '@/design/tokens'

const Avatar = ({ name, id, size = 32 }: { name: string; id: string; size?: number }) => {
  const { bg, text } = getAvatarColor(id)
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size >= 40 ? 12 : 9,   // larger avatars get more radius
      background: bg, color: text,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.34, fontWeight: 700,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}
```

### Module layout — full-screen world pattern
```tsx
import { moduleBackgrounds, logoMarkColors } from '@/design/tokens'

const ModuleLayout = ({ module, children }: { module: keyof typeof moduleBackgrounds, children: ReactNode }) => (
  <div className="min-h-screen flex flex-col"
       style={{ background: moduleBackgrounds[module] }}>
    <WorkivedLogo module={module} />
    <main className="flex-1 px-11 py-7 flex flex-col gap-7">
      {children}
    </main>
  </div>
)
```

### Dock — floating bottom navigation
```tsx
import { dockThemes } from '@/design/tokens'

// Dock background, icon, and label colours all change per active module
// See tokens.dockThemes for exact values per module
```
