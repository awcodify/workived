/**
 * WorkivedLogo — Official Workived logo component
 * 
 * A layered geometric icon with stacked bars representing organization hierarchy.
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
          viewBox="0 0 48 48"
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
          
          {/* Background rounded rectangle */}
          <rect 
            x="1" 
            y="1" 
            width="46" 
            height="46" 
            rx="12" 
            fill={isGradient ? 'url(#logoGradient)' : colors.primary}
          />
          
          {/* Top bar - shortest */}
          <rect 
            x="16" 
            y="11" 
            width="22" 
            height="7" 
            rx="3" 
            fill={variant === 'light' ? 'rgba(0,0,0,0.35)' : 'white'} 
            opacity="0.35"
          />
          
          {/* Middle bar - medium */}
          <rect 
            x="13" 
            y="19" 
            width="24" 
            height="7" 
            rx="3" 
            fill={variant === 'light' ? 'rgba(0,0,0,0.6)' : 'white'} 
            opacity="0.6"
          />
          
          {/* Bottom bar - longest */}
          <rect 
            x="10" 
            y="27" 
            width="26" 
            height="7" 
            rx="3" 
            fill={variant === 'light' ? 'rgba(0,0,0,1)' : 'white'}
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
