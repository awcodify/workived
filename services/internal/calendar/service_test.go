package calendar_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/calendar"
)

var (
	testOrgID    = uuid.New()
	testHolidayID = uuid.New()
)

// ── Fakes ────────────────────────────────────────────────────────────────────

type fakeRepo struct {
	listHolidaysFn          func(ctx context.Context, orgID uuid.UUID, countryCode, startDate, endDate string) ([]calendar.PublicHoliday, error)
	listOrgCustomHolidaysFn func(ctx context.Context, orgID uuid.UUID) ([]calendar.PublicHoliday, error)
	createCustomHolidayFn   func(ctx context.Context, orgID uuid.UUID, countryCode, date, name string) (*calendar.PublicHoliday, error)
	deleteCustomHolidayFn   func(ctx context.Context, orgID, holidayID uuid.UUID) error
}

func (f *fakeRepo) ListHolidays(ctx context.Context, orgID uuid.UUID, countryCode, startDate, endDate string) ([]calendar.PublicHoliday, error) {
	if f.listHolidaysFn != nil {
		return f.listHolidaysFn(ctx, orgID, countryCode, startDate, endDate)
	}
	return []calendar.PublicHoliday{}, nil
}

func (f *fakeRepo) ListOrgCustomHolidays(ctx context.Context, orgID uuid.UUID) ([]calendar.PublicHoliday, error) {
	if f.listOrgCustomHolidaysFn != nil {
		return f.listOrgCustomHolidaysFn(ctx, orgID)
	}
	return []calendar.PublicHoliday{}, nil
}

func (f *fakeRepo) CreateCustomHoliday(ctx context.Context, orgID uuid.UUID, countryCode, date, name string) (*calendar.PublicHoliday, error) {
	if f.createCustomHolidayFn != nil {
		return f.createCustomHolidayFn(ctx, orgID, countryCode, date, name)
	}
	id := uuid.New()
	return &calendar.PublicHoliday{ID: &id, CountryCode: countryCode, Date: date, Name: name, OrganisationID: &orgID, IsCustom: true}, nil
}

func (f *fakeRepo) DeleteCustomHoliday(ctx context.Context, orgID, holidayID uuid.UUID) error {
	if f.deleteCustomHolidayFn != nil {
		return f.deleteCustomHolidayFn(ctx, orgID, holidayID)
	}
	return nil
}

type fakeOrgRepo struct {
	getOrgCountryCodeFn func(ctx context.Context, orgID uuid.UUID) (string, error)
}

func (f *fakeOrgRepo) GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	if f.getOrgCountryCodeFn != nil {
		return f.getOrgCountryCodeFn(ctx, orgID)
	}
	return "ID", nil
}

func newTestService(repo *fakeRepo, orgRepo *fakeOrgRepo) *calendar.Service {
	return calendar.NewService(repo, orgRepo, zerolog.Nop())
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestService_ListHolidays(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		svc := newTestService(&fakeRepo{}, &fakeOrgRepo{})
		holidays, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = holidays
	})

	t.Run("country code error", func(t *testing.T) {
		orgRepo := &fakeOrgRepo{
			getOrgCountryCodeFn: func(_ context.Context, _ uuid.UUID) (string, error) {
				return "", errors.New("db down")
			},
		}
		svc := newTestService(&fakeRepo{}, orgRepo)
		_, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("repo error", func(t *testing.T) {
		repo := &fakeRepo{
			listHolidaysFn: func(_ context.Context, _ uuid.UUID, _, _, _ string) ([]calendar.PublicHoliday, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestService(repo, &fakeOrgRepo{})
		_, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestService_ListCustomHolidays(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		svc := newTestService(&fakeRepo{}, &fakeOrgRepo{})
		holidays, err := svc.ListCustomHolidays(context.Background(), testOrgID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = holidays
	})

	t.Run("repo error", func(t *testing.T) {
		repo := &fakeRepo{
			listOrgCustomHolidaysFn: func(_ context.Context, _ uuid.UUID) ([]calendar.PublicHoliday, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestService(repo, &fakeOrgRepo{})
		_, err := svc.ListCustomHolidays(context.Background(), testOrgID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestService_CreateCustomHoliday(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		svc := newTestService(&fakeRepo{}, &fakeOrgRepo{})
		h, err := svc.CreateCustomHoliday(context.Background(), testOrgID, calendar.CreateCustomHolidayRequest{
			Date: "2026-12-25",
			Name: "Company Day",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if h.Name != "Company Day" {
			t.Errorf("name = %q, want %q", h.Name, "Company Day")
		}
		if !h.IsCustom {
			t.Error("expected is_custom = true")
		}
	})

	t.Run("invalid date format", func(t *testing.T) {
		svc := newTestService(&fakeRepo{}, &fakeOrgRepo{})
		_, err := svc.CreateCustomHoliday(context.Background(), testOrgID, calendar.CreateCustomHolidayRequest{
			Date: "25-12-2026",
			Name: "Company Day",
		})
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("country code error", func(t *testing.T) {
		orgRepo := &fakeOrgRepo{
			getOrgCountryCodeFn: func(_ context.Context, _ uuid.UUID) (string, error) {
				return "", errors.New("db down")
			},
		}
		svc := newTestService(&fakeRepo{}, orgRepo)
		_, err := svc.CreateCustomHoliday(context.Background(), testOrgID, calendar.CreateCustomHolidayRequest{
			Date: "2026-12-25",
			Name: "Company Day",
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("repo error", func(t *testing.T) {
		repo := &fakeRepo{
			createCustomHolidayFn: func(_ context.Context, _ uuid.UUID, _, _, _ string) (*calendar.PublicHoliday, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestService(repo, &fakeOrgRepo{})
		_, err := svc.CreateCustomHoliday(context.Background(), testOrgID, calendar.CreateCustomHolidayRequest{
			Date: "2026-12-25",
			Name: "Company Day",
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestService_DeleteCustomHoliday(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		svc := newTestService(&fakeRepo{}, &fakeOrgRepo{})
		err := svc.DeleteCustomHoliday(context.Background(), testOrgID, testHolidayID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &fakeRepo{
			deleteCustomHolidayFn: func(_ context.Context, _, _ uuid.UUID) error {
				return errors.New("not found")
			},
		}
		svc := newTestService(repo, &fakeOrgRepo{})
		err := svc.DeleteCustomHoliday(context.Background(), testOrgID, testHolidayID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
