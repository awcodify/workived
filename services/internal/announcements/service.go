package announcements

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	List(ctx context.Context, orgID, employeeID uuid.UUID) ([]Announcement, error)
	ListAdmin(ctx context.Context, orgID uuid.UUID) ([]Announcement, error)
	GetByID(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error)
	Create(ctx context.Context, orgID, authorID uuid.UUID, req CreateAnnouncementRequest, now time.Time) (*Announcement, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateAnnouncementRequest) (*Announcement, error)
	Publish(ctx context.Context, orgID, id uuid.UUID, now time.Time) (*Announcement, error)
	SetPinned(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*Announcement, error)
	Delete(ctx context.Context, orgID, id uuid.UUID) error
	MarkRead(ctx context.Context, orgID, announcementID, employeeID uuid.UUID) error
	CountUnread(ctx context.Context, orgID, employeeID uuid.UUID) (int, error)
}

// NowFunc can be replaced in tests to control time.
type NowFunc func() time.Time

type Service struct {
	repo RepositoryInterface
	now  NowFunc
	log  zerolog.Logger
}

func NewService(repo RepositoryInterface, log zerolog.Logger) *Service {
	return &Service{repo: repo, now: time.Now, log: log}
}

// SetNowFunc overrides the clock — used in tests only.
func (s *Service) SetNowFunc(fn NowFunc) { s.now = fn }

func (s *Service) List(ctx context.Context, orgID, employeeID uuid.UUID) ([]Announcement, error) {
	list, err := s.repo.List(ctx, orgID, employeeID)
	if err != nil {
		return nil, fmt.Errorf("list announcements: %w", err)
	}
	if list == nil {
		return []Announcement{}, nil
	}
	return list, nil
}

func (s *Service) ListAdmin(ctx context.Context, orgID uuid.UUID) ([]Announcement, error) {
	list, err := s.repo.ListAdmin(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("list admin announcements: %w", err)
	}
	if list == nil {
		return []Announcement{}, nil
	}
	return list, nil
}

func (s *Service) GetByID(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error) {
	ann, err := s.repo.GetByID(ctx, orgID, id)
	if err != nil {
		return nil, fmt.Errorf("get announcement: %w", err)
	}
	return ann, nil
}

func (s *Service) Create(ctx context.Context, orgID, authorID uuid.UUID, req CreateAnnouncementRequest) (*Announcement, error) {
	ann, err := s.repo.Create(ctx, orgID, authorID, req, s.now())
	if err != nil {
		return nil, fmt.Errorf("create announcement: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("announcement_id", ann.ID.String()).
		Str("author_id", authorID.String()).
		Bool("published", req.Publish).
		Msg("announcement.created")

	return ann, nil
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateAnnouncementRequest) (*Announcement, error) {
	ann, err := s.repo.Update(ctx, orgID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update announcement: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("announcement_id", id.String()).
		Msg("announcement.updated")

	return ann, nil
}

func (s *Service) Publish(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error) {
	ann, err := s.repo.Publish(ctx, orgID, id, s.now())
	if err != nil {
		return nil, fmt.Errorf("publish announcement: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("announcement_id", id.String()).
		Msg("announcement.published")

	return ann, nil
}

func (s *Service) SetPinned(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*Announcement, error) {
	ann, err := s.repo.SetPinned(ctx, orgID, id, pinned)
	if err != nil {
		return nil, fmt.Errorf("set pinned: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("announcement_id", id.String()).
		Bool("pinned", pinned).
		Msg("announcement.pin_changed")

	return ann, nil
}

func (s *Service) Delete(ctx context.Context, orgID, id uuid.UUID) error {
	if err := s.repo.Delete(ctx, orgID, id); err != nil {
		return fmt.Errorf("delete announcement: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("announcement_id", id.String()).
		Msg("announcement.deleted")

	return nil
}

func (s *Service) MarkRead(ctx context.Context, orgID, announcementID, employeeID uuid.UUID) error {
	if err := s.repo.MarkRead(ctx, orgID, announcementID, employeeID); err != nil {
		return fmt.Errorf("mark read: %w", err)
	}
	return nil
}

func (s *Service) CountUnread(ctx context.Context, orgID, employeeID uuid.UUID) (int, error) {
	count, err := s.repo.CountUnread(ctx, orgID, employeeID)
	if err != nil {
		return 0, fmt.Errorf("count unread: %w", err)
	}
	return count, nil
}
