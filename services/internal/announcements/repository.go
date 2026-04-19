package announcements

import (
	"context"
	"errors"
	"time"

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

const selectCols = `
	a.id, a.organisation_id, a.author_id,
	COALESCE(e.full_name, '') AS author_name,
	a.title, a.body, a.is_pinned, a.is_auto, a.published_at,
	a.created_at, a.updated_at`

func scan(row interface{ Scan(dest ...any) error }, isRead bool) (*Announcement, error) {
	ann := &Announcement{IsRead: isRead}
	err := row.Scan(
		&ann.ID, &ann.OrganisationID, &ann.AuthorID, &ann.AuthorName,
		&ann.Title, &ann.Body, &ann.IsPinned, &ann.IsAuto, &ann.PublishedAt,
		&ann.CreatedAt, &ann.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return ann, nil
}

// List returns published announcements for an org, with is_read for the given employee.
func (r *Repository) List(ctx context.Context, orgID, employeeID uuid.UUID) ([]Announcement, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+selectCols+`,
		    (rr.id IS NOT NULL) AS is_read
		FROM announcements a
		LEFT JOIN employees e ON e.id = a.author_id
		LEFT JOIN announcement_read_receipts rr
		    ON rr.announcement_id = a.id AND rr.employee_id = $2
		WHERE a.organisation_id = $1
		  AND a.published_at IS NOT NULL
		ORDER BY a.is_pinned DESC, a.published_at DESC
		LIMIT 100
	`, orgID, employeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Announcement
	for rows.Next() {
		var isRead bool
		ann := &Announcement{}
		if err := rows.Scan(
			&ann.ID, &ann.OrganisationID, &ann.AuthorID, &ann.AuthorName,
			&ann.Title, &ann.Body, &ann.IsPinned, &ann.IsAuto, &ann.PublishedAt,
			&ann.CreatedAt, &ann.UpdatedAt,
			&isRead,
		); err != nil {
			return nil, err
		}
		ann.IsRead = isRead
		out = append(out, *ann)
	}
	return out, rows.Err()
}

// ListAdmin returns all announcements (including drafts) for admins.
func (r *Repository) ListAdmin(ctx context.Context, orgID uuid.UUID) ([]Announcement, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+selectCols+`, FALSE AS is_read
		FROM announcements a
		LEFT JOIN employees e ON e.id = a.author_id
		WHERE a.organisation_id = $1
		ORDER BY a.created_at DESC
		LIMIT 200
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Announcement
	for rows.Next() {
		ann := &Announcement{}
		var isRead bool
		if err := rows.Scan(
			&ann.ID, &ann.OrganisationID, &ann.AuthorID, &ann.AuthorName,
			&ann.Title, &ann.Body, &ann.IsPinned, &ann.IsAuto, &ann.PublishedAt,
			&ann.CreatedAt, &ann.UpdatedAt,
			&isRead,
		); err != nil {
			return nil, err
		}
		out = append(out, *ann)
	}
	return out, rows.Err()
}

// GetByID returns a single announcement scoped to org.
func (r *Repository) GetByID(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error) {
	row := r.db.QueryRow(ctx, `
		SELECT `+selectCols+`
		FROM announcements a
		LEFT JOIN employees e ON e.id = a.author_id
		WHERE a.organisation_id = $1 AND a.id = $2
	`, orgID, id)
	ann, err := scan(row, false)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("announcement")
	}
	return ann, err
}

// Create inserts a new announcement authored by a human employee.
func (r *Repository) Create(ctx context.Context, orgID, authorID uuid.UUID, req CreateAnnouncementRequest, now time.Time) (*Announcement, error) {
	var publishedAt *time.Time
	if req.Publish {
		publishedAt = &now
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO announcements (organisation_id, author_id, title, body, is_pinned, is_auto, published_at)
		VALUES ($1, $2, $3, $4, $5, FALSE, $6)
		RETURNING id, organisation_id, author_id,
		    (SELECT full_name FROM employees WHERE id = $2),
		    title, body, is_pinned, is_auto, published_at, created_at, updated_at
	`, orgID, authorID, req.Title, req.Body, req.IsPinned, publishedAt)
	return scan(row, false)
}

// CreateAuto inserts a system-generated announcement (no human author).
func (r *Repository) CreateAuto(ctx context.Context, orgID uuid.UUID, title, body string, now time.Time) (*Announcement, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO announcements (organisation_id, author_id, title, body, is_pinned, is_auto, published_at)
		VALUES ($1, NULL, $2, $3, FALSE, TRUE, $4)
		RETURNING id, organisation_id, author_id,
		    NULL::text,
		    title, body, is_pinned, is_auto, published_at, created_at, updated_at
	`, orgID, title, body, now)
	return scan(row, false)
}

// Update updates title, body, and pinned status.
func (r *Repository) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateAnnouncementRequest) (*Announcement, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE announcements SET
		    title     = $3,
		    body      = $4,
		    is_pinned = $5,
		    updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, author_id,
		    (SELECT full_name FROM employees WHERE id = author_id),
		    title, body, is_pinned, is_auto, published_at, created_at, updated_at
	`, orgID, id, req.Title, req.Body, req.IsPinned)
	ann, err := scan(row, false)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("announcement")
	}
	return ann, err
}

// Publish sets published_at if not already set.
func (r *Repository) Publish(ctx context.Context, orgID, id uuid.UUID, now time.Time) (*Announcement, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE announcements SET
		    published_at = COALESCE(published_at, $3),
		    updated_at   = NOW()
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, author_id,
		    (SELECT full_name FROM employees WHERE id = author_id),
		    title, body, is_pinned, is_auto, published_at, created_at, updated_at
	`, orgID, id, now)
	ann, err := scan(row, false)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("announcement")
	}
	return ann, err
}

// SetPinned toggles the pinned state.
func (r *Repository) SetPinned(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*Announcement, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE announcements SET is_pinned = $3, updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, author_id,
		    (SELECT full_name FROM employees WHERE id = author_id),
		    title, body, is_pinned, is_auto, published_at, created_at, updated_at
	`, orgID, id, pinned)
	ann, err := scan(row, pinned)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("announcement")
	}
	return ann, err
}

// Delete hard-deletes an announcement.
func (r *Repository) Delete(ctx context.Context, orgID, id uuid.UUID) error {
	ct, err := r.db.Exec(ctx, `
		DELETE FROM announcements WHERE organisation_id = $1 AND id = $2
	`, orgID, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return apperr.NotFound("announcement")
	}
	return nil
}

// MarkRead inserts a read receipt (idempotent).
func (r *Repository) MarkRead(ctx context.Context, orgID, announcementID, employeeID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO announcement_read_receipts (organisation_id, announcement_id, employee_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (announcement_id, employee_id) DO NOTHING
	`, orgID, announcementID, employeeID)
	return err
}

// CountUnread returns the number of published announcements not yet read by an employee.
func (r *Repository) CountUnread(ctx context.Context, orgID, employeeID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM announcements a
		WHERE a.organisation_id = $1
		  AND a.published_at IS NOT NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM announcement_read_receipts rr
		      WHERE rr.announcement_id = a.id AND rr.employee_id = $2
		  )
	`, orgID, employeeID).Scan(&count)
	return count, err
}
