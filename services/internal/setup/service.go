package setup

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/workived/services/pkg/apperr"
)

type Service struct {
	repo   RepositoryInterface
	logger zerolog.Logger
}

func NewService(repo RepositoryInterface, logger zerolog.Logger) *Service {
	return &Service{
		repo:   repo,
		logger: logger.With().Str("service", "setup").Logger(),
	}
}

// GetSetupStatus retrieves the current setup wizard state
func (s *Service) GetSetupStatus(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
	status, err := s.repo.GetSetupStatus(ctx, orgID)
	if err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to get setup status")
		return nil, apperr.Internal()
	}

	return status, nil
}

// GetTemplates retrieves all available templates for the organisation's country
func (s *Service) GetTemplates(ctx context.Context, orgID uuid.UUID) (*SetupTemplatesResponse, error) {
	// Get organisation's country code
	countryCode, err := s.repo.GetOrganisationCountryCode(ctx, orgID)
	if err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to get country code")
		return nil, apperr.Internal()
	}

	// Fetch all templates
	workSchedules, err := s.repo.GetWorkScheduleTemplates(ctx, countryCode)
	if err != nil {
		s.logger.Error().Err(err).Str("country", countryCode).Msg("failed to get work schedule templates")
		return nil, apperr.Internal()
	}

	leavePolicies, err := s.repo.GetLeavePolicyTemplates(ctx, countryCode)
	if err != nil {
		s.logger.Error().Err(err).Str("country", countryCode).Msg("failed to get leave policy templates")
		return nil, apperr.Internal()
	}

	claimCategories, err := s.repo.GetClaimCategoryTemplates(ctx, countryCode)
	if err != nil {
		s.logger.Error().Err(err).Str("country", countryCode).Msg("failed to get claim category templates")
		return nil, apperr.Internal()
	}

	return &SetupTemplatesResponse{
		WorkSchedules:   workSchedules,
		LeavePolicies:   leavePolicies,
		ClaimCategories: claimCategories,
	}, nil
}

// CompleteSetup processes the full setup wizard in a single transaction
func (s *Service) CompleteSetup(ctx context.Context, orgID uuid.UUID, req *CompleteSetupRequest) (*CompleteSetupResponse, error) {
	// Validate setup hasn't been completed already
	status, err := s.repo.GetSetupStatus(ctx, orgID)
	if err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to check setup status")
		return nil, apperr.Internal()
	}

	if !status.NeedsSetup {
		return nil, apperr.New(apperr.CodeValidation, "setup wizard already completed or skipped")
	}

	// Begin transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return nil, apperr.Internal()
	}
	defer func() { _ = tx.Rollback(ctx) }()

	response := &CompleteSetupResponse{Success: false}

	// 1. Create work schedule (template or custom)
	var workScheduleID uuid.UUID
	if req.WorkSchedule.TemplateID != nil {
		workScheduleID, err = s.repo.CreateWorkScheduleFromTemplate(ctx, tx, orgID, *req.WorkSchedule.TemplateID)
		if err != nil {
			s.logger.Error().Err(err).Str("template_id", req.WorkSchedule.TemplateID.String()).Msg("failed to create work schedule from template")
			return nil, apperr.Internal()
		}
	} else if req.WorkSchedule.CustomSchedule != nil {
		workScheduleID, err = s.repo.CreateCustomWorkSchedule(ctx, tx, orgID, req.WorkSchedule.CustomSchedule)
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to create custom work schedule")
			return nil, apperr.Internal()
		}
	} else {
		return nil, apperr.New(apperr.CodeValidation, "work schedule must specify either template_id or custom_schedule")
	}
	response.WorkScheduleID = workScheduleID

	// 2. Create leave policies from templates
	var leavePolicyIDs []uuid.UUID
	for _, templateID := range req.LeavePolicies.TemplateIDs {
		customization := req.LeavePolicies.Customizations[templateID.String()]
		var custom *LeavePolicyCustomization
		if customization.DaysPerYear != nil {
			custom = &customization
		}

		policyID, err := s.repo.CreateLeavePolicyFromTemplate(ctx, tx, orgID, templateID, custom)
		if err != nil {
			s.logger.Error().Err(err).Str("template_id", templateID.String()).Msg("failed to create leave policy")
			return nil, apperr.Internal()
		}
		leavePolicyIDs = append(leavePolicyIDs, policyID)
	}
	response.LeavePolicyIDs = leavePolicyIDs

	// 3. Create claim categories from templates
	var claimCategoryIDs []uuid.UUID
	for _, templateID := range req.ClaimCategories.TemplateIDs {
		customization := req.ClaimCategories.Customizations[templateID.String()]
		var custom *ClaimCategoryCustomization
		if customization.MonthlyLimit != nil {
			custom = &customization
		}

		categoryID, err := s.repo.CreateClaimCategoryFromTemplate(ctx, tx, orgID, templateID, custom)
		if err != nil {
			s.logger.Error().Err(err).Str("template_id", templateID.String()).Msg("failed to create claim category")
			return nil, apperr.Internal()
		}
		claimCategoryIDs = append(claimCategoryIDs, categoryID)
	}
	response.ClaimCategoryIDs = claimCategoryIDs

	// 4. Mark setup as complete
	if err := s.repo.MarkSetupComplete(ctx, tx, orgID); err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to mark setup complete")
		return nil, apperr.Internal()
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit setup transaction")
		return nil, apperr.Internal()
	}

	response.Success = true

	s.logger.Info().
		Str("org_id", orgID.String()).
		Str("work_schedule_id", workScheduleID.String()).
		Int("leave_policies", len(leavePolicyIDs)).
		Int("claim_categories", len(claimCategoryIDs)).
		Msg("setup wizard completed successfully")

	return response, nil
}

// SkipSetup marks the setup wizard as skipped
func (s *Service) SkipSetup(ctx context.Context, orgID uuid.UUID) error {
	// Validate setup hasn't been completed already
	status, err := s.repo.GetSetupStatus(ctx, orgID)
	if err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to check setup status")
		return apperr.Internal()
	}

	if !status.NeedsSetup {
		return apperr.New(apperr.CodeValidation, "setup wizard already completed or skipped")
	}

	if err := s.repo.MarkSetupSkipped(ctx, orgID); err != nil {
		s.logger.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to skip setup")
		return apperr.Internal()
	}

	s.logger.Info().Str("org_id", orgID.String()).Msg("setup wizard skipped")
	return nil
}

// ValidateCompleteSetupRequest validates the setup request
func (s *Service) ValidateCompleteSetupRequest(req *CompleteSetupRequest) error {
	// Validate work schedule choice is exclusive
	if req.WorkSchedule.TemplateID != nil && req.WorkSchedule.CustomSchedule != nil {
		return errors.New("work schedule must use either template_id or custom_schedule, not both")
	}
	if req.WorkSchedule.TemplateID == nil && req.WorkSchedule.CustomSchedule == nil {
		return errors.New("work schedule must specify either template_id or custom_schedule")
	}

	// Validate custom schedule if provided
	if req.WorkSchedule.CustomSchedule != nil {
		custom := req.WorkSchedule.CustomSchedule
		if len(custom.Name) == 0 || len(custom.Name) > 100 {
			return errors.New("custom schedule name must be 1-100 characters")
		}
		if len(custom.WorkDays) == 0 || len(custom.WorkDays) > 7 {
			return errors.New("custom schedule must have 1-7 work days")
		}
		for _, day := range custom.WorkDays {
			if day < 1 || day > 7 {
				return fmt.Errorf("invalid work day: %d (must be 1-7)", day)
			}
		}
	}

	// Validate leave policies
	if len(req.LeavePolicies.TemplateIDs) == 0 {
		return errors.New("at least one leave policy must be selected")
	}

	// Validate claim categories
	if len(req.ClaimCategories.TemplateIDs) == 0 {
		return errors.New("at least one claim category must be selected")
	}

	return nil
}
