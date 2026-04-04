import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/api/client'
import type { MobileHomeData } from '@/types/api'

export default function HomeScreen() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['mobile', 'home'],
    queryFn: () => apiClient.getMobileHome(),
    refetchInterval: 60_000, // Refresh every minute
  })

  const clockInMutation = useMutation({
    mutationFn: (note?: string) => apiClient.clockIn({ note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: (note?: string) => apiClient.clockOut({ note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile', 'home'] })
    },
  })

  const handleClockAction = () => {
    if (!data) return
    
    if (data.clock_status.is_clocked_in) {
      clockOutMutation.mutate()
    } else {
      clockInMutation.mutate()
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
      <ScrollView style={styles.scrollView}>
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
                  : new Date().toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                }
              </Text>
            </View>
          </View>

          {data.clock_status.is_clocked_in && data.clock_status.hours_worked_today !== null && (
            <View style={styles.hoursCard}>
              <Text style={styles.hoursLabel}>Hours today</Text>
              <Text style={styles.hoursValue}>{data.clock_status.hours_worked_today.toFixed(1)}h</Text>
            </View>
          )}

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

        {/* Pending Approvals (Managers) */}
        {data.pending_approvals.count > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                <Text style={styles.cardTitle}>Pending Approvals</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{data.pending_approvals.count}</Text>
              </View>
            </View>
            {data.pending_approvals.items.slice(0, 2).map((item, idx) => (
              <View key={idx} style={styles.approvalItem}>
                <Text style={styles.approvalName}>👤 {item.employee_name}</Text>
                <Text style={styles.approvalSummary}>{item.summary}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Week Attendance */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trending-up" size={20} color="#8B5CF6" />
            <Text style={styles.cardTitle}>This Week's Attendance</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hoursLabel: {
    fontSize: 14,
    color: '#1E3A8A',
  },
  hoursValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E3A8A',
    fontVariant: ['tabular-nums'],
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
    backgroundColor: '#EF4444',
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
  approvalItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  approvalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  approvalSummary: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
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
})
