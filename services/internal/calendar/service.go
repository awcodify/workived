package calendar

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
)

// ── Interfaces ──────────────────────────────────────────────────────────────

type RepositoryInterface interface {
	ListHolidays(ctx context.Context, orgID uuid.UUID, countryCode, startDate, endDate string) ([]PublicHoliday, error)
	ListOrgCustomHolidays(ctx context.Context, orgID uuid.UUID) ([]PublicHoliday, error)
	CreateCustomHoliday(ctx context.Context, orgID uuid.UUID, countryCode, date, name string) (*PublicHoliday, error)
	DeleteCustomHoliday(ctx context.Context, orgID, holidayID uuid.UUID) error
}

// OrgInfoProvider provides the narrow view of org data the calendar service needs.
type OrgInfoProvider interface {
	GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
}

// ── Service ─────────────────────────────────────────────────────────────────

type Service struct {
	repo    RepositoryInterface
	orgRepo OrgInfoProvider
	log     zerolog.Logger
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, log zerolog.Logger) *Service {
	return &Service{repo: repo, orgRepo: orgRepo, log: log}
}

// ListHolidays returns public holidays + org custom holidays for a date range.
func (s *Service) ListHolidays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) ([]PublicHoliday, error) {
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org country: %w", err)
	}

	holidays, err := s.repo.ListHolidays(ctx, orgID, countryCode, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("list holidays: %w", err)
	}
	return holidays, nil
}

// ListCustomHolidays returns org-specific custom holidays.
func (s *Service) ListCustomHolidays(ctx context.Context, orgID uuid.UUID) ([]PublicHoliday, error) {
	return s.repo.ListOrgCustomHolidays(ctx, orgID)
}

// CreateCustomHoliday creates an org-specific custom holiday.
func (s *Service) CreateCustomHoliday(ctx context.Context, orgID uuid.UUID, req CreateCustomHolidayRequest) (*PublicHoliday, error) {
	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		return nil, apperr.New(apperr.CodeValidation, "invalid date format, expected YYYY-MM-DD")
	}

	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org country: %w", err)
	}

	h, err := s.repo.CreateCustomHoliday(ctx, orgID, countryCode, req.Date, req.Name)
	if err != nil {
		return nil, fmt.Errorf("create custom holiday: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("holiday_id", h.ID.String()).
		Str("date", req.Date).
		Str("name", req.Name).
		Msg("custom_holiday.created")

	return h, nil
}

// DeleteCustomHoliday removes an org-specific custom holiday.
func (s *Service) DeleteCustomHoliday(ctx context.Context, orgID, holidayID uuid.UUID) error {
	if err := s.repo.DeleteCustomHoliday(ctx, orgID, holidayID); err != nil {
		return fmt.Errorf("delete custom holiday: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("holiday_id", holidayID.String()).
		Msg("custom_holiday.deleted")

	return nil
}
