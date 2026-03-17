package department

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, orgID uuid.UUID) ([]Department, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, parent_id, is_active, created_at, updated_at
		FROM departments
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var depts []Department
	for rows.Next() {
		var d Department
		if err := rows.Scan(&d.ID, &d.OrganisationID, &d.Name, &d.ParentID, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		depts = append(depts, d)
	}
	return depts, rows.Err()
}

func (r *Repository) Create(ctx context.Context, orgID uuid.UUID, req CreateDepartmentRequest) (*Department, error) {
	d := &Department{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO departments (organisation_id, name, parent_id)
		VALUES ($1, $2, $3)
		RETURNING id, organisation_id, name, parent_id, is_active, created_at, updated_at
	`, orgID, req.Name, req.ParentID).
		Scan(&d.ID, &d.OrganisationID, &d.Name, &d.ParentID, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (r *Repository) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateDepartmentRequest) (*Department, error) {
	d := &Department{}
	err := r.db.QueryRow(ctx, `
		UPDATE departments SET
			name      = COALESCE($3, name),
			parent_id = COALESCE($4, parent_id)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, parent_id, is_active, created_at, updated_at
	`, orgID, id, req.Name, req.ParentID).
		Scan(&d.ID, &d.OrganisationID, &d.Name, &d.ParentID, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("department")
		}
		return nil, err
	}
	return d, nil
}

func (r *Repository) SoftDelete(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE departments SET is_active = FALSE
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("department")
	}
	return nil
}
