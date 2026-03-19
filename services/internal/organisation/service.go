package organisation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

// ── Interfaces ───────────────────────────────────────────────────────────────

// RepoInterface is the data access interface the org service depends on.
type RepoInterface interface {
	Create(ctx context.Context, req CreateOrgRequest, ownerID uuid.UUID) (*Organisation, error)
	GetByID(ctx context.Context, orgID uuid.UUID) (*Organisation, error)
	GetDetail(ctx context.Context, orgID uuid.UUID) (*OrgDetail, error)
	Update(ctx context.Context, orgID uuid.UUID, req UpdateOrgRequest) (*Organisation, error)
	TransferOwnership(ctx context.Context, orgID, currentOwnerID, newOwnerID uuid.UUID) error
	GetOrgPlanInfo(ctx context.Context, orgID uuid.UUID) (string, *int, error)
	GetMemberOrgID(ctx context.Context, userID uuid.UUID) (uuid.UUID, string, error)
	GetActiveMember(ctx context.Context, orgID, userID uuid.UUID) (*Member, error)
	CreateInvitation(ctx context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash string, employeeID *uuid.UUID, expiresAt time.Time) (*Invitation, error)
	GetInvitationByToken(ctx context.Context, tokenHash string) (*Invitation, error)
	AcceptInvitation(ctx context.Context, p AcceptParams) (*Member, error)
	RevokeInvitation(ctx context.Context, orgID, invitationID uuid.UUID) error
	ListPendingInvitations(ctx context.Context, orgID uuid.UUID) ([]Invitation, error)
}

// AuthTokenCreator is the narrow auth interface the org service needs.
type AuthTokenCreator interface {
	CreateToken(ctx context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error
}

// AccessTokenIssuer issues JWTs — satisfied by the auth service.
type AccessTokenIssuer interface {
	IssueAccessToken(userID, orgID uuid.UUID, role string) (string, error)
}

// ── Service ──────────────────────────────────────────────────────────────────

type Service struct {
	repo        RepoInterface
	authRepo    AuthTokenCreator
	tokenIssuer AccessTokenIssuer
	baseURL     string // e.g. "https://app.workived.com" — for building invite URLs
}

func NewService(repo RepoInterface, authRepo AuthTokenCreator, tokenIssuer AccessTokenIssuer, baseURL string) *Service {
	return &Service{
		repo:        repo,
		authRepo:    authRepo,
		tokenIssuer: tokenIssuer,
		baseURL:     baseURL,
	}
}

// ── Org CRUD ─────────────────────────────────────────────────────────────────

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, req CreateOrgRequest) (*CreateOrgResponse, error) {
	org, err := s.repo.Create(ctx, req, ownerID)
	if err != nil {
		return nil, fmt.Errorf("create organisation: %w", err)
	}
	// Issue a new JWT so the caller immediately has org context without re-logging in.
	accessToken, err := s.tokenIssuer.IssueAccessToken(ownerID, org.ID, "owner")
	if err != nil {
		return nil, fmt.Errorf("issue access token after org creation: %w", err)
	}
	return &CreateOrgResponse{AccessToken: accessToken, Organisation: org}, nil
}

func (s *Service) Get(ctx context.Context, orgID uuid.UUID) (*Organisation, error) {
	org, err := s.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get organisation %s: %w", orgID, err)
	}
	return org, nil
}

func (s *Service) GetDetail(ctx context.Context, orgID uuid.UUID) (*OrgDetail, error) {
	detail, err := s.repo.GetDetail(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org detail %s: %w", orgID, err)
	}
	return detail, nil
}

func (s *Service) Update(ctx context.Context, orgID uuid.UUID, req UpdateOrgRequest, employeeCount int) (*Organisation, error) {
	// Block country/timezone/currency changes if employees exist.
	if employeeCount > 0 && (req.CountryCode != nil || req.Timezone != nil || req.CurrencyCode != nil) {
		return nil, apperr.New(apperr.CodeValidation,
			"country, timezone, and currency cannot be changed after employees are added")
	}
	org, err := s.repo.Update(ctx, orgID, req)
	if err != nil {
		return nil, fmt.Errorf("update organisation %s: %w", orgID, err)
	}
	return org, nil
}

func (s *Service) TransferOwnership(ctx context.Context, orgID, currentOwnerID uuid.UUID, req TransferOwnershipRequest) error {
	if currentOwnerID == req.NewOwnerUserID {
		return apperr.New(apperr.CodeValidation, "you are already the owner")
	}
	// Verify the new owner is an active member.
	member, err := s.repo.GetActiveMember(ctx, orgID, req.NewOwnerUserID)
	if err != nil {
		return fmt.Errorf("get new owner member: %w", err)
	}
	if member == nil {
		return apperr.NotFound("member")
	}
	if err := s.repo.TransferOwnership(ctx, orgID, currentOwnerID, req.NewOwnerUserID); err != nil {
		return fmt.Errorf("transfer ownership: %w", err)
	}
	return nil
}

// ── Invitation flow ──────────────────────────────────────────────────────────

func (s *Service) InviteMember(ctx context.Context, orgID, inviterID uuid.UUID, req InviteMemberRequest) (*InviteResponse, error) {
	// Validate pro roles are only assignable on pro orgs.
	if middleware.IsProRole(req.Role) {
		plan, _, err := s.repo.GetOrgPlanInfo(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("get org plan: %w", err)
		}
		if plan == "free" {
			return nil, apperr.New(apperr.CodeUpgradeRequired,
				"this role requires a Workived Pro plan")
		}
	}

	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(72 * time.Hour)

	inv, err := s.repo.CreateInvitation(ctx, orgID, req.Email, req.Role, inviterID, tokenHash, req.EmployeeID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}

	inviteURL := fmt.Sprintf("%s/invite?token=%s", s.baseURL, rawToken)

	return &InviteResponse{
		ID:        inv.ID,
		Email:     inv.Email,
		Role:      inv.Role,
		InviteURL: inviteURL,
		ExpiresAt: inv.ExpiresAt,
	}, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, userID uuid.UUID, req AcceptInvitationRequest) (*AcceptInvitationResponse, error) {
	tokenHash := hashToken(req.Token)

	// 1. Get and validate invitation.
	inv, err := s.repo.GetInvitationByToken(ctx, tokenHash)
	if err != nil {
		return nil, fmt.Errorf("get invitation by token: %w", err)
	}
	if inv.AcceptedAt != nil {
		return nil, apperr.Conflict("invitation already accepted")
	}
	if time.Now().UTC().After(inv.ExpiresAt) {
		return nil, apperr.New(apperr.CodeValidation, "invitation has expired — ask the admin for a new one")
	}

	// 2. Check if already an active member.
	existing, err := s.repo.GetActiveMember(ctx, inv.OrgID, userID)
	if err != nil {
		return nil, fmt.Errorf("check existing membership: %w", err)
	}
	if existing != nil {
		return nil, apperr.Conflict("already a member of this organisation")
	}

	// 3. Verify pro roles on pro orgs.
	if middleware.IsProRole(inv.Role) {
		plan, _, err := s.repo.GetOrgPlanInfo(ctx, inv.OrgID)
		if err != nil {
			return nil, fmt.Errorf("get org plan for acceptance: %w", err)
		}
		if plan == "free" {
			return nil, apperr.New(apperr.CodeUpgradeRequired,
				"this role requires a Workived Pro plan")
		}
	}

	// 4. Accept in a single transaction.
	member, err := s.repo.AcceptInvitation(ctx, AcceptParams{
		InvitationID: inv.ID,
		OrgID:        inv.OrgID,
		UserID:       userID,
		Role:         inv.Role,
		EmployeeID:   inv.EmployeeID,
	})
	if err != nil {
		return nil, fmt.Errorf("accept invitation: %w", err)
	}

	// 5. Issue a new JWT with the new org context.
	accessToken, err := s.tokenIssuer.IssueAccessToken(userID, inv.OrgID, inv.Role)
	if err != nil {
		return nil, fmt.Errorf("issue access token: %w", err)
	}

	// 6. Get org for response.
	org, err := s.repo.GetByID(ctx, inv.OrgID)
	if err != nil {
		return nil, fmt.Errorf("get org after acceptance: %w", err)
	}

	return &AcceptInvitationResponse{
		AccessToken:  accessToken,
		Organisation: org,
		Member:       member,
	}, nil
}

func (s *Service) RevokeInvitation(ctx context.Context, orgID, invitationID uuid.UUID) error {
	if err := s.repo.RevokeInvitation(ctx, orgID, invitationID); err != nil {
		return fmt.Errorf("revoke invitation %s: %w", invitationID, err)
	}
	return nil
}

func (s *Service) ListPendingInvitations(ctx context.Context, orgID uuid.UUID) ([]Invitation, error) {
	invitations, err := s.repo.ListPendingInvitations(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("list pending invitations: %w", err)
	}
	return invitations, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func generateToken() (raw, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw = hex.EncodeToString(b)
	hash = hashToken(raw)
	return
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
