import { Link, useMatches } from '@tanstack/react-router'
import { Users, BarChart3 } from 'lucide-react'

const TABS = [
  { to: '/people', label: 'Team', icon: Users },
  { to: '/people/performance', label: 'Performance', icon: BarChart3 },
] as const

export function PeopleTabs() {
  const matches = useMatches()
  const pathname = matches[matches.length - 1]?.pathname ?? ''

  return (
    <div className="flex items-center gap-1 mb-4">
      {TABS.map(({ to, label, icon: Icon }) => {
        const isActive =
          to === '/people'
            ? pathname === '/people' || pathname === '/people/'
            : pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: isActive ? '#C97B2A' : 'transparent',
              color: isActive ? '#fff' : '#72708A',
            }}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
