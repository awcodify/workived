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

export interface VerifyInvitationResponse {
  email: string
  role: string
  org_name: string
  is_valid: boolean
  error_message?: string
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
  reporting_to?: string
  manager_name?: string
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
  end_date?: string
  reporting_to?: string
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

// ── Leave ───────────────────────────────────────────────────
export interface LeavePolicy {
  id: string
  organisation_id: string
  name: string
  description?: string
  days_per_year: number
  carry_over_days: number
  min_tenure_days: number
  requires_approval: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeaveBalance {
  id: string
  organisation_id: string
  employee_id: string
  leave_policy_id: string
  year: number
  entitled_days: number
  carried_over_days: number
  used_days: number
  pending_days: number
  created_at: string
  updated_at: string
}

export interface LeaveBalanceWithPolicy extends LeaveBalance {
  policy_name: string
  policy_description?: string
}

export interface LeaveRequest {
  id: string
  organisation_id: string
  employee_id: string
  leave_policy_id: string
  start_date: string  // YYYY-MM-DD
  end_date: string    // YYYY-MM-DD
  total_days: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by?: string
  reviewed_at?: string
  review_note?: string
  created_at: string
  updated_at: string
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  employee_name: string
  policy_name: string
}

export interface PolicyTemplate {
  id: string
  country_code: string
  name: string
  description?: string
  entitled_days_per_year: number
  is_carry_over_allowed: boolean
  max_carry_over_days?: number
  is_accrued: boolean
  requires_approval: boolean
  sort_order: number
  created_at: string
}

export interface ImportPoliciesResult {
  created_count: number
  policies: LeavePolicy[]
}

export interface CalendarEntry {
  employee_id: string
  employee_name: string
  policy_name: string
  start_date: string
  end_date: string
  total_days: number
}

export interface PublicHoliday {
  country_code: string
  date: string  // YYYY-MM-DD
  name: string
}

export interface CreatePolicyInput {
  name: string
  description?: string
  days_per_year: number
  carry_over_days?: number
  min_tenure_days?: number
  requires_approval?: boolean
}

export interface UpdatePolicyInput {
  name?: string
  description?: string
  days_per_year?: number
  carry_over_days?: number
  min_tenure_days?: number
  requires_approval?: boolean
}

export interface SubmitRequestInput {
  leave_policy_id: string
  start_date: string
  end_date: string
  reason?: string
}

export interface ReviewInput {
  note?: string
}

// ── Claims ───────────────────────────────────────────────────
export interface ClaimCategory {
  id: string
  organisation_id: string
  name: string
  monthly_limit?: number  // Smallest currency unit
  currency_code: string   // Always set to org's currency
  requires_receipt: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CategoryTemplate {
  id: string
  country_code: string
  name: string
  description?: string
  monthly_limit?: number  // Main currency unit for templates
  currency_code?: string
  requires_receipt: boolean
  sort_order: number
  created_at: string
}

export interface Claim {
  id: string
  organisation_id: string
  employee_id: string
  category_id: string
  amount: number  // Smallest currency unit
  currency_code: string
  description: string
  claim_date: string  // YYYY-MM-DD
  receipt_url?: string  // Presigned URL (15min expiry)
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by?: string
  reviewed_at?: string
  review_note?: string
  created_at: string
  updated_at: string
}

export interface ClaimWithDetails extends Claim {
  employee_name: string
  category_name: string
}

export interface ClaimBalance {
  id: string
  organisation_id: string
  employee_id: string
  category_id: string
  year: number
  month: number
  total_spent: number  // Smallest currency unit
  claim_count: number
  currency_code: string
  monthly_limit?: number  // Smallest currency unit
  created_at: string
  updated_at: string
}

export interface ClaimBalanceWithCategory extends ClaimBalance {
  category_name: string
  remaining?: number  // monthly_limit - total_spent
}

export interface ClaimMonthlySummary {
  employee_id: string
  employee_name: string
  total_amount: number
  claim_count: number
  currency_code: string
}

export interface CreateCategoryInput {
  name: string
  monthly_limit?: number
  currency_code?: string
  requires_receipt: boolean
}

export interface UpdateCategoryInput {
  name?: string
  monthly_limit?: number
  currency_code?: string
  requires_receipt?: boolean
}

export interface SubmitClaimInput {
  category_id: string
  amount: number
  currency_code: string
  description: string
  claim_date: string  // YYYY-MM-DD
}

export interface ReviewClaimInput {
  review_note?: string
}

export interface ClaimFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
  employee_id?: string
  category_id?: string
  start_date?: string  // YYYY-MM-DD
  end_date?: string    // YYYY-MM-DD
  cursor?: string
  limit?: number
}

// ── Org Chart ────────────────────────────────────────────────
export interface OrgChartNode {
  id: string
  full_name: string
  email?: string
  job_title?: string
  department_id?: string
  employment_type: string
  status: string
  reporting_to?: string
  direct_reports?: OrgChartNode[]
}

// ── API wrapper ──────────────────────────────────────────────
// All API responses are wrapped in {"data": ...}
export interface ApiResponse<T> {
  data: T
}
