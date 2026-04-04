import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { moduleThemes } from '@/design/tokens'
import { Clock, User, Briefcase, DollarSign, Activity } from 'lucide-react'
import type { EmploymentChange } from '@/types/api'

const t = moduleThemes.attendance

interface EmploymentHistoryTabProps {
  employeeId: string
}

export function EmploymentHistoryTab({ employeeId }: EmploymentHistoryTabProps) {
  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['employment-history', employeeId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: EmploymentChange[] }>(
        `/api/v1/employment-history/employee/${employeeId}`
      )
      return response.data.data
    },
  })

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'department':
        return <Briefcase size={16} />
      case 'title':
        return <Briefcase size={16} />
      case 'salary':
        return <DollarSign size={16} />
      case 'status':
        return <Activity size={16} />
      case 'employment_type':
        return <User size={16} />
      default:
        return <Clock size={16} />
    }
  }

  const getChangeLabel = (type: string) => {
    switch (type) {
      case 'department':
        return 'Department'
      case 'title':
        return 'Job Title'
      case 'salary':
        return 'Salary'
      case 'status':
        return 'Status'
      case 'employment_type':
        return 'Employment Type'
      default:
        return type
    }
  }

  const formatValue = (change: EmploymentChange) => {
    if (change.change_type === 'salary') {
      const formatSalary = (amount: number | null | undefined, currency: string | null | undefined) => {
        if (!amount || !currency) return '—'
        return `${currency} ${(amount / 100).toLocaleString()}`
      }
      return {
        old: formatSalary(change.old_salary, change.currency_code),
        new: formatSalary(change.new_salary, change.currency_code),
      }
    }
    if (change.change_type === 'department') {
      return {
        old: change.old_department_name || change.old_value || '—',
        new: change.new_department_name || change.new_value || '—',
      }
    }
    return {
      old: change.old_value || '—',
      new: change.new_value || '—',
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 rounded-xl" style={{ background: t.input }} />
          </div>
        ))}
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} style={{ color: t.textMuted }} className="mx-auto mb-4 opacity-30" />
        <p style={{ color: t.textMuted }} className="text-sm">
          No employment changes recorded yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Timeline */}
      <div className="relative">
        {changes.map((change, index) => {
          const value = formatValue(change)
          return (
            <div key={change.id} className="relative pl-8 pb-8 last:pb-0">
              {/* Timeline line */}
              {index < changes.length - 1 && (
                <div
                  className="absolute left-[11px] top-6 bottom-0 w-0.5"
                  style={{ background: t.border }}
                />
              )}
              
              {/* Timeline dot */}
              <div
                className="absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: t.input, border: `2px solid ${t.accent}` }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.accent }} />
              </div>

              {/* Change card */}
              <div
                className="rounded-xl p-4 space-y-2"
                style={{ background: t.input, border: `1px solid ${t.border}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.accent }}>
                      {getChangeIcon(change.change_type)}
                    </span>
                    <span className="font-semibold text-sm" style={{ color: t.text }}>
                      {getChangeLabel(change.change_type)} Changed
                    </span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: t.textMuted }}>
                    {formatDate(change.effective_date)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: t.textMuted }}>
                      From
                    </div>
                    <div className="font-medium" style={{ color: t.text }}>
                      {value.old}
                    </div>
                  </div>
                  <div className="text-lg" style={{ color: t.textMuted }}>
                    →
                  </div>
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: t.textMuted }}>
                      To
                    </div>
                    <div className="font-medium" style={{ color: t.accent }}>
                      {value.new}
                    </div>
                  </div>
                </div>

                {change.reason && (
                  <div className="pt-2 border-t" style={{ borderColor: t.border }}>
                    <div className="text-xs mb-1" style={{ color: t.textMuted }}>
                      Reason
                    </div>
                    <div className="text-sm" style={{ color: t.text }}>
                      {change.reason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
