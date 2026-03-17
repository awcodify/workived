package department

import (
	"time"

	"github.com/google/uuid"
)

type Department struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	Name           string     `json:"name"`
	ParentID       *uuid.UUID `json:"parent_id,omitempty"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CreateDepartmentRequest struct {
	Name     string     `json:"name"      validate:"required,min=1,max=150"`
	ParentID *uuid.UUID `json:"parent_id" validate:"omitempty"`
}

type UpdateDepartmentRequest struct {
	Name     *string    `json:"name"      validate:"omitempty,min=1,max=150"`
	ParentID *uuid.UUID `json:"parent_id" validate:"omitempty"`
}
