package calendar

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

// Repository handles all calendar-related database operations.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new calendar repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ListHolidays returns public holidays (country-level) plus org-custom holidays for a date range.
func (r *Repository) ListHolidays(ctx context.Context, orgID uuid.UUID, countryCode, startDate, endDate string) ([]PublicHoliday, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, country_code, date::text, name, organisation_id, is_custom
		FROM public_holidays
		WHERE ((country_code = $2 AND organisation_id IS NULL)
		    OR organisation_id = $1)
		  AND date >= $3::date
		  AND date <= $4::date
		ORDER BY date ASC
	`, orgID, countryCode, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("list holidays: %w", err)
	}
	defer rows.Close()

	var holidays []PublicHoliday
	for rows.Next() {
		var h PublicHoliday
		if err := rows.Scan(&h.ID, &h.CountryCode, &h.Date, &h.Name, &h.OrganisationID, &h.IsCustom); err != nil {
			return nil, fmt.Errorf("scan holiday: %w", err)
		}
		holidays = append(holidays, h)
	}
	return holidays, nil
}

// ListOrgCustomHolidays returns all custom holidays for an organisation.
func (r *Repository) ListOrgCustomHolidays(ctx context.Context, orgID uuid.UUID) ([]PublicHoliday, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, country_code, date::text, name, organisation_id, is_custom
		FROM public_holidays
		WHERE organisation_id = $1
		ORDER BY date ASC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list org custom holidays: %w", err)
	}
	defer rows.Close()

	var holidays []PublicHoliday
	for rows.Next() {
		var h PublicHoliday
		if err := rows.Scan(&h.ID, &h.CountryCode, &h.Date, &h.Name, &h.OrganisationID, &h.IsCustom); err != nil {
			return nil, fmt.Errorf("scan custom holiday: %w", err)
		}
		holidays = append(holidays, h)
	}
	return holidays, nil
}

// CreateCustomHoliday creates an org-specific custom holiday.
func (r *Repository) CreateCustomHoliday(ctx context.Context, orgID uuid.UUID, countryCode, date, name string) (*PublicHoliday, error) {
	var h PublicHoliday
	err := r.db.QueryRow(ctx, `
		INSERT INTO public_holidays (country_code, date, name, organisation_id, is_custom)
		VALUES ($1, $2::date, $3, $4, TRUE)
		RETURNING id, country_code, date::text, name, organisation_id, is_custom
	`, countryCode, date, name, orgID).Scan(
		&h.ID, &h.CountryCode, &h.Date, &h.Name, &h.OrganisationID, &h.IsCustom,
	)
	if err != nil {
		return nil, fmt.Errorf("create custom holiday: %w", err)
	}
	return &h, nil
}

// DeleteCustomHoliday removes an org-specific custom holiday.
func (r *Repository) DeleteCustomHoliday(ctx context.Context, orgID, holidayID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM public_holidays
		WHERE organisation_id = $1 AND id = $2 AND is_custom = TRUE
	`, orgID, holidayID)
	if err != nil {
		return fmt.Errorf("delete custom holiday: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("custom holiday")
	}
	return nil
}
