import { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  ActivityIndicator,
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
import type { LeaveRequestWithDetails, ClaimWithDetails } from '@/types/api'
import type { MainTabParamList } from '@/navigation'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import SwipeableCard from '@/components/SwipeableCard'
import { CustomAlert } from '@/components/CustomAlert'

const SWIPE_TOUR_KEY = '@workived_approvals_swipe_tour_seen'
const SCREEN_WIDTH = Dimensions.get('window').width

// Unified approval item type
type ApprovalItem = 
  | { type: 'leave'; data: LeaveRequestWithDetails }
  | { type: 'claim'; data: ClaimWithDetails }

function getApprovalId(item: ApprovalItem): string {
  return item.data.id
}

function formatCurrency(amount: number, currencyCode: string): string {
  const majorAmount = amount / 100
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return formatter.format(majorAmount)
}

type ApprovalTab = 'leave' | 'claim'

export default function ApprovalsScreen({ route }: BottomTabScreenProps<MainTabParamList, 'Approvals'>) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ApprovalTab>('leave')
  const [refreshing, setRefreshing] = useState(false)
  const [showSwipeTour, setShowSwipeTour] = useState(false)
  const [isTourAnimating, setIsTourAnimating] = useState(false)
  const tourTranslateX = useRef(new Animated.Value(0)).current
  const tourOpacity = useRef(new Animated.Value(0)).current
  
  // Alert states
  const [showApproveAlert, setShowApproveAlert] = useState(false)
  const [showRejectAlert, setShowRejectAlert] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [selectedRequestType, setSelectedRequestType] = useState<'leave' | 'claim'>('leave')

  // Sync tab from route params (e.g., navigating from Home screen)
  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab)
    }
  }, [route.params?.tab])

  const { data: approvalsData, isLoading: isLoadingLeave, refetch: refetchLeave } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => apiClient.getPendingApprovals(),
  })

  const { data: claimsData, isLoading: isLoadingClaims, refetch: refetchClaims } = useQuery({
    queryKey: ['approvals', 'claims', 'pending'],
    queryFn: () => apiClient.getPendingClaims(),
  })

  const isLoading = isLoadingLeave || isLoadingClaims

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
      setAlertMessage('Request approved successfully')
      setShowSuccessAlert(true)
    },
    onError: (error: any) => {
      setAlertMessage(error.response?.data?.error?.message || 'Failed to approve request')
      setShowErrorAlert(true)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => apiClient.rejectLeaveRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      setAlertMessage('Request rejected')
      setShowSuccessAlert(true)
    },
    onError: (error: any) => {
      setAlertMessage(error.response?.data?.error?.message || 'Failed to reject request')
      setShowErrorAlert(true)
    },
  })

  const approveClaimMutation = useMutation({
    mutationFn: (claimId: string) => apiClient.approveClaim(claimId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      setAlertMessage('Claim approved successfully')
      setShowSuccessAlert(true)
    },
    onError: (error: any) => {
      setAlertMessage(error.response?.data?.error?.message || 'Failed to approve claim')
      setShowErrorAlert(true)
    },
  })

  const rejectClaimMutation = useMutation({
    mutationFn: (claimId: string) => apiClient.rejectClaim(claimId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      setAlertMessage('Claim rejected')
      setShowSuccessAlert(true)
    },
    onError: (error: any) => {
      setAlertMessage(error.response?.data?.error?.message || 'Failed to reject claim')
      setShowErrorAlert(true)
    },
  })

  const handleApprove = async (requestId: string, type: 'leave' | 'claim') => {
    setSelectedRequestId(requestId)
    setSelectedRequestType(type)
    setShowApproveAlert(true)
  }

  const handleReject = async (requestId: string, type: 'leave' | 'claim') => {
    setSelectedRequestId(requestId)
    setSelectedRequestType(type)
    setShowRejectAlert(true)
  }

  const confirmApprove = () => {
    if (selectedRequestId) {
      if (selectedRequestType === 'claim') {
        approveClaimMutation.mutate(selectedRequestId)
      } else {
        approveMutation.mutate(selectedRequestId)
      }
    }
    setShowApproveAlert(false)
    setSelectedRequestId(null)
  }

  const confirmReject = () => {
    if (selectedRequestId) {
      if (selectedRequestType === 'claim') {
        rejectClaimMutation.mutate(selectedRequestId)
      } else {
        rejectMutation.mutate(selectedRequestId)
      }
    }
    setShowRejectAlert(false)
    setSelectedRequestId(null)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchLeave(), refetchClaims()])
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

  const getRequestType = (item: ApprovalItem): 'leave' | 'claim' => {
    return item.type
  }

  const getRequestTypeIcon = (type: 'leave' | 'claim'): keyof typeof Ionicons.glyphMap => {
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

  const renderApprovalCard = ({ item, index }: { item: ApprovalItem; index: number }) => {
    const isPending = approveMutation.isPending || rejectMutation.isPending || approveClaimMutation.isPending || rejectClaimMutation.isPending
    const requestType = item.type

    return (
      <SwipeableCard
        onSwipeRight={() => handleApprove(item.data.id, requestType)}
        onSwipeLeft={() => handleReject(item.data.id, requestType)}
        rightLabel="Approve"
        leftLabel="Reject"
        rightColor="#10B981"
        leftColor="#EF4444"
        rightIcon="checkmark-circle"
        leftIcon="close-circle"
        disabled={isPending}
      >
        <View style={styles.cardContent}>
          {/* Request Type Full-Width Top Banner */}
          <View style={[styles.notchBadge, { backgroundColor: getRequestTypeColor(requestType) }]}>
            <Ionicons 
              name={getRequestTypeIcon(requestType)} 
              size={12} 
              color="#FFF" 
            />
            <Text style={styles.notchText}>
              {requestType === 'leave' ? 'Leave Request' : 'Claim Request'}
            </Text>
          </View>

          <View style={styles.cardBody}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.data.employee_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.employeeName}>{item.data.employee_name}</Text>
                <Text style={styles.policyName}>
                  {item.type === 'leave' ? item.data.policy_name : item.data.category_name}
                </Text>
              </View>
              {item.type === 'leave' ? (
                <View style={styles.daysContainer}>
                  <Text style={styles.daysValue}>{item.data.total_days}</Text>
                  <Text style={styles.daysLabel}>{item.data.total_days === 1 ? 'day' : 'days'}</Text>
                </View>
              ) : (
                <View style={[styles.daysContainer, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={[styles.daysValue, { color: '#F59E0B', fontSize: 16 }]}>
                    {formatCurrency(item.data.amount, item.data.currency_code)}
                  </Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.cardDivider} />

            {/* Date */}
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.dateText}>
                {item.type === 'leave' 
                  ? formatDateRange(item.data.start_date, item.data.end_date)
                  : formatDate(item.data.claim_date)
                }
              </Text>
            </View>

            {/* Reason/Description */}
            {item.type === 'leave' && item.data.reason && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason</Text>
                <Text style={styles.reasonText}>{item.data.reason}</Text>
              </View>
            )}
            {item.type === 'claim' && item.data.description && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Description</Text>
                <Text style={styles.reasonText}>{item.data.description}</Text>
              </View>
            )}

            {/* Swipe hint */}
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal" size={14} color="#D1D5DB" />
              <Text style={styles.swipeHintText}>Swipe to approve or reject</Text>
            </View>
          </View>
        </View>
      </SwipeableCard>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      </SafeAreaView>
    )
  }

  const leaveApprovals: ApprovalItem[] = (approvalsData?.data || []).map(item => ({ type: 'leave' as const, data: item }))
  const claimApprovals: ApprovalItem[] = (claimsData?.data || []).map(item => ({ type: 'claim' as const, data: item }))
  const filteredApprovals = activeTab === 'leave' ? leaveApprovals : claimApprovals
  const totalCount = leaveApprovals.length + claimApprovals.length

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.subtitle}>
            {totalCount === 0 
              ? 'No pending approvals' 
              : `${totalCount} pending ${totalCount === 1 ? 'request' : 'requests'}`
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

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leave' && styles.tabActive]}
          onPress={() => setActiveTab('leave')}
        >
          <Ionicons name="calendar" size={16} color={activeTab === 'leave' ? '#6357E8' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'leave' && styles.tabTextActive]}>
            Leave ({leaveApprovals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'claim' && styles.tabActive]}
          onPress={() => setActiveTab('claim')}
        >
          <Ionicons name="receipt" size={16} color={activeTab === 'claim' ? '#F59E0B' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'claim' && styles.tabTextActive]}>
            Claims ({claimApprovals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tutorial Overlay */}
      {showSwipeTour && filteredApprovals.length > 0 && (
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
              {/* Request Type Full-Width Top Banner */}
              <View style={[styles.notchBadge, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="calendar-outline" size={12} color="#FFF" />
                <Text style={styles.notchText}>Leave Request</Text>
              </View>

              <View style={styles.cardBody}>
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

                <View style={styles.cardDivider} />

                {/* Date Range */}
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.dateText}>Apr 7 - Apr 9, 2026</Text>
                </View>

                {/* Reason */}
                <View style={styles.reasonContainer}>
                  <Text style={styles.reasonLabel}>Reason</Text>
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
            </View>
          </Animated.View>
        </View>
      )}

      {filteredApprovals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name={activeTab === 'leave' ? 'calendar-outline' : 'receipt-outline'} 
            size={64} 
            color="#6B7280" 
          />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>
            No pending {activeTab === 'leave' ? 'leave requests' : 'claims'} at this moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredApprovals}
          renderItem={renderApprovalCard}
          keyExtractor={(item) => `${item.type}-${item.data.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <CustomAlert
        visible={showApproveAlert}
        title="Approve Request"
        message="Are you sure you want to approve this request?"
        icon="checkmark-circle"
        iconColor="#10B981"
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowApproveAlert(false)
              setSelectedRequestId(null)
            },
          },
          {
            text: 'Approve',
            style: 'primary',
            onPress: confirmApprove,
          },
        ]}
        onDismiss={() => {
          setShowApproveAlert(false)
          setSelectedRequestId(null)
        }}
      />

      <CustomAlert
        visible={showRejectAlert}
        title="Reject Request"
        message="Are you sure you want to reject this request?"
        icon="close-circle"
        iconColor="#EF4444"
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowRejectAlert(false)
              setSelectedRequestId(null)
            },
          },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: confirmReject,
          },
        ]}
        onDismiss={() => {
          setShowRejectAlert(false)
          setSelectedRequestId(null)
        }}
      />

      <CustomAlert
        visible={showSuccessAlert}
        title="Success"
        message={alertMessage}
        icon="checkmark-circle"
        iconColor="#10B981"
        buttons={[
          {
            text: 'OK',
            style: 'primary',
            onPress: () => setShowSuccessAlert(false),
          },
        ]}
        onDismiss={() => setShowSuccessAlert(false)}
      />

      <CustomAlert
        visible={showErrorAlert}
        title="Error"
        message={alertMessage}
        icon="alert-circle"
        iconColor="#EF4444"
        buttons={[
          {
            text: 'OK',
            style: 'cancel',
            onPress: () => setShowErrorAlert(false),
          },
        ]}
        onDismiss={() => setShowErrorAlert(false)}
      />
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
    paddingBottom: 12,
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
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
    backgroundColor: '#FFF',
    paddingBottom: 14,
  },
  notchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 14,
  },
  notchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingHorizontal: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  policyName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  daysContainer: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  daysValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6357E8',
  },
  daysLabel: {
    fontSize: 10,
    color: '#6357E8',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  reasonContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  swipeHintText: {
    fontSize: 11,
    color: '#D1D5DB',
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
