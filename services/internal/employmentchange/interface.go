package employmentchange

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for employment change data access.
type Repository interface {
	Create(ctx context.Context, orgID uuid.UUID, req CreateChangeRequest) (*EmploymentChange, error)
	GetByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, filters ListFilters) ([]EmploymentChange, error)
	List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]EmploymentChange, error)
}
