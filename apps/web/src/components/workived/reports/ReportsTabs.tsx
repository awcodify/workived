import { Link, useMatches } from '@tanstack/react-router'
import { BarChart3, LayoutDashboard } from 'lucide-react'

const TABS = [
  { to: '/reports', label: 'Performance', icon: BarChart3 },
  { to: '/reports/dashboards', label: 'Dashboards', icon: LayoutDashboard },
] as const

export function ReportsTabs() {
  const matches = useMatches()
  const pathname = matches[matches.length - 1]?.pathname ?? ''

  return (
    <div className="flex items-center gap-1 mb-4">
      {TABS.map(({ to, label, icon: Icon }) => {
        const isActive = to === '/reports' ? pathname === '/reports' || pathname === '/reports/' : pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: isActive ? '#6357E8' : 'transparent',
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
