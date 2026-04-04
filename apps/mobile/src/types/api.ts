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
    clock_in_latitude: number | null
    clock_in_longitude: number | null
    clock_out_latitude: number | null
    clock_out_longitude: number | null
    work_location_type: string | null
  }
  leave_balance: {
    annual: number
    sick: number
    unpaid: number
  }
  pending_approvals: {
    leave_count: number
    claim_count: number
  }
  week_attendance: {
    days: string[]
    percentage: number
  }
  week_offset: number // 0 = this week, -1 = last week
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
  refresh_token?: string  // Optional - backend sends this via httpOnly cookie
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

export interface LeavePolicy {
  id: string
  name: string
  days_per_year: number
  requires_approval: boolean
  can_carry_forward: boolean
}

export interface LeaveRequest {
  leave_policy_id: string
  start_date: string  // YYYY-MM-DD format
  end_date: string    // YYYY-MM-DD format
  reason?: string
}

export interface LeaveRequestResponse {
  id: string
  employee_id: string
  leave_policy_id: string
  start_date: string
  end_date: string
  working_days: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
}

export interface LeaveRequestWithDetails {
  id: string
  organisation_id: string
  employee_id: string
  leave_policy_id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  employee_name: string
  policy_name: string
  reviewed_by_name: string | null
  requested_at: string
}

export interface ClaimWithDetails {
  id: string
  organisation_id: string
  employee_id: string
  category_id: string
  amount: number
  currency_code: string
  description: string
  claim_date: string
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'paid'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  paid_at: string | null
  paid_by: string | null
  created_at: string
  updated_at: string
  employee_name: string
  category_name: string
}

export interface EmployeeProfile {
  id: string
  organisation_id: string
  user_id: string | null
  employee_code: string | null
  full_name: string
  email: string | null
  phone: string | null
  department_id: string | null
  job_title: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern'
  status: 'active' | 'on_leave' | 'probation' | 'inactive'
  reporting_to: string | null
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Extended fields from EmployeeWithManager
  manager_name: string | null
  department_name: string | null
  work_schedule_name: string | null
  invitation_pending: boolean
}

export interface ClaimCategory {
  id: string
  organisation_id: string
  name: string
  description: string | null
  monthly_limit: number | null
  currency_code: string
  requires_receipt: boolean
  is_unlimited: boolean
  budget_period: 'monthly' | 'yearly'
  eligible_employment_types: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SubmitClaimRequest {
  category_id: string
  amount: number
  currency_code: string
  description: string
  claim_date: string // YYYY-MM-DD
  receipt?: File | null
}

export interface ClaimResponse {
  id: string
  organisation_id: string
  employee_id: string
  category_id: string
  amount: number
  currency_code: string
  description: string
  claim_date: string
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'paid'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  paid_at: string | null
  paid_by: string | null
  created_at: string
  updated_at: string
}

export interface ClaimBalanceWithCategory {
  id: string
  organisation_id: string
  employee_id: string
  category_id: string
  year: number
  month: number
  total_spent: number // smallest currency unit
  claim_count: number
  currency_code: string
  monthly_limit: number | null
  category_name: string
  description: string | null
  budget_period: 'monthly' | 'yearly'
  remaining: number | null
  created_at: string
  updated_at: string
}
