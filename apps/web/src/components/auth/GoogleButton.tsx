import { colors } from '@/design/tokens'

interface GoogleButtonProps {
  onClick?: () => void
  disabled?: boolean
  text?: string
}

export function GoogleButton({ onClick, disabled = false, text = 'Continue with Google' }: GoogleButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      // Default behavior: redirect to Google OAuth endpoint (via Vite proxy)
      window.location.href = '/api/v1/auth/google'
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      type="button"
      className="w-full flex items-center justify-center gap-3 h-12 rounded-xl transition-all disabled:opacity-50"
      style={{
        border: 'none',
        background: colors.ink50,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.ink100
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.ink50
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M19.8055 10.2292C19.8055 9.55056 19.7495 8.86667 19.6284 8.19778H10.2V12.0489H15.6017C15.3775 13.2911 14.6571 14.3898 13.6026 15.0878V17.5866H16.8235C18.7134 15.8455 19.8055 13.2722 19.8055 10.2292Z"
          fill="#4285F4"
        />
        <path
          d="M10.2 20C12.9593 20 15.2672 19.1044 16.8281 17.5866L13.6072 15.0878C12.7116 15.6977 11.5557 16.0422 10.2046 16.0422C7.53455 16.0422 5.28768 14.2833 4.48452 11.9088H1.15503V14.4855C2.75158 17.6555 6.29893 20 10.2 20Z"
          fill="#34A853"
        />
        <path
          d="M4.47984 11.9088C4.06039 10.6666 4.06039 9.33776 4.47984 8.09554V5.51886H1.15502C-0.385007 8.59109 -0.385007 12.4133 1.15502 15.4855L4.47984 11.9088Z"
          fill="#FBBC04"
        />
        <path
          d="M10.2 3.95778C11.6247 3.93556 13.0017 4.47111 14.036 5.45778L16.8934 2.60889C15.185 0.990667 12.9267 0.0906667 10.2 0.117778C6.29893 0.117778 2.75158 2.46222 1.15503 5.63778L4.47985 8.21444C5.27833 5.83556 7.52987 3.95778 10.2 3.95778Z"
          fill="#EA4335"
        />
      </svg>
      <span style={{ fontSize: 15, fontWeight: 500, color: colors.ink800 }}>{text}</span>
    </button>
  )
}
