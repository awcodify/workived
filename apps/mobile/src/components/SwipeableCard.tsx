import { useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  PanResponder,
  Dimensions,
  Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

const SCREEN_WIDTH = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4
const SWIPE_OUT_DURATION = 250

interface SwipeableCardProps {
  children: React.ReactNode
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  rightLabel?: string
  leftLabel?: string
  rightColor?: string
  leftColor?: string
  rightIcon?: keyof typeof Ionicons.glyphMap
  leftIcon?: keyof typeof Ionicons.glyphMap
}

export default function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'Approve',
  leftLabel = 'Reject',
  rightColor = '#10B981',
  leftColor = '#EF4444',
  rightIcon = 'checkmark',
  leftIcon = 'close',
}: SwipeableCardProps) {
  const position = useRef(new Animated.ValueXY()).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 })
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD && onSwipeRight) {
          // Swipe right - approve
          forceSwipe('right')
        } else if (gesture.dx < -SWIPE_THRESHOLD && onSwipeLeft) {
          // Swipe left - reject
          forceSwipe('left')
        } else {
          // Reset position
          resetPosition()
        }
      },
    })
  ).current

  const forceSwipe = (direction: 'right' | 'left') => {
    const x = direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }

    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (direction === 'right' && onSwipeRight) {
        onSwipeRight()
      } else if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft()
      }
      resetPosition()
    })
  }

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 8,
    }).start()
  }

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      outputRange: ['-5deg', '0deg', '5deg'],
      extrapolate: 'clamp',
    })

    return {
      ...styles.card,
      transform: [
        { translateX: position.x },
        { rotate },
      ],
    }
  }

  const getRightActionOpacity = () => {
    return position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    })
  }

  const getLeftActionOpacity = () => {
    return position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })
  }

  return (
    <View style={styles.container}>
      {/* Right action (approve) */}
      {onSwipeRight && (
        <Animated.View
          style={[
            styles.actionContainer,
            styles.rightAction,
            { opacity: getRightActionOpacity(), backgroundColor: rightColor },
          ]}
        >
          <Ionicons name={rightIcon} size={28} color="#FFF" />
          <Text style={styles.actionText}>{rightLabel}</Text>
        </Animated.View>
      )}

      {/* Left action (reject) */}
      {onSwipeLeft && (
        <Animated.View
          style={[
            styles.actionContainer,
            styles.leftAction,
            { opacity: getLeftActionOpacity(), backgroundColor: leftColor },
          ]}
        >
          <Ionicons name={leftIcon} size={28} color="#FFF" />
          <Text style={styles.actionText}>{leftLabel}</Text>
        </Animated.View>
      )}

      {/* Swipeable card */}
      <Animated.View
        style={getCardStyle()}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 4,
  },
  rightAction: {
    left: 0,
    right: 0,
  },
  leftAction: {
    left: 0,
    right: 0,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
})
