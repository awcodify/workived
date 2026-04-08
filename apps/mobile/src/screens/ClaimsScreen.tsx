import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { apiClient } from '@/api/client'
import type { ClaimCategory, ClaimWithDetails, ClaimBalanceWithCategory } from '@/types/api'
import { Calendar, DateData } from 'react-native-calendars'

type ViewMode = 'list' | 'apply'

export default function ClaimsScreen() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  
  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [claimDate, setClaimDate] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [receiptUri, setReceiptUri] = useState<string | null>(null)

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['claim-categories'],
    queryFn: async () => {
      const response = await apiClient.getClaimCategories()
      return response.data
    },
  })

  const { data: myClaimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ['claims', 'me'],
    queryFn: async () => {
      const response = await apiClient.getMyClaims()
      return response.data
    },
  })

  const { data: balancesData } = useQuery({
    queryKey: ['claims', 'balances', 'me'],
    queryFn: async () => {
      const response = await apiClient.getClaimBalances()
      return response.data
    },
  })

  const { data: homeData } = useQuery({
    queryKey: ['mobile', 'home'],
    queryFn: () => apiClient.getMobileHome(),
  })

  const submitClaimMutation = useMutation({
    mutationFn: async (data: {
      category_id: string
      amount: number
      currency_code: string
      description: string
      claim_date: string
      receipt?: any
    }) => {
      const response = await apiClient.submitClaim(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      Alert.alert('Success', 'Claim submitted successfully')
      // Reset form
      setAmount('')
      setDescription('')
      setClaimDate(new Date())
      setReceiptUri(null)
      setViewMode('list')
      setSelectedCategoryId('')
      setExpandedCategoryId(null)
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to submit claim')
    },
  })

  const handleGoBack = () => {
    setViewMode('list')
    setSelectedCategoryId('')
    setAmount('')
    setDescription('')
    setClaimDate(new Date())
    setReceiptUri(null)
  }

  const handleToggleExpand = (categoryId: string) => {
    setExpandedCategoryId(expandedCategoryId === categoryId ? null : categoryId)
  }

  const handleApplyClaim = (category: ClaimCategory) => {
    setSelectedCategoryId(category.id)
    setViewMode('apply')
  }

  const handleSubmit = () => {
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Please select a category')
      return
    }

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description')
      return
    }

    if (description.trim().length > 500) {
      Alert.alert('Error', 'Description must be less than 500 characters')
      return
    }

    // Check if receipt is required
    if (selectedCategory?.requires_receipt && !receiptUri) {
      Alert.alert('Error', 'Receipt is required for this category')
      return
    }

    const currencyCode = homeData?.organisation?.currency_code || 'IDR'
    const amountInSmallestUnit = Math.round(amountNum * 100)

    // Prepare receipt file if available
    let receiptFile = null
    if (receiptUri) {
      const filename = receiptUri.split('/').pop() || 'receipt.jpg'
      receiptFile = {
        uri: receiptUri,
        type: 'image/jpeg',
        name: filename,
      } as any
    }

    submitClaimMutation.mutate({
      category_id: selectedCategoryId,
      amount: amountInSmallestUnit,
      currency_code: currencyCode,
      description: description.trim(),
      claim_date: claimDate.toISOString().split('T')[0],
      receipt: receiptFile,
    })
  }

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload receipts')
      return
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    })

    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleDayPress = (day: DateData) => {
    const selectedDate = new Date(day.year, day.month - 1, day.day)
    setClaimDate(selectedDate)
    setShowCalendar(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981'
      case 'rejected':
        return '#EF4444'
      case 'cancelled':
        return '#6B7280'
      case 'paid':
        return '#3B82F6'
      default:
        return '#F59E0B'
    }
  }

  const formatCurrency = (amount: number, currencyCode: string) => {
    // amount is in smallest unit (cents/fils/sen)
    const displayAmount = amount / 100
    return `${currencyCode} ${displayAmount.toFixed(2)}`
  }

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getCategoryIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('meal') || lowerName.includes('food')) return 'restaurant-outline'
    if (lowerName.includes('transport') || lowerName.includes('travel')) return 'car-outline'
    if (lowerName.includes('accommodation') || lowerName.includes('hotel')) return 'bed-outline'
    if (lowerName.includes('equipment')) return 'hardware-chip-outline'
    if (lowerName.includes('phone') || lowerName.includes('communication')) return 'call-outline'
    return 'receipt-outline'
  }

  const categories = categoriesData || []
  const myClaims = myClaimsData || []
  const balances = balancesData || []
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  // Filter claims by category
  const getClaimsForCategory = (categoryId: string): ClaimWithDetails[] => {
    return myClaims.filter((claim) => claim.category_id === categoryId)
  }

  // Get balance for category
  const getBalanceForCategory = (categoryId: string): ClaimBalanceWithCategory | undefined => {
    return balances.find((b) => b.category_id === categoryId)
  }

  if (categoriesLoading || claimsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      </SafeAreaView>
    )
  }

  if (viewMode === 'apply' && selectedCategory) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Submit Claim</Text>
              <Text style={styles.subtitle}>{selectedCategory.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleGoBack}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Category Info */}
            <View style={styles.categoryInfo}>
              <Ionicons
                name={getCategoryIcon(selectedCategory.name)}
                size={32}
                color="#6357E8"
              />
              <View style={styles.categoryInfoText}>
                <Text style={styles.categoryInfoName}>{selectedCategory.name}</Text>
                {selectedCategory.description && (
                  <Text style={styles.categoryInfoDesc}>{selectedCategory.description}</Text>
                )}
                {!selectedCategory.is_unlimited && selectedCategory.monthly_limit && (
                  <Text style={styles.categoryInfoLimit}>
                    Limit: {formatCurrency(selectedCategory.monthly_limit, selectedCategory.currency_code)} per {selectedCategory.budget_period}
                  </Text>
                )}
              </View>
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.currencySymbol}>
                  {selectedCategory.currency_code}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Claim Date */}
            <View style={styles.field}>
              <Text style={styles.label}>Claim Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowCalendar(!showCalendar)}
              >
                <Ionicons name="calendar-outline" size={20} color="#6357E8" />
                <Text style={styles.dateButtonText}>{formatDate(claimDate)}</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            {showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={handleDayPress}
                  markedDates={{
                    [claimDate.toISOString().split('T')[0]]: {
                      selected: true,
                      selectedColor: '#6357E8',
                    },
                  }}
                  maxDate={new Date().toISOString().split('T')[0]}
                  theme={{
                    backgroundColor: '#FFF',
                    calendarBackground: '#FFF',
                    selectedDayBackgroundColor: '#6357E8',
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: '#6357E8',
                    dayTextColor: '#111827',
                    textDisabledColor: '#D1D5DB',
                    monthTextColor: '#111827',
                    textMonthFontWeight: '600',
                    arrowColor: '#6357E8',
                  }}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description * ({description.length}/500)</Text>
              <TextInput
                style={styles.textarea}
                placeholder="What is this expense for?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Receipt Upload */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Receipt {selectedCategory.requires_receipt && '*'}
              </Text>
              {receiptUri ? (
                <View style={styles.receiptPreview}>
                  <Image source={{ uri: receiptUri }} style={styles.receiptImage} />
                  <TouchableOpacity
                    style={styles.removeReceiptButton}
                    onPress={() => setReceiptUri(null)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.changeReceiptButton}
                    onPress={pickImage}
                  >
                    <Ionicons name="camera" size={16} color="#6357E8" />
                    <Text style={styles.changeReceiptText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                  <Ionicons name="camera" size={24} color="#6357E8" />
                  <Text style={styles.uploadButtonText}>Upload Receipt</Text>
                  <Text style={styles.uploadButtonHint}>Photo or PDF of receipt</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitClaimMutation.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitClaimMutation.isPending}
            >
              {submitClaimMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={styles.submitButtonText}>Submit Claim</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Claims</Text>
        </View>
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Submit expense claims by category</Text>
        </View>

        {/* Categories Table */}
        <View style={styles.tableWrapper}>
          <View style={styles.tableCard}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableColumnType]}>Category</Text>
              <Text style={[styles.tableHeaderText, styles.tableColumnAvail]}>Available</Text>
              <View style={styles.tableColumnAction} />
            </View>

            {/* Table Rows */}
            {categories.map((category, index) => {
              const isExpanded = expandedCategoryId === category.id
              const categoryClaims = getClaimsForCategory(category.id)
              const balance = getBalanceForCategory(category.id)
              
              // Calculate values
              const limit = category.is_unlimited ? 0 : (category.monthly_limit ? category.monthly_limit / 100 : 0)
              const used = balance ? balance.total_spent / 100 : 0
              const remaining = balance?.remaining !== undefined ? balance.remaining / 100 : (limit > 0 ? limit : 0)

              return (
                <View key={category.id}>
                  {/* Table Row */}
                  <View style={[styles.tableRow, index > 0 && styles.tableRowBorder]}>
                    {/* Category Column */}
                    <TouchableOpacity
                      style={[styles.tableCell, styles.tableColumnType]}
                      onPress={() => handleToggleExpand(category.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.typeCell}>
                        <Ionicons
                          name={getCategoryIcon(category.name)}
                          size={20}
                          color="#6357E8"
                        />
                        <Text style={styles.typeCellText}>{category.name}</Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#9CA3AF"
                          style={styles.expandIcon}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Available Column */}
                    <View style={[styles.tableCell, styles.tableColumnAvail]}>
                      <Text style={[styles.tableCellText, styles.numberText, { color: '#10B981' }]}>
                        {category.is_unlimited ? '∞' : `${category.currency_code} ${remaining.toFixed(2)}`}
                      </Text>
                    </View>

                    {/* Apply Button Column */}
                    <View style={[styles.tableCell, styles.tableColumnAction]}>
                      <TouchableOpacity
                        style={styles.applyButtonSmall}
                        onPress={() => handleApplyClaim(category)}
                      >
                        <Ionicons name="add-circle" size={18} color="#6357E8" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Expanded Section - My Claims for this category */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      <View style={styles.requestsHeader}>
                        <Text style={styles.requestsTitle}>Your Claims</Text>
                        {categoryClaims.length > 0 && (
                          <Text style={styles.requestsCount}>
                            {categoryClaims.length} {categoryClaims.length === 1 ? 'claim' : 'claims'}
                          </Text>
                        )}
                      </View>

                      {categoryClaims.length === 0 ? (
                        <View style={styles.emptyRequests}>
                          <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                          <Text style={styles.emptyRequestsText}>No claims yet</Text>
                        </View>
                      ) : (
                        <View style={styles.requestsList}>
                          {categoryClaims.map((claim) => (
                            <View key={claim.id} style={styles.requestItem}>
                              <View style={styles.requestHeader}>
                                <View style={styles.requestDates}>
                                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                  <Text style={styles.requestDateText}>
                                    {formatDateShort(claim.claim_date)}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    { backgroundColor: getStatusColor(claim.status) },
                                  ]}
                                >
                                  <Text style={styles.statusText}>{claim.status}</Text>
                                </View>
                              </View>
                              <Text style={styles.requestAmount}>
                                {formatCurrency(claim.amount, claim.currency_code)}
                              </Text>
                              {claim.description && (
                                <Text style={styles.requestDescription} numberOfLines={2}>
                                  {claim.description}
                                </Text>
                              )}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tableWrapper: {
    padding: 16,
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: '#FFF',
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tableCell: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  tableColumnType: {
    flex: 2,
    paddingRight: 8,
  },
  tableColumnAvail: {
    flex: 1.5,
    alignItems: 'flex-end',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  expandIcon: {
    marginLeft: 'auto',
  },
  tableCellText: {
    fontSize: 16,
    color: '#111827',
  },
  numberText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  applyButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    color: '#374151',
  },
  requestsCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyRequests: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyRequestsText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  requestsList: {
    gap: 8,
  },
  requestItem: {
    backgroundColor: '#FFF',
    borderRadius: 8,
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
    gap: 4,
  },
  requestDateText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requestAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  // Apply form styles
  header: {
    padding: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerContent: {
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    padding: 24,
    paddingTop: 0,
  },
  categoryInfo: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  categoryInfoText: {
    flex: 1,
  },
  categoryInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  categoryInfoDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  categoryInfoLimit: {
    fontSize: 12,
    color: '#6357E8',
    fontWeight: '600',
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
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  calendarContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 24,
  },
  textarea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#6357E8',
    borderRadius: 12,
    padding: 18,
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
  uploadButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6357E8',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6357E8',
  },
  uploadButtonHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  receiptPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  changeReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 12,
  },
  changeReceiptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6357E8',
  },
})
