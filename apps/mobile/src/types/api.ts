// Shared API types from backend
// These match the backend Go types

export interface MobileHomeData {
  employee: {
    name: string
    role: string
  }
  clock_status: {
    is_clocked_in: boolean
    last_clock_in: string | null
    last_clock_out: string | null
    hours_worked_today: number | null
  }
  leave_balance: {
    annual: number
    sick: number
    unpaid: number
  }
  pending_approvals: {
    count: number
    items: Array<{
      employee_name: string
      type: string
      summary: string
    }>
  }
  week_attendance: {
    days: string[]
    percentage: number
  }
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: 'present' | 'late' | 'absent' | 'on_leave'
  work_location_type: 'office' | 'wfh' | 'wfa' | null
  clock_in_photo_url: string | null
  clock_out_photo_url: string | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  note: string | null
  hours_worked: number | null
  is_overtime: boolean
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  data: T
  error?: {
    code: string
    message: string
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}
