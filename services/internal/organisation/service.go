package organisation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

// AuthRepo is the narrow auth interface the org service needs.
type AuthRepo interface {
	CreateToken(ctx context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error
}

type Service struct {
	repo     *Repository
	authRepo AuthRepo
}

func NewService(repo *Repository, authRepo AuthRepo) *Service {
	return &Service{repo: repo, authRepo: authRepo}
}

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, req CreateOrgRequest) (*Organisation, error) {
	return s.repo.Create(ctx, req, ownerID)
}

func (s *Service) Get(ctx context.Context, orgID uuid.UUID) (*Organisation, error) {
	return s.repo.GetByID(ctx, orgID)
}

func (s *Service) InviteMember(ctx context.Context, orgID, inviterID uuid.UUID, req InviteMemberRequest) error {
	// Only owners and admins can invite
	// Role check is done in the handler via middleware.RequireRole

	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(72 * time.Hour)

	if err := s.repo.CreateInvitation(ctx, orgID, req.Email, req.Role, inviterID, tokenHash, expiresAt); err != nil {
		return apperr.Internal()
	}

	_ = rawToken // TODO Sprint 5+: send invitation email
	return nil
}


func generateToken() (raw, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return
}
