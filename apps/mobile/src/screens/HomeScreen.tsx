import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, Pressable, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState, useRef } from 'react'
import * as Location from 'expo-location'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { apiClient } from '@/api/client'
import type { MobileHomeData } from '@/types/api'
import type { MainTabParamList } from '@/navigation'
import { useLocation } from '@/hooks/useLocation'
import { CustomAlert } from '@/components/CustomAlert'
import { CameraCapture } from '@/components/CameraCapture'

export default function HomeScreen() {
  const queryClient = useQueryClient()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [clockedInLocation, setClockedInLocation] = useState<{ latitude: number; longitude: number; address?: string; accuracy?: number | null } | null>(null)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, -1 = last week
  const [showClockInAlert, setShowClockInAlert] = useState(false)
  const [showClockOutAlert, setShowClockOutAlert] = useState(false)
  const [clockInLocationText, setClockInLocationText] = useState('')
  const [clockOutLocationText, setClockOutLocationText] = useState('')
  const [pendingClockInLocation, setPendingClockInLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [pendingClockOutLocation, setPendingClockOutLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [clockInAddress, setClockInAddress] = useState<string | null>(null)
  const [clockOutAddress, setClockOutAddress] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null) // For task detail modal
  const [isModalVisible, setIsModalVisible] = useState(false) // Control modal visibility
  const [showClockInCamera, setShowClockInCamera] = useState(false)
  const [showClockOutCamera, setShowClockOutCamera] = useState(false)
  const [clockInPhoto, setClockInPhoto] = useState<string | null>(null)
  const [clockOutPhoto, setClockOutPhoto] = useState<string | null>(null)
  const slideAnim = useRef(new Animated.Value(300)).current // Start 300px below
  
  const { 
    location, 
    isLoading: isLoadingLocation, 
    error: locationError,
    permissionGranted,
    getCurrentLocation,
    clearLocation 
  } = useLocation()

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['mobile', 'home', weekOffset],
    queryFn: () => apiClient.getMobileHome(weekOffset),
    refetchInterval: 60_000, // Refresh every minute
  })

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Request GPS location whenever data loads
  useEffect(() => {
    console.log('[HomeScreen] GPS fetch check:', {
      hasData: !!data,
      hasLocation: !!location,
      isLoading: isLoadingLocation,
      willFetch: data && !location && !isLoadingLocation
    })
    if (data && !location && !isLoadingLocation) {
      console.log('[HomeScreen] Fetching GPS location...')
      getCurrentLocation()
    }
  }, [data, location, isLoadingLocation])

  // Populate clocked-in location from backend data when already clocked in
  useEffect(() => {
    const fetchClockedInLocation = async () => {
      console.log('[HomeScreen] Clocked-in location check:', {
        isClockedIn: data?.clock_status.is_clocked_in,
        hasLat: !!data?.clock_status.clock_in_latitude,
        hasLng: !!data?.clock_status.clock_in_longitude,
        hasClockedInLoc: !!clockedInLocation,
        lat: data?.clock_status.clock_in_latitude,
        lng: data?.clock_status.clock_in_longitude
      })
      
      if (data?.clock_status.is_clocked_in && 
          data.clock_status.clock_in_latitude && 
          data.clock_status.clock_in_longitude &&
          !clockedInLocation) {
        
        console.log('[HomeScreen] Setting clocked-in location from backend')
        const lat = data.clock_status.clock_in_latitude
        const lng = data.clock_status.clock_in_longitude
        
        // Try to get address via reverse geocoding
        let address: string | undefined
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
          })
          
          if (addresses && addresses.length > 0) {
            const addr = addresses[0]
            const addressParts = [
              addr.street || addr.district || addr.name,
              addr.city,
              addr.country,
            ].filter(Boolean)
            
            address = addressParts.join(', ')
          }
        } catch (error) {
          console.log('Reverse geocoding failed for saved location:', error)
          // Not critical - will show lat/lng if geocoding fails
        }
        
        setClockedInLocation({
          latitude: lat,
          longitude: lng,
          address: address,
          accuracy: null, // We don't have accuracy from saved location
        })
      }
    }
    
    fetchClockedInLocation()
  }, [data?.clock_status])

  // Reverse geocode summary locations when clocked out
  useEffect(() => {
    const geocodeSummaryLocations = async () => {
      if (data && !data.clock_status.is_clocked_in && data.clock_status.last_clock_out) {
        // Geocode clock in location
        if (data.clock_status.clock_in_latitude && data.clock_status.clock_in_longitude && !clockInAddress) {
          try {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: data.clock_status.clock_in_latitude,
              longitude: data.clock_status.clock_in_longitude,
            })
            if (addresses && addresses.length > 0) {
              const addr = addresses[0]
              const addressParts = [
                addr.street || addr.district || addr.name,
                addr.city,
                addr.country,
              ].filter(Boolean)
              setClockInAddress(addressParts.join(', '))
            }
          } catch (error) {
            console.log('Clock in geocoding failed:', error)
          }
        }
        
        // Geocode clock out location
        if (data.clock_status.clock_out_latitude && data.clock_status.clock_out_longitude && !clockOutAddress) {
          try {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: data.clock_status.clock_out_latitude,
              longitude: data.clock_status.clock_out_longitude,
            })
            if (addresses && addresses.length > 0) {
              const addr = addresses[0]
              const addressParts = [
                addr.street || addr.district || addr.name,
                addr.city,
                addr.country,
              ].filter(Boolean)
              setClockOutAddress(addressParts.join(', '))
            }
          } catch (error) {
            console.log('Clock out geocoding failed:', error)
          }
        }
      } else {
        // Reset addresses when clocked in or no clock out
        setClockInAddress(null)
        setClockOutAddress(null)
      }
    }
    
    geocodeSummaryLocations()
  }, [data?.clock_status.is_clocked_in, data?.clock_status.last_clock_out, data?.clock_status.clock_in_latitude, data?.clock_status.clock_out_latitude])

  // Animate task modal slide up when opening
  useEffect(() => {
    if (selectedTask !== null) {
      setIsModalVisible(true)
      // Reset to bottom position
      slideAnim.setValue(300)
      // Slide up after a tiny delay to let overlay fade in first
      setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start()
      }, 50)
    }
  }, [selectedTask, slideAnim])

  // Handle modal close with animation
  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsModalVisible(false)
      setSelectedTask(null)
    })
  }

  const clockInMutation = useMutation({
    mutationFn: ({ note, latitude, longitude }: { note?: string; latitude?: number; longitude?: number }) => 
      apiClient.clockIn({ note, latitude, longitude }),
    onSuccess: () => {
      // Save location to state so it persists after query refetch
      if (location) {
        setClockedInLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: ({ note, latitude, longitude }: { note?: string; latitude?: number; longitude?: number }) => 
      apiClient.clockOut({ note, latitude, longitude }),
    onSuccess: async () => {
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
      await refetch()
      clearLocation() // Clear location after clock-out
      setClockedInLocation(null) // Clear clocked-in location
      setShowClockOutAlert(false)
      setPendingClockOutLocation(null)
      // Success message will be shown by the shift summary
    },
  })

  const handleClockAction = async () => {
    if (!data) return
    
    if (data.clock_status.is_clocked_in) {
      // Get current location for clock-out
      const currentLocation = await getCurrentLocation()
      
      const locationText = currentLocation?.address 
        ? currentLocation.address
        : currentLocation
        ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
        : 'Location unavailable'
      
      setClockOutLocationText(locationText)
      setPendingClockOutLocation(currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null)
      // Show camera first for clock-out
      setShowClockOutCamera(true)
    } else {
      // Get current location for clock-in confirmation
      const locationText = location?.address 
        ? location.address
        : location
        ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        : 'Location unavailable'
      
      setClockInLocationText(locationText)
      setPendingClockInLocation(location ? { latitude: location.latitude, longitude: location.longitude } : null)
      // Show camera first for clock-in
      setShowClockInCamera(true)
    }
  }

  const handleClockInPhotoCapture = (photoUri: string) => {
    setClockInPhoto(photoUri)
    // Don't close camera here - component closes itself after user confirms
    // After photo is confirmed in component, show confirmation alert
    setShowClockInAlert(true)
  }

  const handleConfirmClockIn = () => {
    const params = {
      latitude: pendingClockInLocation?.latitude,
      longitude: pendingClockInLocation?.longitude,
      // TODO: Add photo when WOR-110 backend is implemented
      // photo: clockInPhoto,
    }
    clockInMutation.mutate(params)
    setShowClockInAlert(false)
    setPendingClockInLocation(null)
    setClockInPhoto(null)
  }

  const handleClockOutPhotoCapture = (photoUri: string) => {
    setClockOutPhoto(photoUri)
    // Don't close camera here - component closes itself after user confirms
    // After photo is confirmed in component, show confirmation alert
    setShowClockOutAlert(true)
  }

  const handleConfirmClockOut = () => {
    if (pendingClockOutLocation) {
      clockOutMutation.mutate({
        latitude: pendingClockOutLocation.latitude,
        longitude: pendingClockOutLocation.longitude,
        // TODO: Add photo when WOR-110 backend is implemented
        // photo: clockOutPhoto,
      })
    } else {
      clockOutMutation.mutate({
        // TODO: Add photo when WOR-110 backend is implemented
        // photo: clockOutPhoto,
      })
    }
    setClockOutPhoto(null)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
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

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load data</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#6357E8']}
            tintColor="#6357E8"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{data.employee.name.split(' ')[0]} 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Location - Show current GPS location (always updated) */}
        <View style={styles.locationCardTop}>
          {isLoadingLocation ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color="#6357E8" />
              <Text style={styles.locationLoadingText}>Detecting location...</Text>
            </View>
          ) : location ? (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={16} color="#6357E8" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationAddressTop}>
                  {typeof location.address === 'string' && location.address
                    ? location.address
                    : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  }
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.locationInfo}>
              <Ionicons name="location-outline" size={16} color="#9CA3AF" />
              <Text style={[styles.locationAddressTop, { color: '#9CA3AF' }]}>
                Location unavailable
              </Text>
            </View>
          )}
        </View>

        {/* Shift Complete Summary - Shows after clock out */}
        {!data.clock_status.is_clocked_in && data.clock_status.last_clock_out ? (() => {
          const clockInTime = data.clock_status.last_clock_in 
            ? new Date(data.clock_status.last_clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : 'N/A'
          const clockOutTime = new Date(data.clock_status.last_clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          const hoursWorked = data.clock_status.hours_worked_today?.toFixed(1) || '0.0'

          const getLocationText = (address: string | null, lat: number | null, lng: number | null) => {
            if (address) return address
            if (lat && lng) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            return 'Location not recorded'
          }

          return (
            <View style={styles.clockCard}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.summaryTitle}>Shift Complete</Text>
                </View>
                
                <View style={styles.summarySection}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryTimeBlock}>
                      <Text style={styles.summaryLabel}>Clock In</Text>
                      <Text style={styles.summaryTime}>{clockInTime}</Text>
                      <Text style={styles.summaryLocation}>
                        {getLocationText(clockInAddress, data.clock_status.clock_in_latitude, data.clock_status.clock_in_longitude)}
                      </Text>
                    </View>
                    
                    <Ionicons name="arrow-forward" size={20} color="#9CA3AF" style={styles.summaryArrow} />
                    
                    <View style={styles.summaryTimeBlock}>
                      <Text style={styles.summaryLabel}>Clock Out</Text>
                      <Text style={styles.summaryTime}>{clockOutTime}</Text>
                      <Text style={styles.summaryLocation}>
                        {getLocationText(clockOutAddress, data.clock_status.clock_out_latitude, data.clock_status.clock_out_longitude)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryTotalRow}>
                  <View style={styles.summaryTotalLabel}>
                    <Ionicons name="time-outline" size={20} color="#1E3A8A" />
                    <Text style={styles.summaryTotalText}>Total Hours</Text>
                  </View>
                  <Text style={styles.summaryTotalHours}>{hoursWorked}h</Text>
                </View>
              </View>
            </View>
          )
        })() : (
          /* Clock In/Out Card - Active state */
          <View style={styles.clockCard}>
            <View style={styles.clockHeader}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, data.clock_status.is_clocked_in && styles.statusDotActive]} />
                <Text style={styles.statusText}>
                  {data.clock_status.is_clocked_in ? 'Working' : 'Not clocked in'}
                </Text>
              </View>
              <View>
                <Text style={styles.timeLabel}>
                  {data.clock_status.is_clocked_in ? 'Clocked in at' : 'Current time'}
                </Text>
                <Text style={styles.timeValue}>
                  {data.clock_status.is_clocked_in && data.clock_status.last_clock_in
                    ? new Date(data.clock_status.last_clock_in).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })
                    : currentTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                  }
                </Text>
              </View>
            </View>

            {/* Hours Worked & Location - When clocked in */}
            {data.clock_status.is_clocked_in && (
              <>
                {data.clock_status.hours_worked_today !== null && (
                  <View style={styles.hoursCard}>
                    <Ionicons name="time-outline" size={20} color="#1E3A8A" />
                    <View style={styles.hoursContent}>
                      <Text style={styles.hoursLabel}>Hours today</Text>
                      <Text style={styles.hoursValue}>{data.clock_status.hours_worked_today.toFixed(1)}h</Text>
                    </View>
                  </View>
                )}
                
                {/* Clocked in location */}
                {clockedInLocation && (
                  <View style={styles.clockedInLocationCard}>
                    <Ionicons name="location" size={18} color="#6357E8" />
                    <View style={styles.clockedInLocationContent}>
                      <Text style={styles.clockedInLocationLabel}>Clocked in from</Text>
                      <Text style={styles.clockedInLocationText}>
                        {clockedInLocation.address || 
                         `${clockedInLocation.latitude.toFixed(4)}, ${clockedInLocation.longitude.toFixed(4)}`}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Clock In/Out Button */}
            <TouchableOpacity
              style={[
                styles.clockButton,
                data.clock_status.is_clocked_in ? styles.clockOutButton : styles.clockInButton,
                (clockInMutation.isPending || clockOutMutation.isPending) && styles.clockButtonDisabled,
              ]}
              onPress={handleClockAction}
              disabled={clockInMutation.isPending || clockOutMutation.isPending}
            >
              {clockInMutation.isPending || clockOutMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name={data.clock_status.is_clocked_in ? 'checkmark-circle' : 'time'}
                    size={24}
                    color="#FFF"
                  />
                  <Text style={styles.clockButtonText}>
                    {data.clock_status.is_clocked_in ? 'Clock Out' : 'Clock In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Approvals (Managers) */}
        {(data.pending_approvals.leave_count > 0 || data.pending_approvals.claim_count > 0) && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
              <Text style={styles.cardTitle}>Pending Approvals</Text>
            </View>
            
            {data.pending_approvals.leave_count > 0 && (
              <TouchableOpacity style={styles.approvalCategoryRow} onPress={() => navigation.navigate('Approvals', { tab: 'leave' })}>
                <View style={styles.approvalCategoryLeft}>
                  <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                  <Text style={styles.approvalCategoryText}>
                    {data.pending_approvals.leave_count} leave {data.pending_approvals.leave_count === 1 ? 'request' : 'requests'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            
            {data.pending_approvals.claim_count > 0 && (
              <TouchableOpacity style={styles.approvalCategoryRow} onPress={() => navigation.navigate('Approvals', { tab: 'claim' })}>
                <View style={styles.approvalCategoryLeft}>
                  <Ionicons name="receipt-outline" size={20} color="#10B981" />
                  <Text style={styles.approvalCategoryText}>
                    {data.pending_approvals.claim_count} {data.pending_approvals.claim_count === 1 ? 'claim' : 'claims'} to review
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* My Tasks */}
        {data.my_tasks && data.my_tasks.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="checkbox-outline" size={20} color="#6357E8" />
              <Text style={styles.cardTitle}>My Tasks</Text>
            </View>
            
            {data.my_tasks.map(task => (
              <TouchableOpacity 
                key={task.id} 
                style={styles.taskRow}
                onPress={() => setSelectedTask(task)}
              >
                <View style={styles.taskContent}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                    <View style={[
                      styles.priorityBadge,
                      task.priority === 'urgent' && styles.priorityUrgent,
                      task.priority === 'high' && styles.priorityHigh,
                      task.priority === 'medium' && styles.priorityMedium,
                      task.priority === 'low' && styles.priorityLow,
                    ]}>
                      <Text style={styles.priorityText}>{task.priority}</Text>
                    </View>
                  </View>
                  <View style={styles.taskFooter}>
                    <Text style={styles.taskListName}>{task.list_name}</Text>
                    {task.due_date && (
                      <View style={styles.taskDueDate}>
                        <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                        <Text style={styles.taskDueDateText}>{task.due_date}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Week Attendance */}
        <View style={styles.card}>
          <View style={styles.weekHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="trending-up" size={20} color="#8B5CF6" />
              <Text style={styles.cardTitle}>
                {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`}
              </Text>
            </View>
            <View style={styles.weekNavigation}>
              <TouchableOpacity 
                onPress={() => setWeekOffset(prev => prev - 1)}
                disabled={weekOffset <= -52}
                style={[styles.navButton, weekOffset <= -52 && styles.navButtonDisabled]}
              >
                <Ionicons name="chevron-back" size={20} color={weekOffset <= -52 ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setWeekOffset(prev => prev + 1)}
                disabled={weekOffset >= 0}
                style={[styles.navButton, weekOffset >= 0 && styles.navButtonDisabled]}
              >
                <Ionicons name="chevron-forward" size={20} color={weekOffset >= 0 ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.weekDays}>
            {data.week_attendance.days.map((status, idx) => (
              <View
                key={idx}
                style={[
                  styles.dayBox,
                  status === 'checked' && styles.dayBoxPresent,
                  status === 'late' && styles.dayBoxLate,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    (status === 'checked' || status === 'late') && styles.dayTextActive,
                  ]}
                >
                  {['M', 'T', 'W', 'T', 'F'][idx]}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.percentageRow}>
            <Text style={styles.percentageText}>{data.week_attendance.percentage}% on time</Text>
            <View
              style={[
                styles.percentageBadge,
                data.week_attendance.percentage >= 80
                  ? styles.percentageBadgeGood
                  : data.week_attendance.percentage >= 50
                  ? styles.percentageBadgeFair
                  : styles.percentageBadgePoor,
              ]}
            >
              <Text style={styles.percentageBadgeText}>
                {data.week_attendance.percentage >= 80 ? '✓ Good' : data.week_attendance.percentage >= 50 ? '⚠ Fair' : '✗ Poor'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <CustomAlert
        visible={showClockInAlert}
        title="Clock In"
        message="Are you sure you want to clock in?"
        icon="time"
        iconColor="#6357E8"
        imageUri={clockInPhoto || undefined}
        locationText={clockInLocationText}
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowClockInAlert(false)
              setPendingClockInLocation(null)
            },
          },
          {
            text: 'Clock In',
            style: 'primary',
            onPress: handleConfirmClockIn,
          },
        ]}
        onDismiss={() => {
          setShowClockInAlert(false)
          setPendingClockInLocation(null)
        }}
      />

      <CustomAlert
        visible={showClockOutAlert}
        title="Clock Out"
        message="Are you sure you want to clock out?"
        icon="checkmark-circle"
        iconColor="#F59E0B"
        imageUri={clockOutPhoto || undefined}
        locationText={clockOutLocationText}
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowClockOutAlert(false)
              setPendingClockOutLocation(null)
            },
          },
          {
            text: 'Clock Out',
            style: 'primary',
            onPress: handleConfirmClockOut,
          },
        ]}
        onDismiss={() => {
          setShowClockOutAlert(false)
          setPendingClockOutLocation(null)
        }}
      />

      {/* Clock In Camera */}
      <CameraCapture
        visible={showClockInCamera}
        onClose={() => {
          setShowClockInCamera(false)
          setPendingClockInLocation(null)
        }}
        onCapture={handleClockInPhotoCapture}
        title="Clock In Photo"
        locationText={clockInLocationText}
      />

      {/* Clock Out Camera */}
      <CameraCapture
        visible={showClockOutCamera}
        onClose={() => {
          setShowClockOutCamera(false)
          setPendingClockOutLocation(null)
        }}
        onCapture={handleClockOutPhotoCapture}
        title="Clock Out Photo"
        locationText={clockOutLocationText}
      />

      {/* Task Detail Modal */}
      <Modal
        visible={isModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Task Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {selectedTask && (
              <View style={styles.modalBody}>
                <Text style={styles.taskDetailTitle}>{selectedTask.title}</Text>
                
                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Priority</Text>
                  <View style={[
                    styles.priorityBadge,
                    selectedTask.priority === 'urgent' && styles.priorityUrgent,
                    selectedTask.priority === 'high' && styles.priorityHigh,
                    selectedTask.priority === 'medium' && styles.priorityMedium,
                    selectedTask.priority === 'low' && styles.priorityLow,
                  ]}>
                    <Text style={styles.priorityText}>{selectedTask.priority}</Text>
                  </View>
                </View>

                {selectedTask.due_date && (
                  <View style={styles.taskDetailRow}>
                    <Text style={styles.taskDetailLabel}>Due Date</Text>
                    <Text style={styles.taskDetailValue}>{selectedTask.due_date}</Text>
                  </View>
                )}

                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>List</Text>
                  <Text style={styles.taskDetailValue}>{selectedTask.list_name}</Text>
                </View>

                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Created By</Text>
                  <Text style={styles.taskDetailValue}>{selectedTask.creator_name}</Text>
                </View>

                {selectedTask.description && (
                  <View style={styles.taskDetailSection}>
                    <Text style={styles.taskDetailLabel}>Description</Text>
                    <Text style={styles.taskDetailDescription}>{selectedTask.description}</Text>
                  </View>
                )}
              </View>
            )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6357E8',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationCardTop: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  locationLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationAddressTop: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    lineHeight: 18,
  },
  clockCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1D5DB',
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  timeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  hoursCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  hoursContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  hoursValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    fontVariant: ['tabular-nums'],
  },
  clockedInLocationCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  clockedInLocationContent: {
    flex: 1,
  },
  clockedInLocationLabel: {
    fontSize: 12,
    color: '#6357E8',
    fontWeight: '600',
    marginBottom: 4,
  },
  clockedInLocationText: {
    fontSize: 14,
    color: '#4C1D95',
    fontWeight: '500',
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locationCardActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationDetails: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 20,
  },
  locationAddressActive: {
    color: '#047857',
  },
  locationAccuracy: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  clockInButton: {
    backgroundColor: '#6357E8',
  },
  clockOutButton: {
    backgroundColor: '#F59E0B',
  },
  clockButtonDisabled: {
    opacity: 0.5,
  },
  clockButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekNavigation: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  approvalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  approvalCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  approvalCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  weekDays: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dayBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBoxPresent: {
    backgroundColor: '#10B981',
  },
  dayBoxLate: {
    backgroundColor: '#F59E0B',
  },
  dayText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  dayTextActive: {
    color: '#FFF',
  },
  percentageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  percentageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  percentageBadgeGood: {
    backgroundColor: '#D1FAE5',
  },
  percentageBadgeFair: {
    backgroundColor: '#FEF3C7',
  },
  percentageBadgePoor: {
    backgroundColor: '#FEE2E2',
  },
  percentageBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  summaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065F46',
  },
  summarySection: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTimeBlock: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  summaryLocation: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
  },
  summaryArrow: {
    marginTop: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 12,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTotalLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  summaryTotalHours: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    fontVariant: ['tabular-nums'],
  },
  // Task styles
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskContent: {
    flex: 1,
    marginRight: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityUrgent: {
    backgroundColor: '#FEE2E2',
  },
  priorityHigh: {
    backgroundColor: '#FED7AA',
  },
  priorityMedium: {
    backgroundColor: '#FEF3C7',
  },
  priorityLow: {
    backgroundColor: '#E0E7FF',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#374151',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskListName: {
    fontSize: 13,
    color: '#6B7280',
  },
  taskDueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDueDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  // Task modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  taskDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
  },
  taskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  taskDetailValue: {
    fontSize: 14,
    color: '#111827',
  },
  taskDetailSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  taskDetailDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 8,
  },
})
