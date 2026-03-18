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

// ActiveEmployee is a minimal employee projection for attendance calculations.
type ActiveEmployee struct {
	ID       uuid.UUID
	FullName string
}

// ── Request / Response types ──────────────────────────────────────────────────

type ClockInRequest struct {
	EmployeeID uuid.UUID `json:"employee_id" validate:"required"`
	Note       *string   `json:"note"        validate:"omitempty,max=500"`
}

type ClockOutRequest struct {
	EmployeeID uuid.UUID `json:"employee_id" validate:"required"`
	Note       *string   `json:"note"        validate:"omitempty,max=500"`
}

type DailyReportFilters struct {
	Date string // YYYY-MM-DD
}

type MonthlyReportFilters struct {
	Year  int
	Month int // 1–12
}
