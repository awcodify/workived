import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { apiClient } from '@/api/client'
import type { WeekDay } from '@/types/api'
import type { RootStackParamList } from '@/navigation'

function getMonday(offset: number): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeHoursWorked(clockIn: string | null, clockOut: string | null): string | null {
  if (!clockIn || !clockOut) return null
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}h ${mins}m`
}

const DAY_STATUS_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  'on-time': { icon: 'checkmark-circle', color: '#10B981', bg: '#D1FAE5', label: 'On Time' },
  'late': { icon: 'time', color: '#F59E0B', bg: '#FEF3C7', label: 'Late' },
  'absent': { icon: 'close-circle', color: '#EF4444', bg: '#FEE2E2', label: 'Absent' },
  'overtime': { icon: 'trending-up', color: '#6366F1', bg: '#EDE9FE', label: 'Overtime' },
  'on_leave': { icon: 'airplane', color: '#8B5CF6', bg: '#F3E8FF', label: 'On Leave' },
  'weekend': { icon: 'bed', color: '#9CA3AF', bg: '#F3F4F6', label: 'Weekend' },
  'future': { icon: 'ellipsis-horizontal', color: '#D1D5DB', bg: '#F9FAFB', label: 'Upcoming' },
}

function TimelineDay({ day }: { day: WeekDay }) {
  const config = DAY_STATUS_CONFIG[day.status] ?? DAY_STATUS_CONFIG['future']
  const clockIn = formatTime(day.clock_in_at)
  const clockOut = formatTime(day.clock_out_at)
  const hours = computeHoursWorked(day.clock_in_at, day.clock_out_at)
  const isWorkday = !['weekend', 'future'].includes(day.status)

  return (
    <View style={tlStyles.row} testID={`timeline-day-${day.date}`}>
      {/* Left: date column */}
      <View style={tlStyles.dateCol}>
        <Text style={[tlStyles.dayName, day.is_today && tlStyles.todayText]}>{day.day_name}</Text>
        <Text style={[tlStyles.dayNumber, day.is_today && tlStyles.todayText]}>{day.day_number}</Text>
      </View>

      {/* Timeline connector */}
      <View style={tlStyles.connectorCol}>
        <View style={tlStyles.connectorLine} />
        <View style={[tlStyles.connectorDot, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon} size={14} color="#FFF" />
        </View>
        <View style={tlStyles.connectorLine} />
      </View>

      {/* Right: detail card */}
      <View style={[tlStyles.card, day.is_today && tlStyles.todayCard]}>
        {/* Status badge */}
        <View style={tlStyles.cardTop}>
          <View style={[tlStyles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[tlStyles.statusLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          {day.is_corrected && (
            <View style={tlStyles.correctedBadge}>
              <Ionicons name="pencil" size={10} color="#6357E8" />
              <Text style={tlStyles.correctedText}>Corrected</Text>
            </View>
          )}
          {day.is_leaving_early && (
            <View style={[tlStyles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[tlStyles.statusLabel, { color: '#F59E0B' }]}>Early leave</Text>
            </View>
          )}
        </View>

        {/* Clock times */}
        {isWorkday && (clockIn || clockOut) ? (
          <View style={tlStyles.timesRow}>
            <View style={tlStyles.timeBlock}>
              <Ionicons name="log-in-outline" size={14} color="#10B981" />
              <Text style={tlStyles.timeLabel}>In</Text>
              <Text style={tlStyles.timeValue}>{clockIn ?? '—'}</Text>
            </View>
            <View style={tlStyles.timeDivider} />
            <View style={tlStyles.timeBlock}>
              <Ionicons name="log-out-outline" size={14} color="#EF4444" />
              <Text style={tlStyles.timeLabel}>Out</Text>
              <Text style={tlStyles.timeValue}>{clockOut ?? '—'}</Text>
            </View>
            {hours && (
              <>
                <View style={tlStyles.timeDivider} />
                <View style={tlStyles.timeBlock}>
                  <Ionicons name="hourglass-outline" size={14} color="#6357E8" />
                  <Text style={tlStyles.timeLabel}>Total</Text>
                  <Text style={[tlStyles.timeValue, { color: '#6357E8' }]}>{hours}</Text>
                </View>
              </>
            )}
          </View>
        ) : isWorkday && day.status === 'absent' ? (
          <Text style={tlStyles.noClockText}>No clock-in recorded</Text>
        ) : null}

        {/* Note */}
        {day.note && (
          <View style={tlStyles.noteRow}>
            <Ionicons name="chatbubble-outline" size={12} color="#9CA3AF" />
            <Text style={tlStyles.noteText} numberOfLines={2}>{day.note}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default function MyAttendanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [weekOffset, setWeekOffset] = useState(0)

  const startDate = useMemo(() => getMonday(weekOffset), [weekOffset])

  const { data: weekData, isLoading: weekLoading, error: weekError, refetch, isRefetching } = useQuery({
    queryKey: ['attendance', 'my-week', startDate],
    queryFn: () => apiClient.getMyWeek(startDate),
    refetchInterval: 60_000,
  })

  const week = weekData?.data

  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`
  const dateRange = week ? `${formatShortDate(week.start_date)} – ${formatShortDate(week.end_date)}` : ''

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="my-attendance-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} testID="my-attendance-back-btn">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Attendance</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#6357E8']} tintColor="#6357E8" />
        }
      >
        {/* Week Navigation */}
        <View style={styles.weekNavBar} testID="my-attendance-week-card">
          <TouchableOpacity
            onPress={() => setWeekOffset(prev => prev - 1)}
            disabled={weekOffset <= -52}
            style={[styles.navBtn, weekOffset <= -52 && styles.navBtnDisabled]}
            testID="my-attendance-prev-btn"
          >
            <Ionicons name="chevron-back" size={20} color={weekOffset <= -52 ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>
          <View style={styles.weekLabelCol}>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            {dateRange ? <Text style={styles.weekDateRange}>{dateRange}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => setWeekOffset(prev => prev + 1)}
            disabled={weekOffset >= 0}
            style={[styles.navBtn, weekOffset >= 0 && styles.navBtnDisabled]}
            testID="my-attendance-next-btn"
          >
            <Ionicons name="chevron-forward" size={20} color={weekOffset >= 0 ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        {weekLoading ? (
          <ActivityIndicator size="large" color="#6357E8" style={styles.timelineLoader} testID="my-attendance-week-skeleton" />
        ) : weekError ? (
          <View style={styles.errorState}>
            <Ionicons name="cloud-offline-outline" size={48} color="#D1D5DB" />
            <Text style={styles.errorTitle}>Could not load attendance</Text>
            <Text style={styles.errorSub}>{weekError instanceof Error ? weekError.message : 'Please try again'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : week ? (
          <View style={styles.timeline}>
            {week.days.map((day) => (
              <TimelineDay key={day.date} day={day} />
            ))}
          </View>
        ) : null}

        {/* Correction Link */}
        <TouchableOpacity
          style={styles.correctionLink}
          onPress={() => navigation.navigate('AttendanceCorrection')}
          testID="my-attendance-correction-btn"
        >
          <View style={styles.correctionLinkLeft}>
            <Ionicons name="create-outline" size={22} color="#6357E8" />
            <View>
              <Text style={styles.correctionLinkTitle}>Attendance Corrections</Text>
              <Text style={styles.correctionLinkSub}>Request or view correction history</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const tlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 80,
  },
  dateCol: {
    width: 36,
    alignItems: 'center',
    paddingTop: 12,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  todayText: {
    color: '#6357E8',
  },
  connectorCol: {
    width: 32,
    alignItems: 'center',
  },
  connectorLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  connectorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginLeft: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  todayCard: {
    borderWidth: 1.5,
    borderColor: '#6357E8',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  correctedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F5F3FF',
  },
  correctedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6357E8',
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  timeBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  timeDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  timeLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  noClockText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  weekNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  weekLabelCol: {
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  weekDateRange: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  navBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  timeline: {
    marginBottom: 20,
  },
  timelineLoader: {
    paddingVertical: 40,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#6357E8',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  correctionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  correctionLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  correctionLinkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  correctionLinkSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
})
