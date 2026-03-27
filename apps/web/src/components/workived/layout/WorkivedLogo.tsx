/**
 * WorkivedLogo — Official Workived logo component
 * 
 * A rounded square with bold W letter and accent bar below.
 * Can be used with or without the wordmark.
 */

interface WorkivedLogoProps {
  size?: number
  showWordmark?: boolean
  variant?: 'light' | 'dark' | 'gradient'
}

export function WorkivedLogo({ size = 40, showWordmark = true, variant = 'gradient' }: WorkivedLogoProps) {
  const getColors = () => {
    switch (variant) {
      case 'light':
        return { bg: '#6357E8', text: '#FFFFFF', accent: '#FFFFFF' }
      case 'dark':
        return { bg: '#6357E8', text: '#FFFFFF', accent: '#FFFFFF' }
      case 'gradient':
      default:
        return { bg: '#6357E8', text: '#FFFFFF', accent: '#FFFFFF' }
    }
  }

  const colors = getColors()
  const isGradient = variant === 'gradient'

  return (
    <div className="inline-flex items-center gap-3">
      {/* Icon */}
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 180 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isGradient && (
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9B8FF7" />
                <stop offset="100%" stopColor="#6357E8" />
              </linearGradient>
            </defs>
          )}
          
          {/* Background rounded rectangle */}
          <rect 
            width="180" 
            height="180" 
            rx="30" 
            fill={isGradient ? 'url(#logoGradient)' : colors.bg}
          />
          
          {/* W letter */}
          <text
            x="90"
            y="112"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: '108px',
              fontWeight: 800,
              fill: colors.text,
            }}
          >
            W
          </text>

          {/* Accent bar */}
          <rect 
            x="55" 
            y="150" 
            width="70" 
            height="10" 
            rx="5" 
            fill={colors.accent}
            opacity={variant === 'light' ? 0.5 : 0.7}
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <span
          style={{
            fontSize: size * 0.65,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: variant === 'light' ? '#FFFFFF' : '#0F0E13',
          }}
        >
          Workived
        </span>
      )}
    </div>
  )
}
