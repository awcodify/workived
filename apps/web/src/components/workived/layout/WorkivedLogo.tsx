/**
 * WorkivedLogo — Official Workived logo component
 * 
 * A layered geometric icon representing team structure and organization.
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
        return { primary: '#FFFFFF', secondary: 'rgba(255,255,255,0.7)' }
      case 'dark':
        return { primary: '#9B8FF7', secondary: '#6357E8' }
      case 'gradient':
      default:
        return { primary: '#9B8FF7', secondary: '#6357E8' }
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
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isGradient && (
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
            </defs>
          )}
          
          {/* Base layer - largest */}
          <path
            d="M20 8L8 14L20 20L32 14L20 8Z"
            fill={isGradient ? 'url(#logoGradient)' : colors.primary}
            opacity={0.9}
          />
          
          {/* Middle layer */}
          <path
            d="M8 22L20 28L32 22"
            stroke={isGradient ? 'url(#logoGradient)' : colors.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
          
          {/* Top layer */}
          <path
            d="M8 28L20 34L32 28"
            stroke={isGradient ? 'url(#logoGradient)' : colors.secondary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
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
