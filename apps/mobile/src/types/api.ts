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
    correction_count: number
  }
  week_attendance: {
    days: string[]
    percentage: number
  }
  my_tasks: TaskInfo[]
  week_offset: number // 0 = this week, -1 = last week
}

export interface WeekDay {
  date: string          // "2026-03-17" (YYYY-MM-DD)
  day_name: string      // "Mon", "Tue", etc.
  day_number: number
  status: 'on-time' | 'late' | 'absent' | 'weekend' | 'future' | 'overtime' | 'on_leave'
  clock_in_at: string | null
  clock_out_at: string | null
  note: string | null
  is_today: boolean
  is_leaving_early: boolean
  is_overtime: boolean
  is_corrected: boolean
}

export interface WeekCalendar {
  start_date: string  // Monday YYYY-MM-DD
  end_date: string    // Sunday YYYY-MM-DD
  days: WeekDay[]     // Always 7 elements
}

export interface TaskInfo {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null // YYYY-MM-DD
  list_name: string
  creator_name: string
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

export interface DirectReport {
  id: string
  full_name: string
  email: string | null
  job_title: string | null
  department_name: string | null
  employment_type: string
  status: string
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

export interface PresignResponse {
  upload_url: string
  key: string
}

export interface LocationBreakdownItem {
  type: string
  count: number
  percentage: number
}

export interface LocationAnalytics {
  total: number
  breakdown: LocationBreakdownItem[]
  start_date: string
  end_date: string
}

export interface AttendanceCorrection {
  id: string
  organisation_id: string
  employee_id: string
  employee_name: string
  record_id?: string
  date: string
  original_clock_in?: string
  original_clock_out?: string
  requested_clock_in?: string
  requested_clock_out?: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface SubmitCorrectionRequest {
  date: string              // YYYY-MM-DD
  requested_clock_in?: string  // ISO timestamp
  requested_clock_out?: string // ISO timestamp
  reason: string
}

export interface ScorecardBreakdown {
  score: number
  detail: string
}

export interface ScorecardFlag {
  type: string
  message: string
  severity: 'warning' | 'alert'
}

export interface Scorecard {
  employee_id: string
  employee_name: string
  department: string
  period: string
  period_label: string
  start_date: string
  end_date: string
  overall_score: number
  grade: string
  trend: number
  breakdown: {
    attendance: ScorecardBreakdown
    punctuality: ScorecardBreakdown
    leave: ScorecardBreakdown
    tasks: ScorecardBreakdown
  }
  flags: ScorecardFlag[]
  sufficient: boolean
}

export interface EmployeeScore {
  employee_id: string
  employee_name: string
  department: string
  overall_score: number
  grade: string
  trend: number
  attendance_score: number
  punctuality_score: number
  leave_score: number
  tasks_score: number
}

export interface TeamScorecard {
  period: string
  period_label: string
  start_date: string
  end_date: string
  team_average: number
  employees: EmployeeScore[]
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
