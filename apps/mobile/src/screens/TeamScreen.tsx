import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/native-stack'
import { apiClient } from '@/api/client'
import { ScorecardCard } from '@/components/ScorecardCard'
import { LocationAnalyticsCard } from '@/components/LocationAnalyticsCard'
import { useAuth } from '@/contexts/AuthContext'
import type { RootStackParamList } from '@/navigation'

export default function TeamScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const [weekOffset, setWeekOffset] = useState(0)

  const isManager = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager'

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile', 'home', weekOffset],
    queryFn: () => apiClient.getMobileHome(weekOffset),
    refetchInterval: 60_000,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="team-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#6357E8']} tintColor="#6357E8" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Stats</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingCenter} testID="team-screen-skeleton">
            <ActivityIndicator size="large" color="#6357E8" />
          </View>
        ) : (
          <>
            {/* Week Attendance */}
            {data && (
              <View style={styles.card} testID="team-week-attendance">
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
                      testID="team-week-prev-btn"
                    >
                      <Ionicons name="chevron-back" size={20} color={weekOffset <= -52 ? '#D1D5DB' : '#6B7280'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setWeekOffset(prev => prev + 1)}
                      disabled={weekOffset >= 0}
                      style={[styles.navButton, weekOffset >= 0 && styles.navButtonDisabled]}
                      testID="team-week-next-btn"
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
            )}

            {/* My Scorecard */}
            <ScorecardCard />

            {/* Work Location — admin/manager only */}
            {isManager && <LocationAnalyticsCard />}

            {/* Team Ranking — admin/manager only */}
            {isManager && (
              <TouchableOpacity
                style={styles.teamRankingBtn}
                onPress={() => navigation.navigate('TeamRanking')}
                testID="team-ranking-btn"
              >
                <Ionicons name="podium" size={20} color="#6357E8" />
                <Text style={styles.teamRankingBtnText}>View Team Ranking</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
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
  teamRankingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  teamRankingBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
})
