package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Logger is the interface that services depend on for audit logging.
// This allows injecting fakes in unit tests.
type Logger interface {
	Log(ctx context.Context, entry LogEntry) error
}

// Querier is the interface for querying audit logs.
type Querier interface {
	List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]AuditLog, error)
	GetByResource(ctx context.Context, orgID uuid.UUID, resourceType string, resourceID uuid.UUID, filters ListFilters) ([]AuditLog, error)
}

// AuditLog represents a single audit log entry retrieved from the database.
type AuditLog struct {
	ID             uuid.UUID       `json:"id"`
	OrganisationID uuid.UUID       `json:"organisation_id"`
	ActorUserID    *uuid.UUID      `json:"actor_user_id,omitempty"`
	ActorName      *string         `json:"actor_name,omitempty"`
	Action         string          `json:"action"`
	ResourceType   string          `json:"resource_type"`
	ResourceID     *uuid.UUID      `json:"resource_id,omitempty"`
	BeforeState    json.RawMessage `json:"before_state,omitempty"`
	AfterState     json.RawMessage `json:"after_state,omitempty"`
	IPAddress      *string         `json:"ip_address,omitempty"`
	RequestID      *string         `json:"request_id,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// ListFilters contains filters for querying audit logs.
type ListFilters struct {
	Search       *string // Global search across action, resource_type, actor_name, and state changes
	ResourceType *string
	ResourceID   *uuid.UUID
	ActorUserID  *uuid.UUID
	ActorName    *string // Filter by actor's full name
	Action       *string
	StartDate    *time.Time
	EndDate      *time.Time
	Limit        int
	Offset       int
}
