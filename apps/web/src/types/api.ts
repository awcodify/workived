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

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
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
  allow_web_clock_in: boolean
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
  allow_web_clock_in?: boolean
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

export interface UpdateMemberRoleRequest {
  role: MemberRole
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
  job_title?: string                          // Legacy free-text field
  job_title_id?: string                        // FK to job_titles table
  department_id?: string
  department_name?: string
  reporting_to?: string
  manager_name?: string
  work_schedule_name?: string
  invitation_pending?: boolean
  gender?: 'male' | 'female' | null
  work_schedule_id?: string | null
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
  job_title?: string         // Legacy free-text field
  job_title_id?: string      // FK to job_titles table
  department_id?: string
  employment_type: string
  start_date: string
  gender?: 'male' | 'female'
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  status?: string
  end_date?: string
  reporting_to?: string
  work_schedule_id?: string | null
}

export interface WorkScheduleListItem {
  id: string
  name: string
  work_days: number[]
  start_time: string
  end_time: string
  is_default: boolean
}

export interface WorkScheduleInput {
  name: string
  work_days: number[]
  start_time: string
  end_time: string
}

// Workload Intelligence Types
export type WorkloadStatus = 'available' | 'warning' | 'overloaded' | 'on_leave'

export interface WorkloadInfo {
  active_tasks: number
  overdue_tasks: number
  status: WorkloadStatus
}

export interface LeaveInfo {
  is_on_leave: boolean
  is_upcoming_leave: boolean
  leave_start?: string
  leave_end?: string
}

export interface EmployeeWorkload {
  employee_id: string
  full_name: string
  email?: string
  department_id?: string
  workload: WorkloadInfo
  leave: LeaveInfo
}

// ── Employment History ──────────────────────────────────────
export interface EmploymentChange {
  id: string
  organisation_id: string
  employee_id: string
  change_type: 'department' | 'title' | 'salary' | 'status' | 'employment_type'
  old_value?: string
  new_value?: string
  old_salary?: number
  new_salary?: number
  currency_code?: string
  effective_date: string
  reason?: string
  changed_by?: string
  created_at: string
  // Resolved names for display (populated via JOINs)
  old_department_name?: string
  new_department_name?: string
}

// ── Audit Logs ───────────────────────────────────────────────
export interface AuditLog {
  id: string
  organisation_id: string
  actor_user_id: string
  actor_name?: string
  action: string
  resource_type: string
  resource_id: string
  before_state?: Record<string, any>
  after_state?: Record<string, any>
  created_at: string
}

export interface AuditLogFilters {
  search?: string  // Global search across action, resource type, actor name, and changes
  resource_type?: string
  resource_id?: string
  actor_user_id?: string
  actor_name?: string  // Filter by actor's full name
  action?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

// ── Departments ──────────────────────────────────────────────
export interface Department {
  id: string
  organisation_id: string
  name: string
  is_active: boolean
  created_at: string
}
export interface JobTitle {
  id: string
  organisation_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  status: 'present' | 'late' | 'absent' | 'on_leave'
  clock_in_at?: string
  clock_out_at?: string
  note?: string
  clock_in_latitude?: number
  clock_in_longitude?: number
  clock_in_photo_url?: string
  work_location_type?: string
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

export interface MonthlySummary {
  employee_id: string
  employee_name: string
  present: number
  late: number
  absent: number
  leaving_early: number
  overtime: number
  working_days: number
}

export interface WeekDay {
  date: string // "2026-03-17"
  day_name: string // "Mon", "Tue", etc.
  day_number: number // 17
  status: 'on-time' | 'late' | 'absent' | 'weekend' | 'holiday' | 'future' | 'on_leave' | 'overtime'
  clock_in_at?: string
  clock_out_at?: string
  note?: string
  is_today: boolean
  is_leaving_early?: boolean
  is_overtime?: boolean
  is_corrected?: boolean
}

export interface WeekCalendar {
  start_date: string // Monday (YYYY-MM-DD)
  end_date: string // Sunday (YYYY-MM-DD)
  days: WeekDay[] // Always 7 elements
}

export interface TeamWeekEntry {
  employee_id: string
  employee_name: string
  work_schedule_name?: string
  week: WeekCalendar
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
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface SubmitCorrectionRequest {
  date: string
  requested_clock_in?: string
  requested_clock_out?: string
  reason: string
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
  schedule_id?: string
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ── Leave ───────────────────────────────────────────────────
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'

export interface LeavePolicy {
  id: string
  organisation_id: string
  name: string
  description?: string
  days_per_year: number
  carry_over_days: number
  min_tenure_days: number
  requires_approval: boolean
  is_unlimited: boolean
  gender_eligibility?: 'male' | 'female' | null
  eligible_employment_types?: EmploymentType[] | null
  max_lifetime_uses?: number | null
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
  is_unlimited: boolean
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
  reviewed_by_name?: string  // Name of person who reviewed (if reviewed)
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
  id?: string
  country_code: string
  date: string  // YYYY-MM-DD
  name: string
  organisation_id?: string
  is_custom?: boolean
}

export interface CreateCustomHolidayInput {
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
  gender_eligibility?: 'male' | 'female' | null
}

export interface UpdatePolicyInput {
  name?: string
  description?: string
  days_per_year?: number
  carry_over_days?: number
  min_tenure_days?: number
  requires_approval?: boolean
  gender_eligibility?: 'male' | 'female' | null
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
  description?: string | null
  monthly_limit?: number  // Smallest currency unit
  currency_code: string   // Always set to org's currency
  requires_receipt: boolean
  budget_period: 'monthly' | 'yearly'
  eligible_employment_types?: EmploymentType[] | null
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'paid'
  reviewed_by?: string
  reviewed_at?: string
  review_note?: string
  paid_at?: string
  paid_by?: string
  created_at: string
  updated_at: string
}

export interface ClaimWithDetails extends Claim {
  employee_name: string
  category_name: string
  paid_by_name?: string
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
  description?: string | null
  budget_period: 'monthly' | 'yearly'
  remaining?: number  // limit - total_spent
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
  description?: string | null
  monthly_limit?: number
  currency_code?: string
  requires_receipt: boolean
  budget_period?: 'monthly' | 'yearly'
}

export interface UpdateCategoryInput {
  name?: string
  description?: string | null
  monthly_limit?: number
  currency_code?: string
  requires_receipt?: boolean
  budget_period?: 'monthly' | 'yearly'
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

// ── Tasks ────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskList {
  id: string
  organisation_id: string
  name: string
  position: number
  is_final_state: boolean  // Auto-mark tasks as complete when moved to this list
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  organisation_id: string
  task_list_id: string
  title: string
  description?: string
  assignee_id?: string
  created_by: string
  priority: TaskPriority
  due_date?: string  // YYYY-MM-DD
  position: number
  completed_at?: string
  approval_type?: 'leave' | 'claim'
  approval_id?: string
  created_at: string
  updated_at: string
}

export type FieldType =
  | 'text' | 'number' | 'date' | 'boolean'
  | 'select' | 'multi_select' | 'url' | 'employee' | 'rating'

export interface FieldOption {
  value: string
  label: string
  color?: string
}

export interface FieldConfig {
  min?: number
  max?: number
  format?: string
}

export interface FieldDefinition {
  id: string
  organisation_id: string
  name: string
  field_type: FieldType
  description?: string
  options?: FieldOption[]
  config?: FieldConfig
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FieldValueWithDefinition {
  field_id: string
  field_name: string
  field_type: FieldType
  value_text?: string
  value_number?: number
  value_date?: string
  value_boolean?: boolean
  value_json?: unknown
}

export interface CreateFieldDefinitionInput {
  name: string
  field_type: FieldType
  description?: string
  options?: FieldOption[]
  config?: FieldConfig
  sort_order?: number
}

export interface UpdateFieldDefinitionInput {
  name?: string
  description?: string
  options?: FieldOption[]
  config?: FieldConfig
  sort_order?: number
}

export interface TaskWithDetails extends Task {
  assignee_name?: string
  creator_name: string
  list_name: string
  field_values?: FieldValueWithDefinition[]
}

export interface TaskComment {
  id: string
  organisation_id: string
  task_id: string
  author_id: string
  parent_id?: string
  body: string
  content_type: 'plain' | 'markdown'
  created_at: string
  updated_at: string
}

export interface TaskCommentWithAuthor extends TaskComment {
  author_name: string
  replies?: TaskCommentWithAuthor[]
}

export interface CommentReactionSummary {
  emoji: string
  count: number
  user_reacted: boolean
}

export interface CreateTaskListInput {
  name: string
}

export interface UpdateTaskListInput {
  name?: string
  position?: number
}

export interface CreateTaskInput {
  task_list_id: string
  title: string
  description?: string
  assignee_id?: string
  priority?: TaskPriority
  due_date?: string  // YYYY-MM-DD
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  assignee_id?: string
  priority?: TaskPriority
  due_date?: string  // YYYY-MM-DD
}

export interface MoveTaskInput {
  task_list_id: string
  position: number
}

export interface CreateTaskCommentInput {
  parent_id?: string
  body: string
  content_type?: 'plain' | 'markdown'
}

export interface TaskFilters {
  task_list_id?: string
  assignee_id?: string
  priority?: TaskPriority
  status?: 'pending' | 'completed'
  include_completed?: boolean
  search?: string
  completed_after?: string
  completed_before?: string
  cursor?: string
  limit?: number
}

// ── Setup Wizard  ────────────────────────────────────────────
export interface SetupStatus {
  needs_setup: boolean
  skipped: boolean
  completed_at?: string
  work_schedule_exists: boolean
  leave_policies_count: number
  claim_categories_count: number
  members_count: number
}

export interface WorkScheduleTemplate {
  id: string
  country_code: string
  name: string
  description: string
  work_days: number[]  // 1=Mon, 7=Sun
  start_time: string   // HH:MM
  end_time: string     // HH:MM
  sort_order: number
}

export interface LeavePolicyTemplate {
  id: string
  country_code: string
  name: string
  description: string
  entitled_days_per_year: number
  is_carry_over_allowed: boolean
  max_carry_over_days: number
  is_accrued: boolean
  requires_approval: boolean
  gender_eligibility?: 'male' | 'female' | null
  sort_order: number
}

export interface ClaimCategoryTemplate {
  id: string
  country_code: string
  name: string
  description: string
  monthly_limit?: number
  currency_code?: string
  requires_receipt: boolean
  budget_period: 'monthly' | 'yearly'
  sort_order: number
}

export interface SetupTemplatesResponse {
  work_schedules: WorkScheduleTemplate[]
  leave_policies: LeavePolicyTemplate[]
  claim_categories: ClaimCategoryTemplate[]
}

export interface CustomScheduleInput {
  name: string
  work_days: number[]
  start_time: string
  end_time: string
}

export interface WorkScheduleChoice {
  template_id?: string
  custom_schedule?: CustomScheduleInput
}

export interface LeavePolicyCustomization {
  days_per_year?: number
}

export interface ClaimCategoryCustomization {
  monthly_limit?: number
}

export interface LeavePolicySelection {
  template_ids: string[]
  customizations?: Record<string, LeavePolicyCustomization>
}

export interface ClaimCategorySelection {
  template_ids: string[]
  customizations?: Record<string, ClaimCategoryCustomization>
}

export interface InvitationInput {
  email: string
  role: MemberRole
}

export interface CompleteSetupRequest {
  work_schedule: WorkScheduleChoice
  leave_policies: LeavePolicySelection
  claim_categories: ClaimCategorySelection
  invitations?: InvitationInput[]
}

export interface CompleteSetupResponse {
  success: boolean
  work_schedule_id: string
  leave_policy_ids: string[]
  claim_category_ids: string[]
  invitation_ids: string[]
}

// ── Reports / Scorecard ─────────────────────────────────────

export interface ScorecardConfig {
  id: string
  organisation_id: string
  attendance_weight: number
  punctuality_weight: number
  leave_weight: number
  tasks_weight: number
  grade_a_min: number
  grade_b_min: number
  grade_c_min: number
  late_flag_threshold: number
  leave_warning_pct: number
  task_concern_pct: number
  score_drop_threshold: number
  min_working_days: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConfigUpdateInput {
  attendance_weight: number
  punctuality_weight: number
  leave_weight: number
  tasks_weight: number
  grade_a_min: number
  grade_b_min: number
  grade_c_min: number
  late_flag_threshold: number
  leave_warning_pct: number
  task_concern_pct: number
  score_drop_threshold: number
  min_working_days: number
}

export interface Breakdown {
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
  grade: 'A' | 'B' | 'C' | 'D'
  trend: number
  breakdown: Record<string, Breakdown>
  flags: ScorecardFlag[]
  sufficient: boolean
}

export interface EmployeeScore {
  employee_id: string
  employee_name: string
  department: string
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D'
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

export interface PerformerHighlight {
  employee_id: string
  name: string
  score: number
  trend?: number
}

export interface DepartmentBreakdown {
  department: string
  avg_score: number
  employee_count: number
}

export interface CompanySummary {
  period: string
  period_label: string
  attendance_rate: number
  punctuality_rate: number
  task_completion_rate: number
  leave_utilization: number
  avg_score: number
  top_performer: PerformerHighlight | null
  most_improved: PerformerHighlight | null
  needs_attention_count: number
  department_breakdown: DepartmentBreakdown[]
}

// ── Dashboard / Analytics ────────────────────────────────────

export type WidgetType = 'kpi' | 'table' | 'bar' | 'line' | 'divider' | 'text'
export type AggregateType = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max'
export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is_null' | 'not_null'
export type DateRangeAlias =
  | 'today' | 'this_week' | 'this_month' | 'last_30_days'
  | 'this_quarter' | 'this_year' | 'last_year'

export interface QueryFilter {
  field: string
  op: FilterOp
  value?: unknown
}

export interface QueryConfig {
  source: string
  aggregate?: AggregateType
  field?: string        // "priority", "field:uuid"
  group_by?: string     // date field override for line; categorical for bar
  facet?: string        // categorical split for multi-series line
  date_bucket?: 'day' | 'week' | 'month'
  columns?: string[]    // table widget
  filters?: QueryFilter[]
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  limit?: number
  date_range?: DateRangeAlias
}

export interface VizConfig {
  color?: string
  unit?: string
  show_delta?: boolean
  compare_with?: 'previous_period'
  content?: string
}

export interface Dashboard {
  id: string
  organisation_id: string
  name: string
  is_default: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Widget {
  id: string
  organisation_id: string
  dashboard_id: string
  title: string
  widget_type: WidgetType
  query_config: QueryConfig
  viz_config: VizConfig
  position_x: number
  position_y: number
  width: number
  height: number
  created_at: string
  updated_at: string
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  value?: number // scalar for KPI widgets
}

// ── Announcements ────────────────────────────────────────────
export interface Announcement {
  id: string
  organisation_id: string
  author_id: string
  author_name: string
  title: string
  body: string
  is_pinned: boolean
  is_read: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAnnouncementRequest {
  title: string
  body: string
  is_pinned?: boolean
  publish?: boolean
}

export interface UpdateAnnouncementRequest {
  title: string
  body: string
  is_pinned?: boolean
}

// ── API wrapper ──────────────────────────────────────────────
// All API responses are wrapped in {"data": ...}
export interface ApiResponse<T> {
  data: T
}
