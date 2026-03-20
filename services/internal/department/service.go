package department

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type Service struct {
	repo *Repository
	log  zerolog.Logger
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
	return s.repo.List(ctx, orgID)
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

	return nil
}
