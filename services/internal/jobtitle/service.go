package jobtitle

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

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]JobTitle, error) {
	return s.listCached(ctx, orgID)
}

func (s *Service) Search(ctx context.Context, orgID uuid.UUID, query string) ([]JobTitle, error) {
	// Don't cache search results — they change based on query
	return s.repo.Search(ctx, orgID, query)
}

func (s *Service) Create(ctx context.Context, orgID uuid.UUID, req CreateJobTitleRequest) (*JobTitle, error) {
	jt, err := s.repo.Create(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("job_title_id", jt.ID.String()).
		Str("name", jt.Name).
		Msg("job_title.created")

	s.invalidateCache(ctx, orgID)

	return jt, nil
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateJobTitleRequest) (*JobTitle, error) {
	jt, err := s.repo.Update(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("job_title_id", id.String()).
		Str("name", jt.Name).
		Msg("job_title.updated")

	s.invalidateCache(ctx, orgID)

	return jt, nil
}

func (s *Service) Deactivate(ctx context.Context, orgID, id uuid.UUID) error {
	err := s.repo.SoftDelete(ctx, orgID, id)
	if err != nil {
		return err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("job_title_id", id.String()).
		Msg("job_title.deactivated")

	s.invalidateCache(ctx, orgID)

	return nil
}
