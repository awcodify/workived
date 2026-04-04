package jobtitle

import (
	"time"

	"github.com/google/uuid"
)

type JobTitle struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	Name           string    `json:"name"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreateJobTitleRequest struct {
	Name string `json:"name" validate:"required,min=1,max=150"`
}

type UpdateJobTitleRequest struct {
	Name *string `json:"name" validate:"omitempty,min=1,max=150"`
}
