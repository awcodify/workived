// ── Auth ─────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  user: User
}

export interface RefreshResponse {
  access_token: string
}

export interface User {
  id: string
  email: string
  full_name: string
  is_verified: boolean
  is_active: boolean
}

// ── Employees ────────────────────────────────────────────────
export interface Employee {
  id: string
  organisation_id: string
  full_name: string
  email: string
  phone?: string
  job_title?: string
  department_id?: string
  department_name?: string
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern'
  status: 'active' | 'probation' | 'inactive'
  start_date: string
  end_date?: string
  base_salary?: number
  salary_currency?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateEmployeeInput {
  full_name: string
  email: string
  phone?: string
  job_title?: string
  department_id?: string
  employment_type: string
  start_date: string
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  status?: string
}

// ── Departments ──────────────────────────────────────────────
export interface Department {
  id: string
  organisation_id: string
  name: string
  is_active: boolean
  created_at: string
}

// ── Attendance ───────────────────────────────────────────────
export interface AttendanceRecord {
  id: string
  organisation_id: string
  employee_id: string
  date: string
  clock_in_at: string
  clock_out_at?: string
  is_late: boolean
  note?: string
  created_at: string
  updated_at: string
}

export interface DailyEntry {
  employee_id: string
  employee_name: string
  status: 'present' | 'late' | 'absent'
  clock_in_at?: string
  clock_out_at?: string
  note?: string
}

export interface MonthlySummary {
  employee_id: string
  employee_name: string
  present: number
  late: number
  absent: number
  working_days: number
}

// ── Shared ───────────────────────────────────────────────────
// API uses cursor-based pagination
export interface CursorMeta {
  next_cursor?: string
  has_more: boolean
  limit: number
}

export interface ListParams {
  cursor?: string
  limit?: number
  search?: string
  status?: string
  department_id?: string
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ── API wrapper ──────────────────────────────────────────────
// All API responses are wrapped in {"data": ...}
export interface ApiResponse<T> {
  data: T
}
