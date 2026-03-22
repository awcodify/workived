import { useState, useEffect } from 'react'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { typography } from '@/design/tokens'

interface DateTimeProps {
  textColor: string
  textMutedColor: string
  borderColor: string
}

export function DateTime({ textColor, textMutedColor, borderColor }: DateTimeProps) {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const clock = useLiveClock(tz)

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4" style={{ minHeight: 38 }}>
      <p
        className="uppercase"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: textMutedColor,
          letterSpacing: '0.10em',
          lineHeight: 1.2,
        }}
      >
        {formatDateLabel(tz)}
      </p>
      <span className="hidden md:block" style={{ width: 1, height: 22, background: borderColor, borderRadius: 2 }} />
      <div className="flex items-baseline gap-2">
        <p
          style={{
            fontFamily: typography.fontMono,
            fontSize: 22,
            fontWeight: 700,
            color: textColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {clock.time}
        </p>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: textMutedColor,
            letterSpacing: '0.05em',
          }}
        >
          {clock.period}
        </span>
      </div>
    </div>
  )
}

function useLiveClock(tz: string) {
  const [clock, setClock] = useState(() => formatTime(tz))
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime(tz)), 1000)
    return () => clearInterval(id)
  }, [tz])
  return clock
}

function formatTime(tz: string) {
  const now = new Date()
  const time = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now)
  // Split into time and period (e.g. "06:23:10 PM")
  const parts = time.match(/^(.+?)\s*(AM|PM)$/i)
  if (parts) return { time: parts[1]!.trim(), period: parts[2]!.toUpperCase() }
  return { time, period: '' }
}

function formatDateLabel(tz: string) {
  const now = new Date()
  const day = new Intl.DateTimeFormat('en', { timeZone: tz, weekday: 'long' }).format(now).toUpperCase()
  const date = new Intl.DateTimeFormat('en', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(now).toUpperCase()
  return `${day} \u00B7 ${date}`
}
