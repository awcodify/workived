import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import * as Location from 'expo-location'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { apiClient } from '@/api/client'
import type { MobileHomeData } from '@/types/api'
import type { MainTabParamList } from '@/navigation'
import { useLocation } from '@/hooks/useLocation'
import { CustomAlert } from '@/components/CustomAlert'

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

  // Request location immediately when screen loads (if not already clocked in)
  useEffect(() => {
    if (data && !data.clock_status.is_clocked_in && !location && !isLoadingLocation) {
      getCurrentLocation()
    }
  }, [data?.clock_status.is_clocked_in])

  // Populate clocked-in location from backend data when already clocked in
  useEffect(() => {
    const fetchClockedInLocation = async () => {
      if (data?.clock_status.is_clocked_in && 
          data.clock_status.clock_in_latitude && 
          data.clock_status.clock_in_longitude &&
          !clockedInLocation) {
        
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
      setShowClockOutAlert(true)
    } else {
      // Get current location for clock-in confirmation
      const locationText = location?.address 
        ? location.address
        : location
        ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        : 'Location unavailable'
      
      setClockInLocationText(locationText)
      setPendingClockInLocation(location ? { latitude: location.latitude, longitude: location.longitude } : null)
      setShowClockInAlert(true)
    }
  }

  const handleConfirmClockIn = () => {
    const params = {
      latitude: pendingClockInLocation?.latitude,
      longitude: pendingClockInLocation?.longitude,
    }
    clockInMutation.mutate(params)
    setShowClockInAlert(false)
    setPendingClockInLocation(null)
  }

  const handleConfirmClockOut = () => {
    if (pendingClockOutLocation) {
      clockOutMutation.mutate({
        latitude: pendingClockOutLocation.latitude,
        longitude: pendingClockOutLocation.longitude,
      })
    } else {
      clockOutMutation.mutate({})
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
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

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load data</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
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

        {/* Clock In/Out Card */}
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

          {/* Hours Worked & Location - Combined when clocked in */}
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
            </>
          )}

          {/* Location - Show before and after clock-in */}
          {(isLoadingLocation || location || (data.clock_status.is_clocked_in && clockedInLocation)) && (() => {
            // Use clocked-in location when clocked in, otherwise use current location
            const displayLocation = data.clock_status.is_clocked_in && clockedInLocation ? clockedInLocation : location
            
            return (
              <View style={[
                styles.locationCard,
                data.clock_status.is_clocked_in && styles.locationCardActive
              ]}>
                {isLoadingLocation ? (
                  <View style={styles.locationLoading}>
                    <ActivityIndicator size="small" color="#6357E8" />
                    <Text style={styles.locationLoadingText}>Detecting location...</Text>
                  </View>
                ) : displayLocation ? (
                  <>
                    {data.clock_status.is_clocked_in && (
                      <View style={styles.locationHeader}>
                        <Text style={styles.locationTitle}>Working from</Text>
                      </View>
                    )}
                    <View style={styles.locationInfo}>
                      <Ionicons name="location" size={16} color={data.clock_status.is_clocked_in ? "#10B981" : "#6B7280"} />
                      <View style={styles.locationDetails}>
                        <Text style={[
                          styles.locationAddress,
                          data.clock_status.is_clocked_in && styles.locationAddressActive
                        ]}>
                          {typeof displayLocation.address === 'string' && displayLocation.address
                            ? displayLocation.address
                            : `${displayLocation.latitude.toFixed(4)}, ${displayLocation.longitude.toFixed(4)}`
                          }
                        </Text>
                        {displayLocation.accuracy && (
                          <Text style={styles.locationAccuracy}>
                            ± {Math.round(displayLocation.accuracy)}m accuracy
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            )
          })()}

          {/* Work Summary - Shows after clock out */}
          {!data.clock_status.is_clocked_in && data.clock_status.last_clock_out && (() => {
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
            )
          })()}

          {/* Clock In/Out Button - Only show if not showing summary */}
          {(data.clock_status.is_clocked_in || !data.clock_status.last_clock_out) && (
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
          )}
        </View>

        {/* Pending Approvals (Managers) */}
        {(data.pending_approvals.leave_count > 0 || data.pending_approvals.claim_count > 0) && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
              <Text style={styles.cardTitle}>Pending Approvals</Text>
            </View>
            
            {data.pending_approvals.leave_count > 0 && (
              <TouchableOpacity style={styles.approvalCategoryRow} onPress={() => navigation.navigate('Approvals')}>
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
              <TouchableOpacity style={styles.approvalCategoryRow} onPress={() => navigation.navigate('Approvals')}>
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
        message={`Are you sure you want to clock in?\n\nLocation: ${clockInLocationText}`}
        icon="time"
        iconColor="#6357E8"
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
        message={`Are you sure you want to clock out?\n\nLocation: ${clockOutLocationText}`}
        icon="checkmark-circle"
        iconColor="#F59E0B"
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
})
