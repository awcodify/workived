package organisation

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, req CreateOrgRequest, ownerID uuid.UUID) (*Organisation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	org := &Organisation{}
	err = tx.QueryRow(ctx, `
		INSERT INTO organisations (name, slug, country_code, timezone, currency_code)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, slug, country_code, timezone, currency_code,
		          work_days, plan, plan_employee_limit, logo_url, is_active, created_at
	`, req.Name, req.Slug, req.CountryCode, req.Timezone, req.CurrencyCode).
		Scan(&org.ID, &org.Name, &org.Slug, &org.CountryCode, &org.Timezone, &org.CurrencyCode,
			&org.WorkDays, &org.Plan, &org.PlanEmployeeLimit, &org.LogoURL, &org.IsActive, &org.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("an organisation with this slug already exists")
		}
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO organisation_members (organisation_id, user_id, role, joined_at)
		VALUES ($1, $2, 'owner', NOW())
	`, org.ID, ownerID)
	if err != nil {
		return nil, err
	}

	return org, tx.Commit(ctx)
}

func (r *Repository) GetByID(ctx context.Context, orgID uuid.UUID) (*Organisation, error) {
	org := &Organisation{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, slug, country_code, timezone, currency_code,
		       work_days, plan, plan_employee_limit, logo_url, is_active, created_at
		FROM organisations
		WHERE id = $1
	`, orgID).Scan(
		&org.ID, &org.Name, &org.Slug, &org.CountryCode, &org.Timezone, &org.CurrencyCode,
		&org.WorkDays, &org.Plan, &org.PlanEmployeeLimit, &org.LogoURL, &org.IsActive, &org.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("organisation")
		}
		return nil, err
	}
	return org, nil
}

// GetMember returns the validated member record — used by TenantMiddleware.
func (r *Repository) GetMember(ctx context.Context, orgID, userID uuid.UUID) (*middleware.OrgMember, error) {
	m := &middleware.OrgMember{}
	err := r.db.QueryRow(ctx, `
		SELECT om.organisation_id, om.user_id, om.role, om.is_active,
		       o.plan, o.timezone, o.plan_employee_limit
		FROM organisation_members om
		JOIN organisations o ON o.id = om.organisation_id
		WHERE om.organisation_id = $1
		  AND om.user_id = $2
	`, orgID, userID).Scan(
		&m.OrgID, &m.UserID, &m.Role, &m.IsActive,
		&m.OrgPlan, &m.OrgTimezone, &m.PlanEmployeeLimit,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.Forbidden()
		}
		return nil, err
	}
	return m, nil
}

// GetMemberOrgID returns the first active org membership for a user — used by auth service.
func (r *Repository) GetMemberOrgID(ctx context.Context, userID uuid.UUID) (uuid.UUID, string, error) {
	var orgID uuid.UUID
	var role string
	err := r.db.QueryRow(ctx, `
		SELECT organisation_id, role
		FROM organisation_members
		WHERE user_id = $1 AND is_active = TRUE
		ORDER BY joined_at ASC
		LIMIT 1
	`, userID).Scan(&orgID, &role)
	if err != nil {
		return uuid.Nil, "", err
	}
	return orgID, role, nil
}

// CreateInvitation stores an invitation record.
func (r *Repository) CreateInvitation(ctx context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO invitations (organisation_id, email, role, invited_by, token_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT DO NOTHING
	`, orgID, email, role, invitedBy, tokenHash, expiresAt)
	return err
}

// GetOrgPlanInfo returns the plan and employee limit for an org — used by employee service.
func (r *Repository) GetOrgPlanInfo(ctx context.Context, orgID uuid.UUID) (string, *int, error) {
	var plan string
	var limit *int
	err := r.db.QueryRow(ctx, `
		SELECT plan, plan_employee_limit FROM organisations WHERE id = $1
	`, orgID).Scan(&plan, &limit)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, apperr.NotFound("organisation")
		}
		return "", nil, err
	}
	return plan, limit, nil
}

func isUniqueViolation(err error) bool {
	return err != nil && containsCode(err.Error(), "23505")
}

func containsCode(msg, code string) bool {
	for i := 0; i+len(code) <= len(msg); i++ {
		if msg[i:i+len(code)] == code {
			return true
		}
	}
	return false
}
