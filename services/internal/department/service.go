package department

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/cache"
)

type Service struct {
	repo  *Repository
	cache *cache.Store
	log   zerolog.Logger
}

type ServiceOption func(*Service)

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

func NewService(repo *Repository, opts ...ServiceOption) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]Department, error) {
	return s.listCached(ctx, orgID)
}

func (s *Service) Create(ctx context.Context, orgID uuid.UUID, req CreateDepartmentRequest) (*Department, error) {
	dept, err := s.repo.Create(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("department_id", dept.ID.String()).
		Str("name", dept.Name).
		Msg("department.created")

	s.invalidateCache(ctx, orgID)

	return dept, nil
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateDepartmentRequest) (*Department, error) {
	dept, err := s.repo.Update(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("department_id", id.String()).
		Str("name", dept.Name).
		Msg("department.updated")

	s.invalidateCache(ctx, orgID)

	return dept, nil
}

func (s *Service) Deactivate(ctx context.Context, orgID, id uuid.UUID) error {
	err := s.repo.SoftDelete(ctx, orgID, id)
	if err != nil {
		return err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("department_id", id.String()).
		Msg("department.deactivated")

	s.invalidateCache(ctx, orgID)

	return nil
}
