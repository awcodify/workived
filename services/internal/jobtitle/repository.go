package jobtitle

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

func (r *Repository) List(ctx context.Context, orgID uuid.UUID) ([]JobTitle, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, is_active, created_at, updated_at
		FROM job_titles
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jts []JobTitle
	for rows.Next() {
		var d JobTitle
		if err := rows.Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		jts = append(jts, d)
	}
	return jts, rows.Err()
}

func (r *Repository) Search(ctx context.Context, orgID uuid.UUID, query string) ([]JobTitle, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, is_active, created_at, updated_at
		FROM job_titles
		WHERE organisation_id = $1
		  AND is_active = TRUE
		  AND name ILIKE '%' || $2 || '%'
		ORDER BY name ASC
		LIMIT 20
	`, orgID, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jts []JobTitle
	for rows.Next() {
		var jt JobTitle
		if err := rows.Scan(&jt.ID, &jt.OrganisationID, &jt.Name, &jt.IsActive, &jt.CreatedAt, &jt.UpdatedAt); err != nil {
			return nil, err
		}
		jts = append(jts, jt)
	}
	return jts, rows.Err()
}

func (r *Repository) Create(ctx context.Context, orgID uuid.UUID, req CreateJobTitleRequest) (*JobTitle, error) {
	d := &JobTitle{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO job_titles (organisation_id, name)
		VALUES ($1, $2)
		RETURNING id, organisation_id, name, is_active, created_at, updated_at
	`, orgID, req.Name).
		Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (r *Repository) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateJobTitleRequest) (*JobTitle, error) {
	d := &JobTitle{}
	err := r.db.QueryRow(ctx, `
		UPDATE job_titles SET
			name      = COALESCE($3, name)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, is_active, created_at, updated_at
	`, orgID, id, req.Name).
		Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("job_title")
		}
		return nil, err
	}
	return d, nil
}

func (r *Repository) SoftDelete(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE job_titles SET is_active = FALSE
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("job_title")
	}
	return nil
}
