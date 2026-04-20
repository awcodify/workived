import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/api/client'
import type { Scorecard, ScorecardFlag } from '@/types/api'

type Period = 'this_month' | 'this_quarter' | 'this_year'

interface Props {
  period?: Period
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#10B981'
    case 'B': return '#3B82F6'
    case 'C': return '#F59E0B'
    default:  return '#EF4444'
  }
}

function flagColor(severity: string) {
  return severity === 'alert' ? '#FEE2E2' : '#FEF3C7'
}

function flagTextColor(severity: string) {
  return severity === 'alert' ? '#DC2626' : '#D97706'
}

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 0) return <Ionicons name="trending-up" size={16} color="#10B981" />
  if (trend < 0) return <Ionicons name="trending-down" size={16} color="#EF4444" />
  return <Ionicons name="remove" size={16} color="#9CA3AF" />
}

function MiniBar({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.miniBarRow} testID={`scorecard-bar-${label}`}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${score}%` as `${number}%` }]} />
      </View>
      <Text style={styles.miniBarScore}>{score}</Text>
    </View>
  )
}

function FlagPills({ flags }: { flags: ScorecardFlag[] }) {
  if (!flags.length) return null
  return (
    <View style={styles.flagRow}>
      {flags.slice(0, 2).map((f, i) => (
        <View key={i} style={[styles.flagPill, { backgroundColor: flagColor(f.severity) }]}>
          <Text style={[styles.flagPillText, { color: flagTextColor(f.severity) }]} numberOfLines={1}>
            {f.message}
          </Text>
        </View>
      ))}
      {flags.length > 2 && (
        <View style={[styles.flagPill, { backgroundColor: '#F3F4F6' }]}>
          <Text style={[styles.flagPillText, { color: '#6B7280' }]}>+{flags.length - 2} more</Text>
        </View>
      )}
    </View>
  )
}

function DetailModal({ scorecard, onClose }: { scorecard: Scorecard; onClose: () => void }) {
  const breakdown = scorecard.breakdown
  const categories = [
    { key: 'attendance', label: 'Attendance', data: breakdown?.attendance },
    { key: 'punctuality', label: 'Punctuality', data: breakdown?.punctuality },
    { key: 'leave', label: 'Leave', data: breakdown?.leave },
    { key: 'tasks', label: 'Tasks', data: breakdown?.tasks },
  ]

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheet} testID="scorecard-detail-modal">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>My Scorecard</Text>
                <Text style={styles.sheetPeriod}>{scorecard.period_label}</Text>
              </View>
              <TouchableOpacity onPress={onClose} testID="scorecard-detail-close-btn">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Overall score */}
              <View style={styles.scoreRow}>
                <View style={styles.scoreBig}>
                  <Text style={styles.scoreBigNumber}>{scorecard.overall_score}</Text>
                  <Text style={styles.scoreBigLabel}>/ 100</Text>
                </View>
                <View style={[styles.gradeBadgeLarge, { backgroundColor: gradeColor(scorecard.grade) }]}>
                  <Text style={styles.gradeBadgeLargeText}>{scorecard.grade}</Text>
                </View>
                <View style={styles.trendBlock}>
                  <TrendIcon trend={scorecard.trend} />
                  <Text style={[
                    styles.trendText,
                    scorecard.trend > 0 ? styles.trendUp : scorecard.trend < 0 ? styles.trendDown : styles.trendFlat,
                  ]}>
                    {scorecard.trend > 0 ? `+${scorecard.trend}` : scorecard.trend}
                  </Text>
                  <Text style={styles.trendLabel}>vs last period</Text>
                </View>
              </View>

              {/* Category breakdown */}
              <Text style={styles.sectionTitle}>Breakdown</Text>
              {categories.map(({ key, label, data }) => (
                <View key={key} style={styles.categoryRow} testID={`scorecard-category-${key}`}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryLabel}>{label}</Text>
                    <Text style={styles.categoryScore}>{data?.score ?? 0}</Text>
                  </View>
                  <View style={styles.categoryTrack}>
                    <View style={[styles.categoryFill, { width: `${data?.score ?? 0}%` as `${number}%` }]} />
                  </View>
                  {data?.detail ? (
                    <Text style={styles.categoryDetail}>{data.detail}</Text>
                  ) : null}
                </View>
              ))}

              {/* Flags */}
              {scorecard.flags.length > 0 && (
                <View style={styles.flagSection}>
                  <Text style={styles.sectionTitle}>Flags</Text>
                  {scorecard.flags.map((f, i) => (
                    <View key={i} style={[styles.flagCard, { backgroundColor: flagColor(f.severity) }]} testID={`scorecard-flag-${i}`}>
                      <Ionicons
                        name={f.severity === 'alert' ? 'alert-circle' : 'warning'}
                        size={16}
                        color={flagTextColor(f.severity)}
                      />
                      <Text style={[styles.flagCardText, { color: flagTextColor(f.severity) }]}>{f.message}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function ScorecardCard({ period = 'this_month' }: Props) {
  const [showDetail, setShowDetail] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['scorecard', 'me', period],
    queryFn: () => apiClient.getMyScorecard(period),
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <View style={styles.card} testID="scorecard-skeleton">
        <ActivityIndicator size="small" color="#6357E8" />
      </View>
    )
  }

  if (isError || !data?.scorecard) {
    return null
  }

  const sc = data.scorecard

  if (!sc.sufficient) {
    return (
      <View style={styles.card} testID="scorecard-insufficient">
        <View style={styles.cardTitleRow}>
          <Ionicons name="stats-chart" size={20} color="#6357E8" />
          <Text style={styles.cardTitle}>My Scorecard</Text>
        </View>
        <Text style={styles.insufficientText}>Insufficient data — check back after more working days.</Text>
      </View>
    )
  }

  const breakdown = sc.breakdown

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={() => setShowDetail(true)} testID="scorecard-card">
        <View style={styles.cardTitleRow}>
          <Ionicons name="stats-chart" size={20} color="#6357E8" />
          <Text style={styles.cardTitle}>My Scorecard</Text>
          <Text style={styles.periodLabel}>{sc.period_label}</Text>
        </View>

        {/* Score + grade + trend */}
        <View style={styles.scoreCompact}>
          <Text style={styles.scoreNumber}>{sc.overall_score}</Text>
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor(sc.grade) }]}>
            <Text style={styles.gradeBadgeText}>{sc.grade}</Text>
          </View>
          <View style={styles.trendCompact}>
            <TrendIcon trend={sc.trend} />
            <Text style={[
              styles.trendCompactText,
              sc.trend > 0 ? styles.trendUp : sc.trend < 0 ? styles.trendDown : styles.trendFlat,
            ]}>
              {sc.trend > 0 ? `+${sc.trend}` : sc.trend !== 0 ? sc.trend : '—'}
            </Text>
          </View>
        </View>

        {/* Mini bars */}
        <MiniBar label="Attendance" score={breakdown?.attendance?.score ?? 0} />
        <MiniBar label="Punctuality" score={breakdown?.punctuality?.score ?? 0} />
        <MiniBar label="Leave" score={breakdown?.leave?.score ?? 0} />
        <MiniBar label="Tasks" score={breakdown?.tasks?.score ?? 0} />

        {/* Flags */}
        <FlagPills flags={sc.flags} />

        <Text style={styles.tapHint}>Tap for full breakdown →</Text>
      </TouchableOpacity>

      {showDetail && <DetailModal scorecard={sc} onClose={() => setShowDetail(false)} />}
    </>
  )
}

// Exported for reuse in TeamRankingScreen
export function ScorecardDetailModal({
  scorecard,
  onClose,
}: {
  scorecard: Scorecard
  onClose: () => void
}) {
  return <DetailModal scorecard={scorecard} onClose={onClose} />
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
    flex: 1,
  },
  periodLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scoreCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeBadgeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  trendCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  trendCompactText: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  miniBarLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
  },
  miniBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: '#6357E8',
    borderRadius: 3,
  },
  miniBarScore: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    width: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  flagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 200,
  },
  flagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'right',
  },
  insufficientText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Detail modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sheetPeriod: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  sheetBody: {
    padding: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  scoreBig: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreBigNumber: {
    fontSize: 52,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  scoreBigLabel: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  gradeBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  gradeBadgeLargeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  trendBlock: {
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  trendUp: { color: '#10B981' },
  trendDown: { color: '#EF4444' },
  trendFlat: { color: '#9CA3AF' },
  trendLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  categoryRow: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  categoryScore: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  categoryTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  categoryFill: {
    height: '100%',
    backgroundColor: '#6357E8',
    borderRadius: 4,
  },
  categoryDetail: {
    fontSize: 12,
    color: '#6B7280',
  },
  flagSection: {
    marginTop: 8,
    paddingBottom: 32,
  },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  flagCardText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
})
