package staff

import (
	"context"
	"errors"
	"strings"

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

// GetByEmail retrieves an internal admin by email with password hash.
func (r *Repository) GetByEmail(ctx context.Context, email string) (*InternalAdmin, string, error) {
	a := &InternalAdmin{}
	var hash string
	err := r.db.QueryRow(ctx, `
		SELECT id, email, full_name, is_active, last_login_at, created_at, password_hash
		FROM internal_admins
		WHERE email = $1
	`, email).Scan(
		&a.ID, &a.Email, &a.FullName,
		&a.IsActive, &a.LastLoginAt, &a.CreatedAt, &hash,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", apperr.NotFound("internal admin")
		}
		return nil, "", err
	}
	return a, hash, nil
}

// GetByID retrieves an internal admin by ID.
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*InternalAdmin, error) {
	a := &InternalAdmin{}
	err := r.db.QueryRow(ctx, `
		SELECT id, email, full_name, is_active, last_login_at, created_at
		FROM internal_admins
		WHERE id = $1
	`, id).Scan(
		&a.ID, &a.Email, &a.FullName,
		&a.IsActive, &a.LastLoginAt, &a.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("internal admin")
		}
		return nil, err
	}
	return a, nil
}

// IsActive checks if the given ID is an active internal admin.
func (r *Repository) IsActive(ctx context.Context, adminID uuid.UUID) bool {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM internal_admins 
			WHERE id = $1 AND is_active = true
		)
	`, adminID).Scan(&exists)
	return err == nil && exists
}

// HasAny checks if there are any internal admins in the system.
func (r *Repository) HasAny(ctx context.Context) bool {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM internal_admins WHERE is_active = true
		)
	`).Scan(&exists)
	return err == nil && exists
}

// Create creates a new internal admin account.
func (r *Repository) Create(ctx context.Context, email, passwordHash, fullName string) (*InternalAdmin, error) {
	a := &InternalAdmin{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO internal_admins (email, password_hash, full_name)
		VALUES ($1, $2, $3)
		RETURNING id, email, full_name, is_active, last_login_at, created_at
	`, email, passwordHash, fullName).Scan(
		&a.ID, &a.Email, &a.FullName,
		&a.IsActive, &a.LastLoginAt, &a.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("an internal admin with this email already exists")
		}
		return nil, err
	}
	return a, nil
}

// UpdateLastLogin updates the last login timestamp.
func (r *Repository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE internal_admins SET last_login_at = NOW() WHERE id = $1
	`, id)
	return err
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key")
}
