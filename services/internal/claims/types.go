package claims

import (
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/approval"
)

// Category represents an expense claim category.
type Category struct {
	ID              uuid.UUID `json:"id"`
	OrganisationID  uuid.UUID `json:"organisation_id"`
	Name            string    `json:"name"`
	MonthlyLimit    *int64    `json:"monthly_limit,omitempty"` // Pro only, smallest currency unit
	CurrencyCode    *string   `json:"currency_code,omitempty"` // Required if monthly_limit set
	RequiresReceipt bool      `json:"requires_receipt"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CategoryTemplate represents a pre-defined category template for a country.
type CategoryTemplate struct {
	ID              uuid.UUID `json:"id"`
	CountryCode     string    `json:"country_code"`
	Name            string    `json:"name"`
	Description     *string   `json:"description,omitempty"`
	MonthlyLimit    *int64    `json:"monthly_limit,omitempty"` // Smallest currency unit
	CurrencyCode    *string   `json:"currency_code,omitempty"`
	RequiresReceipt bool      `json:"requires_receipt"`
	SortOrder       int       `json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
}

// Claim represents an expense claim.
type Claim struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	EmployeeID     uuid.UUID `json:"employee_id"`
	CategoryID     uuid.UUID `json:"category_id"`
	Amount         int64     `json:"amount"` // Smallest currency unit
	CurrencyCode   string    `json:"currency_code"`
	Description    string    `json:"description"`
	ClaimDate      time.Time `json:"claim_date"`
	ReceiptURL     *string   `json:"receipt_url,omitempty"` // S3 key, not full URL
	Status         string    `json:"status"`                // approval.Status*
	approval.ReviewInfo
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ClaimWithDetails is a denormalized view for display.
type ClaimWithDetails struct {
	Claim
	EmployeeName string `json:"employee_name"`
	CategoryName string `json:"category_name"`
}

// ClaimBalance tracks monthly spending per employee per category.
type ClaimBalance struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	EmployeeID     uuid.UUID `json:"employee_id"`
	CategoryID     uuid.UUID `json:"category_id"`
	Year           int       `json:"year"`
	Month          int       `json:"month"`
	TotalSpent     int64     `json:"total_spent"` // Smallest currency unit
	ClaimCount     int       `json:"claim_count"`
	CurrencyCode   string    `json:"currency_code"`
	MonthlyLimit   *int64    `json:"monthly_limit,omitempty"` // Copied from category
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ClaimBalanceWithCategory includes category name for display.
type ClaimBalanceWithCategory struct {
	ClaimBalance
	CategoryName string `json:"category_name"`
	Remaining    *int64 `json:"remaining,omitempty"` // monthly_limit - total_spent
}

// ── Request types ─────────────────────────────────────────────────────────────

type CreateCategoryRequest struct {
	Name            string  `json:"name" binding:"required,max=100"`
	MonthlyLimit    *int64  `json:"monthly_limit,omitempty"` // Pro only
	CurrencyCode    *string `json:"currency_code,omitempty"`
	RequiresReceipt bool    `json:"requires_receipt"`
}

type UpdateCategoryRequest struct {
	Name            *string `json:"name,omitempty"`
	MonthlyLimit    *int64  `json:"monthly_limit,omitempty"`
	CurrencyCode    *string `json:"currency_code,omitempty"`
	RequiresReceipt *bool   `json:"requires_receipt,omitempty"`
}

type SubmitClaimRequest struct {
	CategoryID   uuid.UUID `json:"category_id" binding:"required"`
	Amount       int64     `json:"amount" binding:"required,min=1"`
	CurrencyCode string    `json:"currency_code" binding:"required,len=3"`
	Description  string    `json:"description" binding:"required,max=500"`
	ClaimDate    time.Time `json:"claim_date" binding:"required"`
	// Receipt is handled via multipart form, not JSON
}

type ApproveClaimRequest struct {
	ReviewNote *string `json:"review_note,omitempty"`
}

type RejectClaimRequest struct {
	ReviewNote string `json:"review_note" binding:"required,max=500"`
}

type ImportCategoriesRequest struct {
	TemplateIDs []string `json:"template_ids" binding:"required,min=1"`
}

// ── Filter types ──────────────────────────────────────────────────────────────

type ClaimFilters struct {
	Status     *string `form:"status"`
	EmployeeID *string `form:"employee_id"`
	CategoryID *string `form:"category_id"`
	StartDate  *string `form:"start_date"` // YYYY-MM-DD
	EndDate    *string `form:"end_date"`   // YYYY-MM-DD
	Cursor     string  `form:"cursor"`     // ISO timestamp
	Limit      int     `form:"limit"`
}

// ── Summary types ─────────────────────────────────────────────────────────────

type MonthlySummary struct {
	EmployeeID   uuid.UUID `json:"employee_id"`
	EmployeeName string    `json:"employee_name"`
	TotalAmount  int64     `json:"total_amount"`
	ClaimCount   int       `json:"claim_count"`
	CurrencyCode string    `json:"currency_code"`
}
