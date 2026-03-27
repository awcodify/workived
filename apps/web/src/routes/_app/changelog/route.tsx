import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { changelog, type ChangelogType } from '@/data/changelog'
import { useChangelogUnread } from '@/lib/hooks/useChangelog'
import { colors, typography } from '@/design/tokens'

export const Route = createFileRoute('/_app/changelog')({
  component: ChangelogPage,
})

const typeConfig: Record<ChangelogType, { color: string; label: string }> = {
  feature: { color: colors.ok, label: 'Feature' },
  fix: { color: colors.err, label: 'Fix' },
  improvement: { color: colors.accent, label: 'Improvement' },
  announcement: { color: colors.warn, label: 'Announcement' },
}

/** Group entries by month string e.g. "March 2026" */
function groupByMonth(entries: typeof changelog) {
  const groups: { month: string; entries: typeof changelog }[] = []
  const map = new Map<string, typeof changelog>()

  for (const entry of entries) {
    const d = new Date(entry.date + 'T00:00:00')
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!map.has(key)) {
      const arr: typeof changelog = []
      map.set(key, arr)
      groups.push({ month: key, entries: arr })
    }
    map.get(key)!.push(entry)
  }

  return groups
}

function ChangelogPage() {
  const { markAsRead } = useChangelogUnread()

  // Mark as read when page is viewed
  useEffect(() => {
    markAsRead()
  }, [markAsRead])

  const grouped = groupByMonth(changelog)

  return (
    <div
      className="min-h-screen px-4 py-8 md:px-8"
      style={{ background: '#F3F2FB' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl mb-2"
            style={{
              fontFamily: typography.fontFamily,
              fontWeight: typography.h1.weight,
              letterSpacing: typography.h1.tracking,
              color: '#0F0E13',
            }}
          >
            What's New
          </h1>
          <p
            className="text-sm"
            style={{
              fontFamily: typography.fontFamily,
              color: '#72708A',
            }}
          >
            Latest updates, fixes, and improvements to Workived.
          </p>
        </div>

        {/* Grouped entries */}
        {grouped.map(({ month, entries }) => (
          <div key={month} className="mb-8">
            {/* Month header */}
            <h2
              className="text-xs uppercase mb-4 tracking-wider"
              style={{
                fontFamily: typography.fontFamily,
                fontWeight: 700,
                color: '#72708A',
                letterSpacing: typography.caption.tracking,
              }}
            >
              {month}
            </h2>

            {/* Entries */}
            <div className="flex flex-col gap-3">
              {entries.map((entry) => {
                const config = typeConfig[entry.type]
                return (
                  <div
                    key={entry.id}
                    className="px-4 py-3.5 rounded-xl transition-all"
                    style={{
                      background: '#FFFFFF',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F9F8FF'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FFFFFF'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type indicator — 7x7 colored square */}
                      <div
                        className="mt-1.5 flex-shrink-0"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 2,
                          background: config.color,
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="text-sm"
                            style={{
                              fontFamily: typography.fontFamily,
                              fontWeight: 600,
                              color: '#0F0E13',
                            }}
                          >
                            {entry.title}
                          </h3>
                          {entry.module && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                fontFamily: typography.fontFamily,
                                fontWeight: 600,
                                background: 'rgba(99,87,232,0.08)',
                                color: colors.accent,
                              }}
                            >
                              {entry.module}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p
                          className="text-xs mt-1 leading-relaxed"
                          style={{
                            fontFamily: typography.fontFamily,
                            color: '#72708A',
                          }}
                        >
                          {entry.description}
                        </p>

                        {/* Date + type label */}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="text-[10px]"
                            style={{
                              fontFamily: typography.fontFamily,
                              fontWeight: 500,
                              color: '#B0AEBE',
                            }}
                          >
                            {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{
                              fontFamily: typography.fontFamily,
                              fontWeight: 600,
                              color: config.color,
                            }}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center py-6">
          <p
            className="text-xs"
            style={{
              fontFamily: typography.fontFamily,
              color: '#B0AEBE',
            }}
          >
            You're all caught up!
          </p>
        </div>
      </div>
    </div>
  )
}
