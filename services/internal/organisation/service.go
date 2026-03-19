package organisation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/audit"
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
	CreateInvitation(ctx context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash, inviteURL string, employeeID *uuid.UUID, expiresAt time.Time) (*Invitation, error)
	GetInvitationByToken(ctx context.Context, tokenHash string) (*Invitation, error)
	AcceptInvitation(ctx context.Context, p AcceptParams) (*Member, error)
	RevokeInvitation(ctx context.Context, orgID, invitationID uuid.UUID) error
	RevokePendingInvitationsByEmail(ctx context.Context, orgID uuid.UUID, email string) error
	IsEmailAlreadyMember(ctx context.Context, orgID uuid.UUID, email string) (bool, error)
	ListPendingInvitations(ctx context.Context, orgID uuid.UUID) ([]Invitation, error)
	ListUnlinkedMembers(ctx context.Context, orgID uuid.UUID) ([]UnlinkedMember, error)
	ListMembers(ctx context.Context, orgID uuid.UUID) ([]MemberWithProfile, error)
	GetPendingInvitationsByUserID(ctx context.Context, userID uuid.UUID) ([]MyInvitation, error)
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
	auditLog    audit.Logger
	baseURL     string // e.g. "https://app.workived.com" — for building invite URLs
}

func NewService(repo RepoInterface, authRepo AuthTokenCreator, tokenIssuer AccessTokenIssuer, baseURL string, opts ...ServiceOption) *Service {
	s := &Service{
		repo:        repo,
		authRepo:    authRepo,
		tokenIssuer: tokenIssuer,
		baseURL:     baseURL,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// ServiceOption configures optional Service dependencies.
type ServiceOption func(*Service)

// WithAuditLog sets the audit logger for the service.
func WithAuditLog(al audit.Logger) ServiceOption {
	return func(s *Service) {
		s.auditLog = al
	}
}

// logAudit records an audit entry. If audit logging fails, it logs the error but does not
// propagate it — audit failures must never break the main operation.
func (s *Service) logAudit(ctx context.Context, entry audit.LogEntry) {
	if s.auditLog == nil {
		return
	}
	if err := s.auditLog.Log(ctx, entry); err != nil {
		log.Printf("audit log error: %v", err)
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

	s.logAudit(ctx, audit.LogEntry{
		OrgID:        orgID,
		ActorUserID:  currentOwnerID,
		Action:       "ownership.transferred",
		ResourceType: "organisation",
		ResourceID:   orgID,
		AfterState:   map[string]interface{}{"new_owner_user_id": req.NewOwnerUserID},
	})

	return nil
}

// ── Invitation flow ──────────────────────────────────────────────────────────

func (s *Service) InviteMember(ctx context.Context, orgID, inviterID uuid.UUID, req InviteMemberRequest) (*InviteResponse, error) {
	req.Email = strings.ToLower(req.Email)

	// 1. Check if email is already an active member.
	isMember, err := s.repo.IsEmailAlreadyMember(ctx, orgID, req.Email)
	if err != nil {
		return nil, fmt.Errorf("check member status: %w", err)
	}
	if isMember {
		return nil, apperr.Conflict("this user is already a member of your organisation")
	}

	// 2. Validate pro roles are only assignable on pro orgs.
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

	// 3. Revoke any existing pending invitations for this email.
	//    This prevents duplicate invitation errors when re-inviting.
	if err := s.repo.RevokePendingInvitationsByEmail(ctx, orgID, req.Email); err != nil {
		return nil, fmt.Errorf("revoke existing invitations: %w", err)
	}

	// 4. Create new invitation.
	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(72 * time.Hour)
	inviteURL := fmt.Sprintf("%s/invite?token=%s", s.baseURL, rawToken)

	inv, err := s.repo.CreateInvitation(ctx, orgID, req.Email, req.Role, inviterID, tokenHash, inviteURL, req.EmployeeID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID:        orgID,
		ActorUserID:  inviterID,
		Action:       "invitation.created",
		ResourceType: "invitation",
		ResourceID:   inv.ID,
		AfterState:   map[string]interface{}{"email": inv.Email, "role": inv.Role},
	})

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

	s.logAudit(ctx, audit.LogEntry{
		OrgID:        inv.OrgID,
		ActorUserID:  userID,
		Action:       "invitation.accepted",
		ResourceType: "invitation",
		ResourceID:   inv.ID,
		AfterState:   map[string]interface{}{"role": inv.Role, "member_id": member.ID},
	})

	return &AcceptInvitationResponse{
		AccessToken:  accessToken,
		Organisation: org,
		Member:       member,
	}, nil
}

func (s *Service) RevokeInvitation(ctx context.Context, orgID, invitationID, revokerID uuid.UUID) error {
	if err := s.repo.RevokeInvitation(ctx, orgID, invitationID); err != nil {
		return fmt.Errorf("revoke invitation %s: %w", invitationID, err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID:        orgID,
		ActorUserID:  revokerID,
		Action:       "invitation.revoked",
		ResourceType: "invitation",
		ResourceID:   invitationID,
	})

	return nil
}

func (s *Service) ListUnlinkedMembers(ctx context.Context, orgID uuid.UUID) ([]UnlinkedMember, error) {
	members, err := s.repo.ListUnlinkedMembers(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("list unlinked members: %w", err)
	}
	return members, nil
}

func (s *Service) GetMyInvitations(ctx context.Context, userID uuid.UUID) ([]MyInvitation, error) {
	invitations, err := s.repo.GetPendingInvitationsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get my invitations: %w", err)
	}
	return invitations, nil
}

func (s *Service) ListMembers(ctx context.Context, orgID uuid.UUID) ([]MemberWithProfile, error) {
	members, err := s.repo.ListMembers(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	return members, nil
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
