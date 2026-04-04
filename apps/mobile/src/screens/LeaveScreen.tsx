import { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from '@/api/client'
import type { LeavePolicy, LeaveRequestWithDetails } from '@/types/api'
import DateTimePicker from '@react-native-community/datetimepicker'

const LEAVE_TOUR_KEY = '@workived_leave_apply_tour_seen'
const SCREEN_WIDTH = Dimensions.get('window').width

type ViewMode = 'list' | 'apply'

export default function LeaveScreen() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedPolicy, setSelectedPolicy] = useState<LeavePolicy | null>(null)
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date())
  const [reason, setReason] = useState('')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const hasInitialExpanded = useRef(false)
  const tourOpacity = useRef(new Animated.Value(0)).current
  const tourScale = useRef(new Animated.Value(0.8)).current

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ['leave', 'policies'],
    queryFn: () => apiClient.getLeavePolicies(),
  })

  const { data: homeData } = useQuery({
    queryKey: ['mobile', 'home'],
    queryFn: () => apiClient.getMobileHome(),
  })

  const { data: requestsData } = useQuery({
    queryKey: ['leave', 'requests', 'me'],
    queryFn: () => apiClient.getMyLeaveRequests(),
  })

  const applyLeaveMutation = useMutation({
    mutationFn: (data: { leave_policy_id: string; start_date: string; end_date: string; reason?: string }) =>
      apiClient.applyLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      Alert.alert('Success', 'Leave request submitted successfully')
      // Reset and go back to list
      setReason('')
      setStartDate(new Date())
      setEndDate(new Date())
      setViewMode('list')
      setSelectedPolicy(null)
      setExpandedPolicyId(null)
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to submit leave request')
    },
  })

  const handleSelectPolicy = (policy: LeavePolicy) => {
    setSelectedPolicy(policy)
    setViewMode('apply')
  }

  const handleGoBack = () => {
    setViewMode('list')
    setSelectedPolicy(null)
    setReason('')
    setStartDate(new Date())
    setEndDate(new Date())
  }

  const handleToggleExpand = (policyId: string) => {
    setExpandedPolicyId(expandedPolicyId === policyId ? null : policyId)
  }

  const handleApplyLeave = (policy: LeavePolicy) => {
    setSelectedPolicy(policy)
    setViewMode('apply')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981'
      case 'rejected':
        return '#EF4444'
      case 'cancelled':
        return '#6B7280'
      default:
        return '#F59E0B'
    }
  }

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const handleSubmit = () => {
    if (!selectedPolicy) {
      Alert.alert('Error', 'Please select a leave type')
      return
    }

    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be after start date')
      return
    }

    applyLeaveMutation.mutate({
      leave_policy_id: selectedPolicy.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      reason: reason || undefined,
    })
  }

  const calculateWorkingDays = () => {
    if (endDate < startDate) return 0
    
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const day = current.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (day !== 0 && day !== 6) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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

  const policies = policiesData?.data || []
  const leaveBalance = homeData?.leave_balance
  const myRequests = requestsData?.data || []

  // Auto-expand first policy on initial load only
  useEffect(() => {
    if (policies.length > 0 && !hasInitialExpanded.current) {
      setExpandedPolicyId(policies[0].id)
      hasInitialExpanded.current = true
    }
  }, [policies])

  // Check if user has seen the tour
  useEffect(() => {
    const checkTour = async () => {
      try {
        const seen = await AsyncStorage.getItem(LEAVE_TOUR_KEY)
        if (!seen && policies.length > 0) {
          // Show tour after a short delay
          setTimeout(() => {
            setShowTour(true)
            // Animate tour appearance
            Animated.parallel([
              Animated.timing(tourOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.spring(tourScale, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
              }),
            ]).start()

            // Auto-hide after 5 seconds
            setTimeout(async () => {
              Animated.parallel([
                Animated.timing(tourOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(tourScale, {
                  toValue: 0.8,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                setShowTour(false)
              })
              await AsyncStorage.setItem(LEAVE_TOUR_KEY, 'true')
            }, 5000)
          }, 500)
        }
      } catch (error) {
        console.error('Error checking tour:', error)
      }
    }
    checkTour()
  }, [policies, tourOpacity, tourScale])

  // Map policy name to balance key
  const getBalanceKey = (policyName: string): 'annual' | 'sick' | 'unpaid' => {
    const name = policyName.toLowerCase()
    if (name.includes('annual')) return 'annual'
    if (name.includes('sick')) return 'sick'
    return 'unpaid'
  }

  // Filter requests by policy
  const getRequestsForPolicy = (policyId: string): LeaveRequestWithDetails[] => {
    return myRequests.filter(req => req.leave_policy_id === policyId)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {viewMode === 'list' ? (
          <>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Leave Balance</Text>
            </View>
            <View style={styles.subtitleContainer}>
              <Text style={styles.subtitle}>Apply for leave or view your requests</Text>
            </View>

            {/* Leave Balance Table */}
            <View style={styles.tableWrapper}>
              <View style={styles.tableCard}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.tableColumnType]}>Type</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColumnNumber]}>Avail</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColumnNumber]}>Used</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColumnNumber]}>Total</Text>
                  <View style={styles.tableColumnAction} />
                </View>

                {/* Table Rows */}
                {policies.map((policy, index) => {
                  const balanceKey = getBalanceKey(policy.name)
                  const balance = leaveBalance ? leaveBalance[balanceKey] : 0
                  const total = policy.days_per_year
                  const used = total - balance
                  const isExpanded = expandedPolicyId === policy.id
                  const policyRequests = getRequestsForPolicy(policy.id)

                  return (
                    <View key={policy.id}>
                      {/* Table Row */}
                      <View style={[styles.tableRow, index > 0 && styles.tableRowBorder]}>
                        {/* Type Column with Icon */}
                        <TouchableOpacity 
                          style={[styles.tableCell, styles.tableColumnType]}
                          onPress={() => handleToggleExpand(policy.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.typeCell}>
                            <View style={[styles.leaveTypeIndicator, { 
                              backgroundColor: balanceKey === 'annual' ? '#3B82F6' : balanceKey === 'sick' ? '#EF4444' : '#6B7280' 
                            }]} />
                            <Text style={styles.typeCellText}>{policy.name}</Text>
                            <Ionicons 
                              name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                              size={18} 
                              color="#9CA3AF"
                              style={styles.expandIcon}
                            />
                          </View>
                        </TouchableOpacity>

                        {/* Available Column */}
                        <View style={[styles.tableCell, styles.tableColumnNumber]}>
                          <Text style={[styles.tableCellText, styles.numberText, { color: '#10B981' }]}>
                            {balance}
                          </Text>
                        </View>

                        {/* Used Column */}
                        <View style={[styles.tableCell, styles.tableColumnNumber]}>
                          <Text style={[styles.tableCellText, styles.numberText, { color: '#EF4444' }]}>
                            {used}
                          </Text>
                        </View>

                        {/* Total Column */}
                        <View style={[styles.tableCell, styles.tableColumnNumber]}>
                          <Text style={[styles.tableCellText, styles.numberText, { color: '#6B7280' }]}>
                            {total}
                          </Text>
                        </View>

                        {/* Apply Button Column */}
                        <View style={[styles.tableCell, styles.tableColumnAction]}>
                          <TouchableOpacity
                            style={styles.applyButtonSmall}
                            onPress={() => handleApplyLeave(policy)}
                          >
                            <Ionicons name="add-circle" size={18} color="#6357E8" />
                          </TouchableOpacity>
                          
                          {/* Tour Tooltip - Show on first button only */}
                          {showTour && index === 0 && (
                            <Animated.View 
                              style={[
                                styles.tourTooltip,
                                {
                                  opacity: tourOpacity,
                                  transform: [{ scale: tourScale }]
                                }
                              ]}
                            >
                              <View style={styles.tourContent}>
                                <Ionicons name="hand-left" size={16} color="#6357E8" />
                                <Text style={styles.tourText}>Tap to apply</Text>
                              </View>
                              <View style={styles.tourArrow} />
                            </Animated.View>
                          )}
                        </View>
                      </View>

                      {/* Expanded Section - Leave Requests */}
                      {isExpanded && (
                        <View style={styles.expandedSection}>
                          <View style={styles.requestsHeader}>
                            <Text style={styles.requestsTitle}>Current Requests</Text>
                            {policyRequests.length > 0 && (
                              <Text style={styles.requestsCount}>
                                {policyRequests.length} {policyRequests.length === 1 ? 'request' : 'requests'}
                              </Text>
                            )}
                          </View>

                          {policyRequests.length === 0 ? (
                            <View style={styles.emptyRequests}>
                              <Ionicons name="document-outline" size={32} color="#D1D5DB" />
                              <Text style={styles.emptyRequestsText}>No leave requests yet</Text>
                            </View>
                          ) : (
                            <View style={styles.requestsList}>
                              {policyRequests.map((request) => (
                                <View key={request.id} style={styles.requestItem}>
                                  <View style={styles.requestHeader}>
                                    <View style={styles.requestDates}>
                                      <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                      <Text style={styles.requestDateText}>
                                        {formatDateShort(request.start_date)} - {formatDateShort(request.end_date)}
                                      </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                                      <Text style={styles.statusText}>
                                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={styles.requestDetails}>
                                    <Text style={styles.requestDays}>
                                      {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                                    </Text>
                                    {request.reason && (
                                      <Text style={styles.requestReason} numberOfLines={2}>
                                        {request.reason}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Apply Form Header with Back Button */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.title}>Apply {selectedPolicy?.name} Leave</Text>
                <Text style={styles.subtitle}>Fill in the details below</Text>
              </View>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Date Range */}
              <View style={styles.dateRow}>
                {/* Start Date */}
                <View style={[styles.field, styles.dateField]}>
                  <Text style={styles.label}>Start Date *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#6357E8" />
                    <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
                  </TouchableOpacity>
                </View>

                {/* End Date */}
                <View style={[styles.field, styles.dateField]}>
                  <Text style={styles.label}>End Date *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#6357E8" />
                    <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Pickers */}
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowStartPicker(Platform.OS === 'ios')
                    if (date) setStartDate(date)
                  }}
                  minimumDate={new Date()}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowEndPicker(Platform.OS === 'ios')
                    if (date) setEndDate(date)
                  }}
                  minimumDate={startDate}
                />
              )}

              {/* Working Days Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Working Days</Text>
                  <Text style={styles.summaryValue}>{calculateWorkingDays()} days</Text>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.field}>
                <Text style={styles.label}>Reason (Optional)</Text>
                <TextInput
                  style={styles.textarea}
                  placeholder="Why are you taking leave?"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, applyLeaveMutation.isPending && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={applyLeaveMutation.isPending}
              >
                {applyLeaveMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 80,
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  subtitleContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
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
  tableWrapper: {
    padding: 16,
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 56,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableColumnType: {
    flex: 2.5,
    paddingRight: 8,
  },
  tableColumnNumber: {
    flex: 1,
    alignItems: 'center',
  },
  tableColumnAction: {
    width: 52,
    alignItems: 'center',
    position: 'relative',
  },
  typeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  leaveTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  expandIcon: {
    flexShrink: 0,
  },
  tableCellText: {
    fontSize: 14,
    color: '#111827',
  },
  numberText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  applyButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6357E8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  requestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  requestsCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyRequests: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyRequestsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  requestsList: {
    gap: 8,
  },
  requestItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  requestDateText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  requestDetails: {
    gap: 4,
  },
  requestDays: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  requestReason: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  policyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  policyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  policyButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6357E8',
  },
  policyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  policyButtonTextActive: {
    color: '#6357E8',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  textarea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6357E8',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tourTooltip: {
    position: 'absolute',
    bottom: '100%',
    right: -8,
    marginBottom: 8,
    backgroundColor: '#6357E8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  tourContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tourText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  tourArrow: {
    position: 'absolute',
    bottom: -4,
    right: 12,
    width: 8,
    height: 8,
    backgroundColor: '#6357E8',
    transform: [{ rotate: '45deg' }],
  },
})
