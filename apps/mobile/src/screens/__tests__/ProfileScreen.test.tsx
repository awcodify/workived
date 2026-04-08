import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import ProfileScreen from '../ProfileScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'

jest.mock('@/contexts/AuthContext')
jest.mock('@tanstack/react-query')
jest.mock('@/api/client')
jest.mock('@/components/CustomAlert', () => ({
  CustomAlert: ({ visible, buttons }: { visible: boolean; buttons: { text: string; onPress: () => void }[] }) => {
    if (!visible) return null
    const { View, Text, TouchableOpacity } = require('react-native')
    return (
      <View testID="custom-alert">
        {buttons.map((b) => (
          <TouchableOpacity key={b.text} onPress={b.onPress}>
            <Text>{b.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  },
}))

const mockLogout = jest.fn()
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

const baseProfile = {
  id: 'emp-1',
  full_name: 'Ahmad Rizki',
  email: 'ahmad@workived.com',
  job_title: 'CEO',
  department_name: 'Executive',
  employee_code: 'EMP-001',
  employment_type: 'full_time',
  status: 'active',
  start_date: '2024-01-15',
  manager_name: null,
  work_schedule_name: null,
  invitation_pending: false,
  organisation_id: 'org-1',
  user_id: 'user-1',
  phone: null,
  department_id: null,
  reporting_to: null,
  end_date: null,
  is_active: true,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
}

function setupQueries(profileOverrides = {}, directs: object[] = []) {
  let callCount = 0
  mockUseQuery.mockImplementation((opts: any) => {
    callCount++
    if (opts.queryKey?.[0] === 'employee-profile') {
      return { data: { ...baseProfile, ...profileOverrides }, isLoading: false, error: null } as any
    }
    // directs query
    return { data: directs } as any
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAuth.mockReturnValue({
    login: jest.fn(),
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', email: 'ahmad@workived.com', name: 'Ahmad Rizki', role: 'owner' },
  })
})

describe('ProfileScreen — loading & error states', () => {
  it('shows loading spinner while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null } as any)
    render(<ProfileScreen />)
    expect(screen.getByText('Loading profile...')).toBeTruthy()
  })

  it('shows error state when fetch fails', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') } as any)
    render(<ProfileScreen />)
    expect(screen.getByText('Failed to load profile')).toBeTruthy()
  })
})

describe('ProfileScreen — profile info', () => {
  it('renders name, email and job title', () => {
    setupQueries()
    render(<ProfileScreen />)
    expect(screen.getByText('Ahmad Rizki')).toBeTruthy()
    expect(screen.getByText('ahmad@workived.com')).toBeTruthy()
    expect(screen.getByText('CEO')).toBeTruthy()
  })

  it('renders employee code and department', () => {
    setupQueries()
    render(<ProfileScreen />)
    expect(screen.getByText('EMP-001')).toBeTruthy()
    expect(screen.getByText('Executive')).toBeTruthy()
  })

  it('shows Full-time employment type badge', () => {
    setupQueries()
    render(<ProfileScreen />)
    expect(screen.getByText('Full-time')).toBeTruthy()
  })

  it('shows Active status badge', () => {
    setupQueries()
    render(<ProfileScreen />)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('renders avatar initials from full name', () => {
    setupQueries()
    render(<ProfileScreen />)
    // AR initials in avatar
    expect(screen.getAllByText('AR').length).toBeGreaterThan(0)
  })
})

describe('ProfileScreen — org chart', () => {
  it('hides Organisation section when no manager and no directs', () => {
    setupQueries({ manager_name: null }, [])
    render(<ProfileScreen />)
    expect(screen.queryByText('Organisation')).toBeNull()
  })

  it('shows Organisation section with manager card', () => {
    setupQueries({ manager_name: 'Budi Santoso' })
    render(<ProfileScreen />)
    expect(screen.getByText('Organisation')).toBeTruthy()
    expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0)
    expect(screen.getByText('Reports to')).toBeTruthy()
  })

  it('shows self node highlighted', () => {
    setupQueries({ manager_name: 'Budi Santoso' })
    render(<ProfileScreen />)
    expect(screen.getByText('You')).toBeTruthy()
  })

  it('shows direct reports count and names', () => {
    setupQueries({ manager_name: null }, [
      { id: 'emp-2', full_name: 'Citra Dewi', job_title: 'Engineer', department_name: 'Tech', employment_type: 'full_time', status: 'active' },
      { id: 'emp-3', full_name: 'Dodi Pratama', job_title: 'Designer', department_name: 'Tech', employment_type: 'full_time', status: 'active' },
    ])
    render(<ProfileScreen />)
    expect(screen.getByText('2 direct reports')).toBeTruthy()
    expect(screen.getByText('Citra Dewi')).toBeTruthy()
    expect(screen.getByText('Dodi Pratama')).toBeTruthy()
  })

  it('shows singular "direct report" for one report', () => {
    setupQueries({ manager_name: null }, [
      { id: 'emp-2', full_name: 'Citra Dewi', job_title: 'Engineer', department_name: 'Tech', employment_type: 'full_time', status: 'active' },
    ])
    render(<ProfileScreen />)
    expect(screen.getByText('1 direct report')).toBeTruthy()
  })
})

describe('ProfileScreen — direct report modal', () => {
  const reports = [
    { id: 'emp-2', full_name: 'Citra Dewi', job_title: 'Engineer', department_name: 'Tech', employment_type: 'full_time', status: 'active' },
  ]

  it('opens modal when tapping a direct report', async () => {
    setupQueries({ manager_name: null }, reports)
    render(<ProfileScreen />)

    fireEvent.press(screen.getByLabelText("View Citra Dewi's profile"))

    await waitFor(() => {
      expect(screen.getAllByText('Citra Dewi').length).toBeGreaterThan(1)
      expect(screen.getAllByText('Engineer').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Tech').length).toBeGreaterThan(0)
    })
  })

  it('closes modal when Close is pressed', async () => {
    setupQueries({ manager_name: null }, reports)
    render(<ProfileScreen />)

    fireEvent.press(screen.getByLabelText("View Citra Dewi's profile"))
    await waitFor(() => screen.getByText('Close'))

    fireEvent.press(screen.getByText('Close'))

    await waitFor(() => {
      expect(screen.queryByText('Close')).toBeNull()
    })
  })
})

describe('ProfileScreen — logout', () => {
  it('shows logout confirmation when Log Out pressed', () => {
    setupQueries()
    render(<ProfileScreen />)
    fireEvent.press(screen.getByText('Log Out'))
    expect(screen.getByTestId('custom-alert')).toBeTruthy()
  })

  it('calls logout when confirmed', async () => {
    mockLogout.mockResolvedValueOnce(undefined)
    setupQueries()
    render(<ProfileScreen />)

    // First press opens the alert
    fireEvent.press(screen.getAllByText('Log Out')[0]!)
    // Second press confirms in the alert
    const logOutButtons = screen.getAllByText('Log Out')
    fireEvent.press(logOutButtons[logOutButtons.length - 1]!)

    await waitFor(() => expect(mockLogout).toHaveBeenCalled())
  })
})
