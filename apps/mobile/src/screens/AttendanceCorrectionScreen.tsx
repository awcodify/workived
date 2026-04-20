import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { apiClient } from '@/api/client'
import { CorrectionBottomSheet } from '@/components/CorrectionBottomSheet'
import type { AttendanceCorrection } from '@/types/api'

const STATUS_COLOR: Record<AttendanceCorrection['status'], string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  cancelled: '#9CA3AF',
}

const STATUS_BG: Record<AttendanceCorrection['status'], string> = {
  pending: '#FEF3C7',
  approved: '#D1FAE5',
  rejected: '#FEE2E2',
  cancelled: '#F3F4F6',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AttendanceCorrectionScreen() {
  const navigation = useNavigation()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['corrections', 'mine'],
    queryFn: () => apiClient.getMyCorrections(),
  })

  const corrections = data?.data ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="attendance-correction-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} testID="correction-screen-back-btn">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Correction</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#6357E8']} tintColor="#6357E8" />
        }
      >
        {/* Request button */}
        <TouchableOpacity
          style={styles.requestBtn}
          onPress={() => setShowForm(true)}
          testID="correction-screen-request-btn"
        >
          <Ionicons name="create-outline" size={20} color="#FFF" />
          <Text style={styles.requestBtnText}>Request Correction</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.sectionTitle}>My Requests</Text>

        {isLoading ? (
          <View style={styles.loadingCenter} testID="correction-screen-skeleton">
            <ActivityIndicator size="large" color="#6357E8" />
          </View>
        ) : corrections.length === 0 ? (
          <View style={styles.emptyState} testID="correction-screen-empty">
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No corrections yet</Text>
            <Text style={styles.emptySub}>Tap "Request Correction" to submit one</Text>
          </View>
        ) : (
          corrections.map((c) => (
            <View key={c.id} style={styles.card} testID={`correction-item-${c.id}`}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardDate}>{formatDate(c.date)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[c.status] }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[c.status] }]}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.submittedAt}>{formatDate(c.created_at)}</Text>
              </View>

              {(c.requested_clock_in || c.requested_clock_out) && (
                <View style={styles.timesRow}>
                  {c.requested_clock_in && (
                    <View style={styles.timeChip}>
                      <Ionicons name="log-in-outline" size={14} color="#6357E8" />
                      <Text style={styles.timeChipText}>{formatTime(c.requested_clock_in)}</Text>
                    </View>
                  )}
                  {c.requested_clock_out && (
                    <View style={styles.timeChip}>
                      <Ionicons name="log-out-outline" size={14} color="#6357E8" />
                      <Text style={styles.timeChipText}>{formatTime(c.requested_clock_out)}</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.reason}>{c.reason}</Text>

              {c.rejection_reason && (
                <View style={styles.rejectionNote}>
                  <Ionicons name="information-circle-outline" size={14} color="#EF4444" />
                  <Text style={styles.rejectionText}>{c.rejection_reason}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <CorrectionBottomSheet visible={showForm} onClose={() => setShowForm(false)} />
    </SafeAreaView>
  )
}

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
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6357E8',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  requestBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  loadingCenter: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submittedAt: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6357E8',
  },
  reason: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  rejectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: '#EF4444',
  },
})
