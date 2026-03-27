package calendar

import (
	"github.com/google/uuid"
)

// PublicHoliday represents a holiday in the public_holidays table.
type PublicHoliday struct {
	ID             *uuid.UUID `json:"id,omitempty"`
	CountryCode    string     `json:"country_code"`
	Date           string     `json:"date"` // YYYY-MM-DD
	Name           string     `json:"name"`
	OrganisationID *uuid.UUID `json:"organisation_id,omitempty"`
	IsCustom       bool       `json:"is_custom"`
}

// CreateCustomHolidayRequest is the input for creating an org-specific holiday.
type CreateCustomHolidayRequest struct {
	Date string `json:"date" validate:"required"` // YYYY-MM-DD
	Name string `json:"name" validate:"required,min=1,max=200"`
}
