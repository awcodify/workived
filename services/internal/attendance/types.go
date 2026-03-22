package attendance

import (
	"time"

	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Record struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	EmployeeID     uuid.UUID  `json:"employee_id"`
	Date           string     `json:"date"` // YYYY-MM-DD in org timezone
	ClockInAt      time.Time  `json:"clock_in_at"`
	ClockOutAt     *time.Time `json:"clock_out_at,omitempty"`
	IsLate         bool       `json:"is_late"`
	Note           *string    `json:"note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// WorkSchedule is the narrow view of a work_schedule row the service needs.
type WorkSchedule struct {
	WorkDays  []int     // e.g. [1,2,3,4,5] — 0=Sun, 6=Sat
	StartTime time.Time // only the time component matters
}

// PublicHoliday is a minimal projection of the public_holidays table.
type PublicHoliday struct {
	Date string // YYYY-MM-DD
	Name string
}

// DailyEntry represents one employee's attendance for a given day in reports.
type DailyEntry struct {
	EmployeeID   uuid.UUID  `json:"employee_id"`
	EmployeeName string     `json:"employee_name"`
	Status       string     `json:"status"` // present, late, absent
	ClockInAt    *time.Time `json:"clock_in_at,omitempty"`
	ClockOutAt   *time.Time `json:"clock_out_at,omitempty"`
}

// MonthlySummary aggregates attendance counters for a single employee.
type MonthlySummary struct {
	EmployeeID   uuid.UUID `json:"employee_id"`
	EmployeeName string    `json:"employee_name"`
	Present      int       `json:"present"`
	Late         int       `json:"late"`
	Absent       int       `json:"absent"`
	WorkingDays  int       `json:"working_days"`
}

// WeekDay represents a single day in the week calendar view.
type WeekDay struct {
	Date       string     `json:"date"`       // "2026-03-17" (YYYY-MM-DD)
	DayName    string     `json:"day_name"`   // "Mon", "Tue", etc.
	DayNumber  int        `json:"day_number"` // 17
	Status     string     `json:"status"`     // "on-time", "late", "absent", "weekend", "future", "overtime", "on_leave"
	ClockInAt  *time.Time `json:"clock_in_at,omitempty"`
	ClockOutAt *time.Time `json:"clock_out_at,omitempty"`
	IsToday    bool       `json:"is_today"`
}

// WeekCalendar contains 7 days (Monday–Sunday) for the week calendar view.
type WeekCalendar struct {
	StartDate string    `json:"start_date"` // Monday's date (YYYY-MM-DD)
	EndDate   string    `json:"end_date"`   // Sunday's date (YYYY-MM-DD)
	Days      []WeekDay `json:"days"`       // Always 7 elements
}

// TeamWeekEntry represents one employee's week calendar in the team view.
type TeamWeekEntry struct {
	EmployeeID   uuid.UUID     `json:"employee_id"`
	EmployeeName string        `json:"employee_name"`
	Week         *WeekCalendar `json:"week"`
}

// ActiveEmployee is a minimal employee projection for attendance calculations.
type ActiveEmployee struct {
	ID       uuid.UUID
	FullName string
}

// ── Request / Response types ──────────────────────────────────────────────────

// ClockInRequest is the internal service request (includes resolved employee_id).
type ClockInRequest struct {
	EmployeeID uuid.UUID `json:"employee_id" validate:"required"`
	Note       *string   `json:"note"        validate:"omitempty,max=500"`
}

// ClockOutRequest is the internal service request (includes resolved employee_id).
type ClockOutRequest struct {
	EmployeeID uuid.UUID `json:"employee_id" validate:"required"`
	Note       *string   `json:"note"        validate:"omitempty,max=500"`
}

// clockHTTPRequest is the public API request body — no employee_id, auto-resolved from JWT.
type clockHTTPRequest struct {
	Note *string `json:"note" validate:"omitempty,max=500"`
}

type DailyReportFilters struct {
	Date       string     // YYYY-MM-DD
	EmployeeID *uuid.UUID // Optional: filter by employee (for non-admins)
}

type MonthlyReportFilters struct {
	Year  int
	Month int // 1–12
}
