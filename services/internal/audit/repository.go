package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository writes immutable audit log entries.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new audit repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// LogEntry contains all fields for a single audit log row.
type LogEntry struct {
	OrgID        uuid.UUID
	ActorUserID  uuid.UUID
	Action       string
	ResourceType string
	ResourceID   uuid.UUID
	BeforeState  interface{}
	AfterState   interface{}
	IPAddress    string
	RequestID    string
}

// Log writes an audit log entry to the database.
func (r *Repository) Log(ctx context.Context, entry LogEntry) error {
	beforeJSON, err := marshalNullable(entry.BeforeState)
	if err != nil {
		beforeJSON = nil
	}
	afterJSON, err := marshalNullable(entry.AfterState)
	if err != nil {
		afterJSON = nil
	}

	var ipAddr *string
	if entry.IPAddress != "" {
		ipAddr = &entry.IPAddress
	}
	var reqID *string
	if entry.RequestID != "" {
		reqID = &entry.RequestID
	}

	_, err = r.db.Exec(ctx,
		`INSERT INTO audit_logs (organisation_id, actor_user_id, action, resource_type, resource_id, before_state, after_state, ip_address, request_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9)`,
		entry.OrgID, entry.ActorUserID, entry.Action, entry.ResourceType, entry.ResourceID,
		beforeJSON, afterJSON, ipAddr, reqID,
	)
	if err != nil {
		return fmt.Errorf("audit log insert: %w", err)
	}
	return nil
}

func marshalNullable(v interface{}) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	return json.Marshal(v)
}
