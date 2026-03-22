import type { AttendanceRole } from '@/lib/hooks/useAttendanceRole'

export type AttendanceTab = 'my' | 'team' | 'all'

interface AttendanceTabsProps {
  activeTab: AttendanceTab
  onTabChange: (tab: AttendanceTab) => void
  role: AttendanceRole
}

/**
 * AttendanceTabs - Role-based tab switcher for attendance views (Sprint 12).
 * 
 * Shows:
 * - "My Attendance" tab → Always visible
 * - "Team Attendance" tab → canViewTeam (managers with direct reports)
 * - "Organization Attendance" tab → canViewAll (admin roles)
 */
export function AttendanceTabs({ activeTab, onTabChange, role }: AttendanceTabsProps) {
  return (
    <div 
      className="flex items-center gap-2 p-1.5" 
      style={{ 
        background: '#F3F4F6', 
        borderRadius: 12,
        border: '1px solid #E5E7EB',
      }}
    >
      {/* My Attendance - always visible */}
      <button
        onClick={() => onTabChange('my')}
        className="px-5 py-3 font-bold text-sm transition-all"
        style={{
          color: activeTab === 'my' ? '#FFFFFF' : '#6B7280',
          background: activeTab === 'my' ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' : 'transparent',
          borderRadius: 10,
          boxShadow: activeTab === 'my' ? '0 2px 8px rgba(139,92,246,0.25)' : 'none',
        }}
      >
        My Attendance
      </button>

      {/* Team Attendance - managers only */}
      {role.canViewTeam && (
        <button
          onClick={() => onTabChange('team')}
          className="px-5 py-3 font-bold text-sm transition-all"
          style={{
            color: activeTab === 'team' ? '#FFFFFF' : '#6B7280',
            background: activeTab === 'team' ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' : 'transparent',
            borderRadius: 10,
            boxShadow: activeTab === 'team' ? '0 2px 8px rgba(139,92,246,0.25)' : 'none',
          }}
        >
          Team Attendance
        </button>
      )}

      {/* Organization Attendance - admins only */}
      {role.canViewAll && (
        <button
          onClick={() => onTabChange('all')}
          className="px-5 py-3 font-bold text-sm transition-all"
          style={{
            color: activeTab === 'all' ? '#FFFFFF' : '#6B7280',
            background: activeTab === 'all' ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' : 'transparent',
            borderRadius: 10,
            boxShadow: activeTab === 'all' ? '0 2px 8px rgba(139,92,246,0.25)' : 'none',
          }}
        >
          All Employees
        </button>
      )}
    </div>
  )
}
