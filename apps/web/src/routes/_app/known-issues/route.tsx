import { createFileRoute } from '@tanstack/react-router'
import { knownIssues, type IssueStatus } from '@/data/known-issues'
import { colors, typography } from '@/design/tokens'

export const Route = createFileRoute('/_app/known-issues')({
  component: KnownIssuesPage,
})

const statusConfig: Record<IssueStatus, { color: string; label: string }> = {
  investigating: { color: colors.warn, label: 'Investigating' },
  fixing: { color: colors.accent, label: 'Fixing' },
  resolved: { color: colors.ok, label: 'Resolved' },
}

function KnownIssuesPage() {
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
            Known Issues
          </h1>
          <p
            className="text-sm"
            style={{
              fontFamily: typography.fontFamily,
              color: '#72708A',
            }}
          >
            Bugs we know about and are working to fix. This list is updated regularly.
          </p>
        </div>

        {/* Issues list */}
        {knownIssues.length > 0 ? (
          <div className="flex flex-col gap-3">
            {knownIssues.map((issue) => {
              const config = statusConfig[issue.status]
              return (
                <div
                  key={issue.id}
                  className="px-4 py-3.5 rounded-xl transition-all"
                  style={{ background: '#FFFFFF' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F9F8FF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FFFFFF'
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator — 7x7 colored square */}
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
                          {issue.title}
                        </h3>
                        {issue.module && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              fontFamily: typography.fontFamily,
                              fontWeight: 600,
                              background: 'rgba(99,87,232,0.08)',
                              color: colors.accent,
                            }}
                          >
                            {issue.module}
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
                        {issue.description}
                      </p>

                      {/* Status + date */}
                      <div className="flex items-center gap-2 mt-2">
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
                        {issue.eta && (
                          <span
                            className="text-[10px]"
                            style={{
                              fontFamily: typography.fontFamily,
                              fontWeight: 500,
                              color: '#B0AEBE',
                            }}
                          >
                            ETA:{' '}
                            {new Date(issue.eta + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                        <span
                          className="text-[10px]"
                          style={{
                            fontFamily: typography.fontFamily,
                            fontWeight: 500,
                            color: '#B0AEBE',
                          }}
                        >
                          Reported{' '}
                          {new Date(issue.reported + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="text-center py-16 rounded-xl"
            style={{ background: '#FFFFFF' }}
          >
            <p
              className="text-sm"
              style={{
                fontFamily: typography.fontFamily,
                fontWeight: 600,
                color: '#0F0E13',
              }}
            >
              No known issues
            </p>
            <p
              className="text-xs mt-1"
              style={{
                fontFamily: typography.fontFamily,
                color: '#72708A',
              }}
            >
              Everything is running smoothly.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p
            className="text-xs"
            style={{
              fontFamily: typography.fontFamily,
              color: '#B0AEBE',
            }}
          >
            Found a bug? Let your admin know and we'll add it here.
          </p>
        </div>
      </div>
    </div>
  )
}
