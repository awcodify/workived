import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { apiClient } from '@/api/client'
import { ScorecardDetailModal } from '@/components/ScorecardCard'
import type { EmployeeScore, Scorecard } from '@/types/api'

type Period = 'this_month' | 'this_quarter' | 'this_year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_month', label: 'Month' },
  { key: 'this_quarter', label: 'Quarter' },
  { key: 'this_year', label: 'Year' },
]

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#10B981'
    case 'B': return '#3B82F6'
    case 'C': return '#F59E0B'
    default:  return '#EF4444'
  }
}

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 0) return <Ionicons name="trending-up" size={14} color="#10B981" />
  if (trend < 0) return <Ionicons name="trending-down" size={14} color="#EF4444" />
  return <Ionicons name="remove" size={14} color="#9CA3AF" />
}

interface RankRowProps {
  rank: number
  emp: EmployeeScore
  onPress: () => void
}

function RankRow({ rank, emp, onPress }: RankRowProps) {
  return (
    <TouchableOpacity
      style={styles.rankRow}
      onPress={onPress}
      testID={`team-rank-row-${emp.employee_id}`}
    >
      <Text style={[styles.rankNum, rank <= 3 && styles.rankNumTop]}>{rank}</Text>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName} numberOfLines={1}>{emp.employee_name}</Text>
        <Text style={styles.rankDept} numberOfLines={1}>{emp.department}</Text>
      </View>
      <View style={styles.rankRight}>
        <View style={styles.trendRow}>
          <TrendIcon trend={emp.trend} />
          <Text style={[
            styles.trendText,
            emp.trend > 0 ? styles.trendUp : emp.trend < 0 ? styles.trendDown : styles.trendFlat,
          ]}>
            {emp.trend > 0 ? `+${emp.trend}` : emp.trend !== 0 ? emp.trend : '—'}
          </Text>
        </View>
        <Text style={styles.rankScore}>{emp.overall_score}</Text>
        <View style={[styles.gradeBadge, { backgroundColor: gradeColor(emp.grade) }]}>
          <Text style={styles.gradeBadgeText}>{emp.grade}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={styles.chevron} />
    </TouchableOpacity>
  )
}

export default function TeamRankingScreen() {
  const navigation = useNavigation()
  const [period, setPeriod] = useState<Period>('this_month')
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeScore | null>(null)
  const [selectedScorecard, setSelectedScorecard] = useState<Scorecard | null>(null)
  const [loadingEmployee, setLoadingEmployee] = useState<string | null>(null)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['scorecard', 'team', period],
    queryFn: () => apiClient.getTeamScorecard(period),
    staleTime: 5 * 60_000,
  })

  const handleEmployeePress = async (emp: EmployeeScore) => {
    setSelectedEmployee(emp)
    setLoadingEmployee(emp.employee_id)
    try {
      const result = await apiClient.getEmployeeScorecard(emp.employee_id, period)
      setSelectedScorecard(result.scorecard)
    } catch {
      setSelectedScorecard(null)
    } finally {
      setLoadingEmployee(null)
    }
  }

  const team = data?.team_scorecard
  const employees = team?.employees ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="team-ranking-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} testID="team-ranking-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Ranking</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period toggle */}
      <View style={styles.periodToggle} testID="team-ranking-period-toggle">
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.periodBtn, period === key && styles.periodBtnActive]}
            onPress={() => setPeriod(key)}
            testID={`team-ranking-period-${key}`}
          >
            <Text style={[styles.periodBtnText, period === key && styles.periodBtnTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Team average */}
      {team && (
        <View style={styles.avgRow} testID="team-ranking-avg">
          <Text style={styles.avgLabel}>Team average</Text>
          <Text style={styles.avgScore}>{team.team_average}</Text>
          <Text style={styles.avgPeriod}>{team.period_label}</Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.center} testID="team-ranking-skeleton">
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      ) : isError ? (
        <View style={styles.center} testID="team-ranking-error">
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
          <Text style={styles.emptyText}>Failed to load rankings</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.center} testID="team-ranking-empty">
          <Ionicons name="stats-chart-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No ranking data yet</Text>
          <Text style={styles.emptySubtext}>Check back after the team has more activity</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#6357E8']} tintColor="#6357E8" />
          }
        >
          {employees.map((emp, idx) => (
            <RankRow
              key={emp.employee_id}
              rank={idx + 1}
              emp={emp}
              onPress={() => handleEmployeePress(emp)}
            />
          ))}
        </ScrollView>
      )}

      {/* Loading overlay for employee scorecard fetch */}
      {loadingEmployee && (
        <View style={styles.loadingOverlay} testID="team-ranking-employee-loading">
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      )}

      {/* Employee scorecard detail modal */}
      {selectedScorecard && selectedEmployee && (
        <ScorecardDetailModal
          scorecard={selectedScorecard}
          onClose={() => {
            setSelectedScorecard(null)
            setSelectedEmployee(null)
          }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  periodToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodBtnTextActive: {
    color: '#6357E8',
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  avgLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  avgScore: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  avgPeriod: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rankNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
    width: 28,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rankNumTop: {
    color: '#6357E8',
  },
  rankInfo: {
    flex: 1,
    marginLeft: 8,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rankDept: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  rankRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  trendUp: { color: '#10B981' },
  trendDown: { color: '#EF4444' },
  trendFlat: { color: '#9CA3AF' },
  rankScore: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
  },
  gradeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  chevron: {
    marginLeft: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
