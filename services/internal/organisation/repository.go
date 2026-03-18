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
		SELECT om.organisation_id, om.user_id, om.role, om.employee_id, om.is_active,
		       o.plan, o.timezone, o.plan_employee_limit
		FROM organisation_members om
		JOIN organisations o ON o.id = om.organisation_id
		WHERE om.organisation_id = $1
		  AND om.user_id = $2
	`, orgID, userID).Scan(
		&m.OrgID, &m.UserID, &m.Role, &m.EmployeeID, &m.IsActive,
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

// CreateInvitation stores an invitation record and returns the invitation.
func (r *Repository) CreateInvitation(ctx context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash string, employeeID *uuid.UUID, expiresAt time.Time) (*Invitation, error) {
	inv := &Invitation{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO invitations (organisation_id, email, role, invited_by, token_hash, employee_id, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, organisation_id, email, role, invited_by, employee_id, expires_at, accepted_at, created_at
	`, orgID, email, role, invitedBy, tokenHash, employeeID, expiresAt).Scan(
		&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy,
		&inv.EmployeeID, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("an invitation for this email already exists")
		}
		return nil, err
	}
	return inv, nil
}

// GetInvitationByToken returns an invitation by its hashed token.
func (r *Repository) GetInvitationByToken(ctx context.Context, tokenHash string) (*Invitation, error) {
	inv := &Invitation{}
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, email, role, invited_by, token_hash,
		       employee_id, expires_at, accepted_at, created_at
		FROM invitations
		WHERE token_hash = $1
	`, tokenHash).Scan(
		&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.TokenHash,
		&inv.EmployeeID, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("invitation")
		}
		return nil, err
	}
	return inv, nil
}

// GetActiveMember returns an active member for the given org+user, or nil if not found.
func (r *Repository) GetActiveMember(ctx context.Context, orgID, userID uuid.UUID) (*Member, error) {
	m := &Member{}
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, organisation_id, employee_id, role, is_active, joined_at
		FROM organisation_members
		WHERE organisation_id = $1
		  AND user_id = $2
		  AND is_active = TRUE
	`, orgID, userID).Scan(
		&m.ID, &m.UserID, &m.OrgID, &m.EmployeeID, &m.Role, &m.IsActive, &m.JoinedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return m, nil
}

// AcceptInvitation executes the full invitation acceptance in a single transaction:
// 1. Mark invitation as accepted
// 2. Create or reactivate organisation_members row
// 3. Link employee.user_id if employee_id is provided
// Returns the created member.
func (r *Repository) AcceptInvitation(ctx context.Context, p AcceptParams) (*Member, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Mark invitation accepted (atomic — WHERE accepted_at IS NULL prevents double-accept).
	tag, err := tx.Exec(ctx, `
		UPDATE invitations
		SET accepted_at = NOW()
		WHERE id = $1 AND accepted_at IS NULL
	`, p.InvitationID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, apperr.Conflict("invitation already accepted")
	}

	// 2. Create or reactivate member.
	m := &Member{}
	err = tx.QueryRow(ctx, `
		INSERT INTO organisation_members (organisation_id, user_id, role, employee_id, joined_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (organisation_id, user_id) DO UPDATE
		    SET role = EXCLUDED.role,
		        employee_id = COALESCE(EXCLUDED.employee_id, organisation_members.employee_id),
		        is_active = TRUE,
		        joined_at = NOW()
		RETURNING id, user_id, organisation_id, employee_id, role, is_active, joined_at
	`, p.OrgID, p.UserID, p.Role, p.EmployeeID).Scan(
		&m.ID, &m.UserID, &m.OrgID, &m.EmployeeID, &m.Role, &m.IsActive, &m.JoinedAt,
	)
	if err != nil {
		return nil, err
	}

	// 3. Link employee → user if employee_id was provided.
	if p.EmployeeID != nil {
		_, err = tx.Exec(ctx, `
			UPDATE employees
			SET user_id = $1
			WHERE organisation_id = $2 AND id = $3 AND is_active = TRUE
		`, p.UserID, p.OrgID, *p.EmployeeID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return m, nil
}

// RevokeInvitation marks an invitation as revoked by setting accepted_at to a sentinel.
func (r *Repository) RevokeInvitation(ctx context.Context, orgID, invitationID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM invitations
		WHERE organisation_id = $1 AND id = $2 AND accepted_at IS NULL
	`, orgID, invitationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("invitation")
	}
	return nil
}

// ListPendingInvitations returns all non-accepted, non-expired invitations for an org.
func (r *Repository) ListPendingInvitations(ctx context.Context, orgID uuid.UUID) ([]Invitation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, email, role, invited_by, employee_id,
		       expires_at, accepted_at, created_at
		FROM invitations
		WHERE organisation_id = $1
		  AND accepted_at IS NULL
		  AND expires_at > NOW()
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []Invitation
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(
			&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy,
			&inv.EmployeeID, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
		); err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, rows.Err()
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

// GetOrgTimezone returns the timezone for an org — used by attendance service.
func (r *Repository) GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error) {
	var tz string
	err := r.db.QueryRow(ctx, `SELECT timezone FROM organisations WHERE id = $1`, orgID).Scan(&tz)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.NotFound("organisation")
		}
		return "", err
	}
	return tz, nil
}

// GetOrgCountryCode returns the country_code for an org — used by attendance service.
func (r *Repository) GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	var cc string
	err := r.db.QueryRow(ctx, `SELECT country_code FROM organisations WHERE id = $1`, orgID).Scan(&cc)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.NotFound("organisation")
		}
		return "", err
	}
	return cc, nil
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
