import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/api/client'
import HomeScreen from '@/screens/HomeScreen'
import LeaveScreen from '@/screens/LeaveScreen'
import ClaimsScreen from '@/screens/ClaimsScreen'
import ApprovalsScreen from '@/screens/ApprovalsScreen'
import ProfileScreen from '@/screens/ProfileScreen'
import LoginScreen from '@/screens/LoginScreen'
import TeamRankingScreen from '@/screens/TeamRankingScreen'
import TeamScreen from '@/screens/TeamScreen'
import MyAttendanceScreen from '@/screens/MyAttendanceScreen'
import AttendanceCorrectionScreen from '@/screens/AttendanceCorrectionScreen'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  TeamRanking: undefined
  MyAttendance: { filter?: 'corrections' } | undefined
  AttendanceCorrection: undefined
}

export type MainTabParamList = {
  Home: undefined
  Leave: undefined
  Claims: undefined
  Approvals: { tab?: 'leave' | 'claim' | 'correction' } | undefined
  Team: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabs() {
  // Fetch approval count for badge
  const { data: approvalCount } = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: () => apiClient.getApprovalCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const badgeCount = approvalCount?.count || 0

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline'
          } else if (route.name === 'Leave') {
            iconName = focused ? 'calendar' : 'calendar-outline'
          } else if (route.name === 'Claims') {
            iconName = focused ? 'receipt' : 'receipt-outline'
          } else if (route.name === 'Approvals') {
            iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline'
          } else if (route.name === 'Team') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline'
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#6357E8',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Leave" component={LeaveScreen} />
      <Tab.Screen name="Claims" component={ClaimsScreen} />
      <Tab.Screen
        name="Approvals"
        component={ApprovalsScreen}
        options={{
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
        }}
      />
      <Tab.Screen name="Team" component={TeamScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6357E8" />
    </View>
  )
}

export default function Navigation() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="TeamRanking" component={TeamRankingScreen} />
            <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
            <Stack.Screen name="AttendanceCorrection" component={AttendanceCorrectionScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
})
