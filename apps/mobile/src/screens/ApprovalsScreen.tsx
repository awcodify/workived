import { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from '@/api/client'
import type { LeaveRequestWithDetails } from '@/types/api'
import SwipeableCard from '@/components/SwipeableCard'

const SWIPE_TOUR_KEY = '@workived_approvals_swipe_tour_seen'
const SCREEN_WIDTH = Dimensions.get('window').width

export default function ApprovalsScreen() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [showSwipeTour, setShowSwipeTour] = useState(false)
  const [isTourAnimating, setIsTourAnimating] = useState(false)
  const tourTranslateX = useRef(new Animated.Value(0)).current
  const tourOpacity = useRef(new Animated.Value(0)).current

  const { data: approvalsData, isLoading, refetch } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => apiClient.getPendingApprovals(),
  })

  // Check if user has seen the swipe tour
  useEffect(() => {
    const checkSwipeTour = async () => {
      try {
        const seen = await AsyncStorage.getItem(SWIPE_TOUR_KEY)
        console.log('Swipe tour seen:', seen)
        if (!seen) {
          console.log('Setting showSwipeTour to true')
          setShowSwipeTour(true)
        }
      } catch (error) {
        console.error('Error checking swipe tour:', error)
      }
    }
    checkSwipeTour()
  }, [])

  // Mark swipe tour as seen after animation completes
  useEffect(() => {
    if (showSwipeTour && !isTourAnimating) {
      console.log('Starting tour animation')
      setIsTourAnimating(true)
      
      // Fade in
      Animated.timing(tourOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Wait 1 second
        setTimeout(() => {
          // Swipe right (approve)
          Animated.sequence([
            Animated.timing(tourTranslateX, {
              toValue: SCREEN_WIDTH * 0.5,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(tourTranslateX, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(500),
            // Swipe left (reject)
            Animated.timing(tourTranslateX, {
              toValue: -SCREEN_WIDTH * 0.5,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(tourTranslateX, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(800),
            // Fade out
            Animated.timing(tourOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(async () => {
            try {
              await AsyncStorage.setItem(SWIPE_TOUR_KEY, 'true')
              setShowSwipeTour(false)
              setIsTourAnimating(false)
              console.log('Tour animation complete')
            } catch (error) {
              console.error('Error saving tour state:', error)
            }
          })
        }, 1000)
      })
    }
  }, [showSwipeTour, isTourAnimating, tourOpacity, tourTranslateX])

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => apiClient.approveLeaveRequest(requestId),
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      Alert.alert('Success', 'Request approved successfully')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to approve request')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => apiClient.rejectLeaveRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      Alert.alert('Success', 'Request rejected')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reject request')
    },
  })

  const handleApprove = async (requestId: string) => {
    Alert.alert(
      'Approve Request',
      'Are you sure you want to approve this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          style: 'default',
          onPress: () => approveMutation.mutate(requestId)
        },
      ]
    )
  }

  const handleReject = async (requestId: string) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: () => rejectMutation.mutate(requestId)
        },
      ]
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateRange = (start: string, end: string) => {
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  const getRequestType = (policyName: string): 'leave' | 'claim' => {
    // For now, all items from /leave/requests are leave requests
    // When claims are added, this will check the policy type or use a type field
    return 'leave'
  }

  const getRequestTypeIcon = (type: 'leave' | 'claim') => {
    return type === 'leave' ? 'calendar' : 'receipt'
  }

  const getRequestTypeColor = (type: 'leave' | 'claim') => {
    return type === 'leave' ? '#6357E8' : '#F59E0B'
  }

  const resetTour = async () => {
    try {
      await AsyncStorage.removeItem(SWIPE_TOUR_KEY)
      setShowSwipeTour(true)
      setIsTourAnimating(false)
      tourTranslateX.setValue(0)
      tourOpacity.setValue(0)
      console.log('Tour reset - will show animation')
    } catch (error) {
      console.error('Error resetting tour:', error)
    }
  }

  const renderApprovalCard = ({ item, index }: { item: LeaveRequestWithDetails; index: number }) => {
    const isPending = approveMutation.isPending || rejectMutation.isPending
    const requestType = getRequestType(item.policy_name)

    return (
      <SwipeableCard
        onSwipeRight={() => handleApprove(item.id)}
        onSwipeLeft={() => handleReject(item.id)}
        rightLabel="Approve"
        leftLabel="Reject"
        rightColor="#10B981"
        leftColor="#EF4444"
        rightIcon="checkmark-circle"
        leftIcon="close-circle"
        disabled={isPending}
      >
        <View style={styles.cardContent}>
          {/* Request Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: getRequestTypeColor(requestType) + '15' }]}>
            <Ionicons 
              name={getRequestTypeIcon(requestType)} 
              size={12} 
              color={getRequestTypeColor(requestType)} 
            />
            <Text style={[styles.typeText, { color: getRequestTypeColor(requestType) }]}>
              {requestType === 'leave' ? 'Leave Request' : 'Claim Request'}
            </Text>
          </View>

          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.employee_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.employeeName}>{item.employee_name}</Text>
              <Text style={styles.policyName}>{item.policy_name}</Text>
            </View>
            <View style={styles.daysContainer}>
              <Text style={styles.daysValue}>{item.total_days}</Text>
              <Text style={styles.daysLabel}>{item.total_days === 1 ? 'day' : 'days'}</Text>
            </View>
          </View>

          {/* Date Range */}
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.dateText}>{formatDateRange(item.start_date, item.end_date)}</Text>
          </View>

          {/* Reason */}
          {item.reason && (
            <View style={styles.reasonContainer}>
              <Text style={styles.reasonLabel}>Reason:</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          )}
        </View>
      </SwipeableCard>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      </SafeAreaView>
    )
  }

  const approvals = approvalsData?.data || []

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.subtitle}>
            {approvals.length === 0 
              ? 'No pending approvals' 
              : `${approvals.length} pending ${approvals.length === 1 ? 'request' : 'requests'}`
            }
          </Text>
        </View>
        {/* Debug button - remove in production */}
        {__DEV__ && (
          <TouchableOpacity style={styles.debugButton} onPress={resetTour}>
            <Ionicons name="refresh" size={20} color="#6357E8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tutorial Overlay */}
      {showSwipeTour && approvals.length > 0 && (
        <View style={styles.tutorialOverlay} pointerEvents="none">
          <Animated.View 
            style={[
              styles.tutorialCard,
              {
                opacity: tourOpacity,
                transform: [{ translateX: tourTranslateX }],
              },
            ]}
          >
            <View style={styles.cardContent}>
              {/* Request Type Badge */}
              <View style={[styles.typeBadge, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="calendar-outline" size={12} color="#8B5CF6" />
                <Text style={[styles.typeText, { color: '#8B5CF6' }]}>Leave Request</Text>
              </View>

              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>J</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.employeeName}>John Doe</Text>
                  <Text style={styles.policyName}>Annual Leave</Text>
                </View>
                <View style={styles.daysContainer}>
                  <Text style={styles.daysValue}>3</Text>
                  <Text style={styles.daysLabel}>days</Text>
                </View>
              </View>

              {/* Date Range */}
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text style={styles.dateText}>Apr 7 - Apr 9, 2026</Text>
              </View>

              {/* Reason */}
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>Family vacation</Text>
              </View>

              {/* Tutorial Instructions */}
              <View style={styles.tutorialInstructions}>
                <View style={styles.tutorialSwipeHint}>
                  <Ionicons name="arrow-forward" size={24} color="#10B981" />
                  <Text style={styles.tutorialSwipeText}>Swipe right to approve</Text>
                </View>
                <View style={styles.tutorialSwipeHint}>
                  <Ionicons name="arrow-back" size={24} color="#EF4444" />
                  <Text style={styles.tutorialSwipeText}>Swipe left to reject</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {approvals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending approvals at this moment</Text>
        </View>
      ) : (
        <FlatList
          data={approvals}
          renderItem={renderApprovalCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  debugButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  cardContent: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6357E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  policyName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  daysContainer: {
    alignItems: 'center',
  },
  daysValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6357E8',
  },
  daysLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  reasonContainer: {
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 3,
  },
  reasonText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  tutorialCard: {
    width: SCREEN_WIDTH - 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tutorialInstructions: {
    gap: 8,
    marginTop: 8,
  },
  tutorialSwipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  tutorialSwipeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
})
