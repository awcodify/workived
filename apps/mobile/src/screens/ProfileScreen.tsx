import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useState } from 'react'
import { CustomAlert } from '@/components/CustomAlert'

export default function ProfileScreen() {
  const { logout } = useAuth()
  const [showLogoutAlert, setShowLogoutAlert] = useState(false)

  // Fetch employee profile data
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['employee-profile'],
    queryFn: async () => {
      const response = await apiClient.getMyProfile()
      return response.data
    },
  })

  const handleLogout = () => {
    setShowLogoutAlert(true)
  }

  const confirmLogout = async () => {
    try {
      await logout()
    } catch (error) {
      // Error handling - could show another alert here
      console.error('Logout failed:', error)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const getEmploymentTypeBadge = (type: string) => {
    const badges = {
      full_time: { label: 'Full-time', color: '#10B981' },
      part_time: { label: 'Part-time', color: '#F59E0B' },
      contract: { label: 'Contract', color: '#6366F1' },
      intern: { label: 'Intern', color: '#8B5CF6' },
    }
    return badges[type as keyof typeof badges] || { label: type, color: '#6B7280' }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { label: 'Active', color: '#10B981' },
      on_leave: { label: 'On Leave', color: '#F59E0B' },
      probation: { label: 'Probation', color: '#6366F1' },
      inactive: { label: 'Inactive', color: '#6B7280' },
    }
    return badges[status as keyof typeof badges] || { label: status, color: '#6B7280' }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6357E8" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      </SafeAreaView>
    )
  }

  const employmentTypeBadge = getEmploymentTypeBadge(profile.employment_type)
  const statusBadge = getStatusBadge(profile.status)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Avatar & Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile.full_name)}</Text>
          </View>
          <Text style={styles.nameText}>{profile.full_name}</Text>
          {profile.email && <Text style={styles.emailText}>{profile.email}</Text>}
        </View>

        {/* Employment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment Information</Text>

          {profile.employee_code && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="barcode-outline" size={20} color="#6B7280" />
                <Text style={styles.labelText}>Employee ID</Text>
              </View>
              <Text style={styles.valueText}>{profile.employee_code}</Text>
            </View>
          )}

          {profile.job_title && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="briefcase-outline" size={20} color="#6B7280" />
                <Text style={styles.labelText}>Job Title</Text>
              </View>
              <Text style={styles.valueText}>{profile.job_title}</Text>
            </View>
          )}

          {profile.department_name && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="business-outline" size={20} color="#6B7280" />
                <Text style={styles.labelText}>Department</Text>
              </View>
              <Text style={styles.valueText}>{profile.department_name}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.labelText}>Start Date</Text>
            </View>
            <Text style={styles.valueText}>{formatDate(profile.start_date)}</Text>
          </View>

          {profile.manager_name && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="person-outline" size={20} color="#6B7280" />
                <Text style={styles.labelText}>Reports To</Text>
              </View>
              <Text style={styles.valueText}>{profile.manager_name}</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="pricetag-outline" size={20} color="#6B7280" />
              <Text style={styles.labelText}>Employment Type</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: employmentTypeBadge.color + '20' }]}>
              <Text style={[styles.badgeText, { color: employmentTypeBadge.color }]}>
                {employmentTypeBadge.label}
              </Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="pulse-outline" size={20} color="#6B7280" />
              <Text style={styles.labelText}>Status</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusBadge.color + '20' }]}>
              <Text style={[styles.badgeText, { color: statusBadge.color }]}>
                {statusBadge.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <View style={styles.actionButtonLeft}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Workived Mobile v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Alert */}
      <CustomAlert
        visible={showLogoutAlert}
        title="Log Out"
        message="Are you sure you want to log out?"
        icon="log-out-outline"
        iconColor="#EF4444"
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setShowLogoutAlert(false),
          },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: confirmLogout,
          },
        ]}
        onDismiss={() => setShowLogoutAlert(false)}
      />
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6357E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFF',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  valueText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
})
