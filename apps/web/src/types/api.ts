// ── Auth ─────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
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

// ── Organisation ────────────────────────────────────────────
export interface Organisation {
  id: string
  name: string
  slug: string
  country_code: string
  timezone: string
  currency_code: string
  work_days: number[]
  plan: 'free' | 'pro' | 'enterprise'
  plan_employee_limit?: number
  is_active: boolean
  created_at: string
}

export interface CreateOrgRequest {
  name: string
  slug: string
  country_code: string
  timezone: string
  currency_code: string
}

export interface CreateOrgResponse {
  access_token: string
  organisation: Organisation
}

export interface UpdateOrgRequest {
  name?: string
  slug?: string
  country_code?: string
  timezone?: string
  currency_code?: string
}

export interface TransferOwnershipRequest {
  new_owner_user_id: string
}

export interface OrgDetail extends Organisation {
  employee_count: number
  owner_name: string
}

// ── Invitations ─────────────────────────────────────────────
export type MemberRole = 'owner' | 'admin' | 'member' | 'hr_admin' | 'manager' | 'finance'

export interface InviteMemberRequest {
  email: string
  role: MemberRole
  employee_id?: string
}

export interface InviteResponse {
  id: string
  email: string
  role: string
  invite_url: string
  expires_at: string
}

export interface AcceptInvitationRequest {
  token: string
}

export interface AcceptInvitationResponse {
  access_token: string
  organisation: Organisation
  member: {
    id: string
    user_id: string
    organisation_id: string
    employee_id?: string
    role: string
    is_active: boolean
    joined_at: string
  }
}

export interface PendingInvitation {
  id: string
  organisation_id: string
  email: string
  role: string
  invited_by: string
  invite_url: string
  employee_id?: string
  expires_at: string
  created_at: string
}

// ── Employees ────────────────────────────────────────────────
export interface UnlinkedMember {
  user_id: string
  full_name: string
  email: string
  role: string
}

export interface MyInvitation extends PendingInvitation {
  org_name: string
  org_slug: string
}

export interface MemberWithProfile {
  id: string
  user_id: string
  organisation_id: string
  employee_id?: string
  role: MemberRole
  joined_at: string
  full_name: string
  email: string
  has_hr_profile: boolean
  hr_profile_active: boolean
}

export interface Employee {
  id: string
  organisation_id: string
  full_name: string
  email?: string
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
  email?: string
  user_id?: string
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
