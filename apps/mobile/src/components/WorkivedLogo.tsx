import Svg, { Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { View, Text, StyleSheet } from 'react-native'

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

export default function WorkivedLogo({ 
  size = 40, 
  showWordmark = true,
  variant = 'gradient'
}: WorkivedLogoProps) {
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
    <View style={[styles.container, showWordmark && styles.withWordmark]}>
      <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
        {isGradient && (
          <Defs>
            <LinearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#9B8FF7" />
              <Stop offset="100%" stopColor="#6357E8" />
            </LinearGradient>
          </Defs>
        )}
        
        {/* Background rounded rectangle */}
        <Rect 
          width="180" 
          height="180" 
          rx="30" 
          fill={isGradient ? 'url(#logoGradient)' : colors.bg}
        />
        
        {/* W letter */}
        <SvgText
          x="90"
          y="112"
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="108"
          fontWeight="800"
          fill={colors.text}
          fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          W
        </SvgText>

        {/* Accent bar */}
        <Rect 
          x="55" 
          y="150" 
          width="70" 
          height="10" 
          rx="5" 
          fill={colors.accent}
          opacity={variant === 'light' ? 0.5 : 0.7}
        />
      </Svg>
      
      {showWordmark && (
        <Text style={[
          styles.wordmark,
          { fontSize: size * 0.65 },
          variant === 'light' && styles.wordmarkLight
        ]}>
          Workived
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  withWordmark: {
    flexDirection: 'row',
    gap: 12,
  },
  wordmark: {
    fontWeight: '800',
    color: '#0F0E13',
    letterSpacing: -0.5,
  },
  wordmarkLight: {
    color: '#FFFFFF',
  },
})
