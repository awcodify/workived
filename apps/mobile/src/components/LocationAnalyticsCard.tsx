import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/api/client'
import type { LocationBreakdownItem } from '@/types/api'

const LOCATION_META: Record<string, { label: string; color: string }> = {
  office:  { label: 'Office',  color: '#12A05C' },
  wfh:     { label: 'WFH',     color: '#6357E8' },
  remote:  { label: 'Remote',  color: '#C97B2A' },
  wfa:     { label: 'Remote',  color: '#C97B2A' },
  unknown: { label: 'Unknown', color: '#9CA3AF' },
}

function getMeta(type: string) {
  return LOCATION_META[type] ?? { label: type, color: '#9CA3AF' }
}

export function LocationAnalyticsCard() {
  const [period, setPeriod] = useState<'this_week' | 'this_month'>('this_week')

  const { data, isLoading } = useQuery({
    queryKey: ['location-analytics', period],
    queryFn: () => apiClient.getLocationAnalytics(period).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="location-outline" size={20} color="#6357E8" />
          <Text style={styles.cardTitle}>Work Location</Text>
        </View>

        {/* Period toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            onPress={() => setPeriod('this_week')}
            style={[styles.toggleBtn, period === 'this_week' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, period === 'this_week' && styles.toggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPeriod('this_month')}
            style={[styles.toggleBtn, period === 'this_month' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, period === 'this_month' && styles.toggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date range subtitle */}
      {data && (
        <Text style={styles.subtitle}>
          {data.total} clock-ins · {data.start_date} – {data.end_date}
        </Text>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6357E8" />
        </View>
      )}

      {/* Empty */}
      {!isLoading && (!data || data.total === 0) && (
        <Text style={styles.emptyText}>No clock-in data for this period</Text>
      )}

      {/* Data */}
      {!isLoading && data && data.total > 0 && (
        <>
          {/* Segmented bar */}
          <View style={styles.segmentBar}>
            {data.breakdown.map((item: LocationBreakdownItem) => (
              <View
                key={item.type}
                style={[
                  styles.segment,
                  { flex: item.percentage, backgroundColor: getMeta(item.type).color },
                ]}
              />
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {data.breakdown.map((item: LocationBreakdownItem) => {
              const meta = getMeta(item.type)
              return (
                <View key={item.type} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: meta.color }]} />
                  <Text style={styles.legendLabel}>{meta.label}</Text>
                  <Text style={styles.legendCount}>{item.count}</Text>
                  <Text style={styles.legendPct}>{item.percentage}%</Text>
                </View>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFF',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  toggleTextActive: {
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  segmentBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 12,
  },
  segment: {
    borderRadius: 4,
  },
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  legendCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    minWidth: 20,
    textAlign: 'right',
  },
  legendPct: {
    fontSize: 11,
    color: '#9CA3AF',
    minWidth: 36,
    textAlign: 'right',
  },
})
