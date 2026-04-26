import { useEffect, useRef, useState } from 'react'
import { typography } from '@/design/tokens'

// ── Phase state machine ──────────────────────────────────────────

type Phase =
  | 'idle'       // card in col1, col3 collapsed strip
  | 'lifting'    // card rises, ghost placeholder appears
  | 'moving'     // card slides to col2
  | 'settled'    // card lands in col2, "click to expand" hint appears
  | 'clicking'   // ripple fires on collapsed strip
  | 'expanding'  // col3 strip widens
  | 'expanded'   // col3 fully open
  | 'fading'     // white overlay fades in before reset

const SEQUENCE: Phase[] = ['idle', 'lifting', 'moving', 'settled', 'clicking', 'expanding', 'expanded', 'fading']
const DURATIONS: Record<Phase, number> = {
  idle: 1400,
  lifting: 350,
  moving: 700,
  settled: 700,
  clicking: 480,
  expanding: 550,
  expanded: 1200,
  fading: 350,
}

// ── Layout constants ─────────────────────────────────────────────

const COL_W = 100       // expanded column px width
const STRIP_W = 28      // collapsed strip px width
const GAP = 4           // column gap px
const CONTAINER_W = COL_W * 3 + GAP * 2  // 308
const CONTAINER_H = 178

// Card starts in col1 (padding 6px from col edge)
const CARD_X1 = 6
const CARD_Y = 50       // below column header
// Card lands in col2 (col2 starts at COL_W + GAP)
const CARD_X2 = COL_W + GAP + 6

// Strip center (for click ripple)
const STRIP_CENTER_X = COL_W * 2 + GAP * 2 + STRIP_W / 2  // 222

// ── Component ───────────────────────────────────────────────────

export function TaskBoardDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const idx = SEQUENCE.indexOf(phase)
    timer.current = setTimeout(() => {
      const next = SEQUENCE[idx + 1]
      setPhase(next ?? 'idle')
    }, DURATIONS[phase])
    return () => clearTimeout(timer.current)
  }, [phase])

  const cardInCol1 = phase === 'idle'
  const isFloating = phase === 'lifting' || phase === 'moving'
  const cardInCol2 = phase === 'settled' || phase === 'clicking' || phase === 'expanding' || phase === 'expanded' || phase === 'fading'
  const col3Open = phase === 'expanding' || phase === 'expanded' || phase === 'fading'
  const showHint = phase === 'settled' || phase === 'clicking'
  const showRipple = phase === 'clicking'
  const fading = phase === 'fading'

  const floatX = phase === 'moving' ? CARD_X2 : CARD_X1
  const floatRotate = phase === 'lifting' ? 2 : 0

  return (
    <div
      data-testid="task-board-demo"
      style={{
        position: 'relative',
        width: CONTAINER_W,
        height: CONTAINER_H,
        fontFamily: typography.fontFamily,
        overflow: 'hidden',
        borderRadius: 12,
      }}
    >
      <style>{`
        @keyframes demo-ripple {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
        @keyframes demo-hint-in {
          0%   { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Column row */}
      <div style={{ display: 'flex', gap: GAP, height: '100%' }}>
        {/* Col 1 — To Do */}
        <DemoColumn title="To Do" color="#6366F1" width={COL_W}>
          {isFloating && <CardGhost />}
          {cardInCol1 && <DemoCard title="Fix login bug" priority="high" />}
          <DemoCard title="Add search" priority="low" />
        </DemoColumn>

        {/* Col 2 — In Progress */}
        <DemoColumn title="In Progress" color="#12A05C" width={COL_W}>
          {cardInCol2 && (
            <DemoCard
              title="Fix login bug"
              priority="high"
              highlight={phase === 'settled'}
            />
          )}
          <DemoCard title="Write tests" priority="medium" />
        </DemoColumn>

        {/* Col 3 — Review (collapsed strip → expanded) */}
        <DemoColumn
          title="Review"
          color="#C97B2A"
          width={col3Open ? COL_W : STRIP_W}
          collapsed={!col3Open}
          pulseBorder={phase === 'expanding'}
        >
          {col3Open && <DemoCard title="Design review" priority="medium" />}
        </DemoColumn>
      </div>

      {/* "Click to expand" hint label above the collapsed strip */}
      {showHint && (
        <div
          data-testid="task-board-demo-hint"
          style={{
            position: 'absolute',
            left: STRIP_CENTER_X,
            top: 8,
            transform: 'translateX(-50%)',
            animation: 'demo-hint-in 0.2s ease forwards',
            background: '#1E293B',
            color: 'white',
            fontSize: 8,
            fontWeight: 700,
            padding: '3px 7px',
            borderRadius: 5,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 6,
            opacity: showRipple ? 0 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          click to expand
          {/* Arrow pointing down */}
          <div style={{
            position: 'absolute',
            bottom: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1E293B',
          }} />
        </div>
      )}

      {/* Click ripple on collapsed strip */}
      {showRipple && (
        <div
          data-testid="task-board-demo-ripple"
          style={{
            position: 'absolute',
            left: STRIP_CENTER_X,
            top: CONTAINER_H / 2,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          {/* Center dot */}
          <div style={{
            position: 'absolute',
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#6366F1',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
          }} />
          {/* Expanding ring */}
          <div style={{
            position: 'absolute',
            width: 22, height: 22,
            borderRadius: '50%',
            border: '2px solid #6366F1',
            animation: 'demo-ripple 0.45s ease-out forwards',
            top: '50%', left: '50%',
          }} />
        </div>
      )}

      {/* Floating card during drag */}
      {isFloating && (
        <div
          data-testid="task-board-demo-floating-card"
          style={{
            position: 'absolute',
            top: CARD_Y,
            left: floatX,
            transition:
              phase === 'moving'
                ? 'left 0.7s cubic-bezier(0.34, 1.3, 0.64, 1), transform 0.3s ease'
                : 'transform 0.25s ease',
            transform: `rotate(${floatRotate}deg) translateY(${phase === 'lifting' ? -4 : 0}px)`,
            zIndex: 10,
            boxShadow: '0 10px 28px rgba(0,0,0,0.2)',
            borderRadius: 7,
          }}
        >
          <DemoCard title="Fix login bug" priority="high" floating />
        </div>
      )}

      {/* Fade overlay for loop reset */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'white',
          borderRadius: 12,
          opacity: fading ? 1 : 0,
          transition: fading ? 'opacity 0.35s ease' : 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function DemoColumn({
  title,
  color,
  width,
  collapsed = false,
  pulseBorder = false,
  children,
}: {
  title: string
  color: string
  width: number
  collapsed?: boolean
  pulseBorder?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      data-testid={`demo-column-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        width,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.72)',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'width 0.55s cubic-bezier(0.34, 1.2, 0.64, 1), border-color 0.3s, box-shadow 0.3s',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${pulseBorder ? color : 'rgba(0,0,0,0.09)'}`,
        boxShadow: pulseBorder ? `0 0 0 3px ${color}30` : 'none',
      }}
    >
      {collapsed ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: 8,
            fontWeight: 700,
            color: '#94A3B8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          {title}
        </div>
      ) : (
        <>
          <div
            style={{
              padding: '8px 8px 6px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {title}
            </span>
          </div>
          <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

const PRIORITY_DOT: Record<string, string> = {
  high: '#D44040',
  medium: '#C97B2A',
  low: '#12A05C',
}

function DemoCard({
  title,
  priority,
  highlight = false,
  floating = false,
}: {
  title: string
  priority: 'high' | 'medium' | 'low'
  highlight?: boolean
  floating?: boolean
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 7,
        padding: '6px 8px',
        border: `1px solid ${highlight ? '#6366F1' : 'rgba(0,0,0,0.09)'}`,
        boxShadow: floating
          ? '0 10px 28px rgba(0,0,0,0.18)'
          : highlight
          ? '0 0 0 2px #6366F133'
          : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        cursor: floating ? 'grabbing' : 'default',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: 1,
            background: PRIORITY_DOT[priority],
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#334155',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
      </div>
    </div>
  )
}

function CardGhost() {
  return (
    <div
      data-testid="task-board-demo-ghost"
      style={{
        borderRadius: 7,
        padding: '6px 8px',
        border: '1.5px dashed #CBD5E1',
        background: 'rgba(99,102,241,0.04)',
        height: 33,
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  )
}
