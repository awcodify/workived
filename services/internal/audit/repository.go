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

// List retrieves audit logs for an organisation with filters.
func (r *Repository) List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]AuditLog, error) {
	query := `
		SELECT a.id, a.organisation_id, a.actor_user_id, u.full_name as actor_name,
		       a.action, a.resource_type, a.resource_id,
		       a.before_state, a.after_state, a.ip_address, a.request_id, a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON a.actor_user_id = u.id
		WHERE a.organisation_id = $1
		  AND a.action != 'task.moved'
	`
	args := []interface{}{orgID}
	argIdx := 2

	// Global search across multiple fields
	if filters.Search != nil && *filters.Search != "" {
		searchPattern := "%" + *filters.Search + "%"
		query += fmt.Sprintf(` AND (
			a.action ILIKE $%d OR
			a.resource_type ILIKE $%d OR
			u.full_name ILIKE $%d OR
			a.before_state::text ILIKE $%d OR
			a.after_state::text ILIKE $%d
		)`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4)
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
		argIdx += 5
	}

	if filters.ResourceType != nil {
		query += fmt.Sprintf(" AND a.resource_type ILIKE $%d", argIdx)
		args = append(args, "%"+*filters.ResourceType+"%")
		argIdx++
	}

	if filters.ResourceID != nil {
		query += fmt.Sprintf(" AND a.resource_id = $%d", argIdx)
		args = append(args, *filters.ResourceID)
		argIdx++
	}

	if filters.ActorUserID != nil {
		query += fmt.Sprintf(" AND a.actor_user_id = $%d", argIdx)
		args = append(args, *filters.ActorUserID)
		argIdx++
	}

	if filters.ActorName != nil && *filters.ActorName != "" {
		query += fmt.Sprintf(" AND u.full_name ILIKE $%d", argIdx)
		args = append(args, "%"+*filters.ActorName+"%")
		argIdx++
	}

	if filters.Action != nil {
		query += fmt.Sprintf(" AND a.action ILIKE $%d", argIdx)
		args = append(args, "%"+*filters.Action+"%")
		argIdx++
	}

	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND a.created_at >= $%d", argIdx)
		args = append(args, *filters.StartDate)
		argIdx++
	}

	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND a.created_at <= $%d", argIdx)
		args = append(args, *filters.EndDate)
		argIdx++
	}

	query += " ORDER BY a.created_at DESC"

	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, filters.Limit)
		argIdx++
	}

	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(
			&log.ID, &log.OrganisationID, &log.ActorUserID, &log.ActorName,
			&log.Action, &log.ResourceType, &log.ResourceID,
			&log.BeforeState, &log.AfterState, &log.IPAddress, &log.RequestID, &log.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan audit log: %w", err)
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}

// GetByResource retrieves audit logs for a specific resource.
func (r *Repository) GetByResource(ctx context.Context, orgID uuid.UUID, resourceType string, resourceID uuid.UUID, filters ListFilters) ([]AuditLog, error) {
	filters.ResourceType = &resourceType
	filters.ResourceID = &resourceID
	return r.List(ctx, orgID, filters)
}
