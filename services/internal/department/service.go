package department

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]Department, error) {
	return s.repo.List(ctx, orgID)
}

func (s *Service) Create(ctx context.Context, orgID uuid.UUID, req CreateDepartmentRequest) (*Department, error) {
	return s.repo.Create(ctx, orgID, req)
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateDepartmentRequest) (*Department, error) {
	return s.repo.Update(ctx, orgID, id, req)
}

func (s *Service) Deactivate(ctx context.Context, orgID, id uuid.UUID) error {
	return s.repo.SoftDelete(ctx, orgID, id)
}
