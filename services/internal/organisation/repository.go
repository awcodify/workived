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
func (r *Repository) CreateInvitation(ctx context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash, inviteURL string, employeeID *uuid.UUID, expiresAt time.Time) (*Invitation, error) {
	inv := &Invitation{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO invitations (organisation_id, email, role, invited_by, token_hash, invite_url, employee_id, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, organisation_id, email, role, invited_by, invite_url, employee_id, expires_at, accepted_at, created_at
	`, orgID, email, role, invitedBy, tokenHash, inviteURL, employeeID, expiresAt).Scan(
		&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy,
		&inv.InviteURL, &inv.EmployeeID, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
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

// RevokePendingInvitationsByEmail revokes all pending invitations for a specific email.
// This is used when re-inviting the same email to prevent duplicates.
func (r *Repository) RevokePendingInvitationsByEmail(ctx context.Context, orgID uuid.UUID, email string) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM invitations
		WHERE organisation_id = $1 AND email = $2 AND accepted_at IS NULL
	`, orgID, email)
	return err
}

// IsEmailAlreadyMember checks if an email is already associated with an active member.
func (r *Repository) IsEmailAlreadyMember(ctx context.Context, orgID uuid.UUID, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM organisation_members om
			JOIN users u ON om.user_id = u.id
			WHERE om.organisation_id = $1 
			  AND u.email = $2 
			  AND om.is_active = TRUE
		)
	`, orgID, email).Scan(&exists)
	return exists, err
}

// ListPendingInvitations returns all non-accepted, non-expired invitations for an org,
// excluding invitations for users who are already active members.
func (r *Repository) ListPendingInvitations(ctx context.Context, orgID uuid.UUID) ([]Invitation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT i.id, i.organisation_id, i.email, i.role, i.invited_by, i.invite_url, i.employee_id,
		       i.expires_at, i.accepted_at, i.created_at
		FROM invitations i
		WHERE i.organisation_id = $1
		  AND i.accepted_at IS NULL
		  AND i.expires_at > NOW()
		  AND NOT EXISTS (
		      SELECT 1 FROM organisation_members om
		      JOIN users u ON om.user_id = u.id
		      WHERE om.organisation_id = i.organisation_id
		        AND u.email = i.email
		        AND om.is_active = TRUE
		  )
		ORDER BY i.created_at DESC
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
			&inv.InviteURL, &inv.EmployeeID, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
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

// GetDetail returns org info enriched with employee count and owner name.
func (r *Repository) GetDetail(ctx context.Context, orgID uuid.UUID) (*OrgDetail, error) {
	d := &OrgDetail{}
	err := r.db.QueryRow(ctx, `
		SELECT o.id, o.name, o.slug, o.country_code, o.timezone, o.currency_code,
		       o.work_days, o.plan, o.plan_employee_limit, o.logo_url, o.is_active, o.created_at,
		       COALESCE((SELECT COUNT(*) FROM employees WHERE organisation_id = o.id AND is_active = TRUE), 0) AS employee_count,
		       COALESCE(u.full_name, '') AS owner_name
		FROM organisations o
		LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.role = 'owner' AND om.is_active = TRUE
		LEFT JOIN users u ON u.id = om.user_id
		WHERE o.id = $1
	`, orgID).Scan(
		&d.ID, &d.Name, &d.Slug, &d.CountryCode, &d.Timezone, &d.CurrencyCode,
		&d.WorkDays, &d.Plan, &d.PlanEmployeeLimit, &d.LogoURL, &d.IsActive, &d.CreatedAt,
		&d.EmployeeCount, &d.OwnerName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("organisation")
		}
		return nil, err
	}
	return d, nil
}

// Update performs a partial update on an organisation using COALESCE to skip nil fields.
func (r *Repository) Update(ctx context.Context, orgID uuid.UUID, req UpdateOrgRequest) (*Organisation, error) {
	org := &Organisation{}
	err := r.db.QueryRow(ctx, `
		UPDATE organisations
		SET name          = COALESCE($2, name),
		    slug          = COALESCE($3, slug),
		    country_code  = COALESCE($4, country_code),
		    timezone      = COALESCE($5, timezone),
		    currency_code = COALESCE($6, currency_code),
		    updated_at    = NOW()
		WHERE id = $1
		RETURNING id, name, slug, country_code, timezone, currency_code,
		          work_days, plan, plan_employee_limit, logo_url, is_active, created_at
	`, orgID, req.Name, req.Slug, req.CountryCode, req.Timezone, req.CurrencyCode).Scan(
		&org.ID, &org.Name, &org.Slug, &org.CountryCode, &org.Timezone, &org.CurrencyCode,
		&org.WorkDays, &org.Plan, &org.PlanEmployeeLimit, &org.LogoURL, &org.IsActive, &org.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("organisation")
		}
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("an organisation with this slug already exists")
		}
		return nil, err
	}
	return org, nil
}

// TransferOwnership atomically demotes the current owner to admin and promotes the new owner.
func (r *Repository) TransferOwnership(ctx context.Context, orgID, currentOwnerID, newOwnerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Step 1: Demote current owner → admin.
	tag, err := tx.Exec(ctx, `
		UPDATE organisation_members
		SET role = 'admin', updated_at = NOW()
		WHERE organisation_id = $1 AND user_id = $2 AND role = 'owner'
	`, orgID, currentOwnerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.Forbidden()
	}

	// Step 2: Promote new owner.
	tag, err = tx.Exec(ctx, `
		UPDATE organisation_members
		SET role = 'owner', updated_at = NOW()
		WHERE organisation_id = $1 AND user_id = $2 AND is_active = TRUE
	`, orgID, newOwnerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("member")
	}

	return tx.Commit(ctx)
}

// ListMembers returns all active workspace members enriched with their HR profile link status.
func (r *Repository) ListMembers(ctx context.Context, orgID uuid.UUID) ([]MemberWithProfile, error) {
	rows, err := r.db.Query(ctx, `
		SELECT om.id, om.user_id, om.organisation_id, om.employee_id, om.role, om.joined_at,
		       u.full_name, u.email,
		       (e.id IS NOT NULL)          AS has_hr_profile,
		       COALESCE(e.is_active, FALSE) AS hr_profile_active
		FROM organisation_members om
		JOIN users u ON u.id = om.user_id
		LEFT JOIN employees e ON e.organisation_id = om.organisation_id
		                     AND e.user_id = om.user_id
		WHERE om.organisation_id = $1
		  AND om.is_active = TRUE
		ORDER BY om.joined_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []MemberWithProfile
	for rows.Next() {
		var m MemberWithProfile
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.OrgID, &m.EmployeeID, &m.Role, &m.JoinedAt,
			&m.FullName, &m.Email, &m.HasHRProfile, &m.HRProfileActive,
		); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

// ListUnlinkedMembers returns active members who have no linked employee HR record.
// Used to populate the email combobox on the Add Employee form.
func (r *Repository) ListUnlinkedMembers(ctx context.Context, orgID uuid.UUID) ([]UnlinkedMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT om.user_id, u.full_name, u.email, om.role
		FROM organisation_members om
		JOIN users u ON u.id = om.user_id
		WHERE om.organisation_id = $1
		  AND om.employee_id IS NULL
		  AND om.is_active = TRUE
		ORDER BY u.full_name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []UnlinkedMember
	for rows.Next() {
		var m UnlinkedMember
		if err := rows.Scan(&m.UserID, &m.FullName, &m.Email, &m.Role); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
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
