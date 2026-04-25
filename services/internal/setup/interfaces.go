package setup

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RepositoryInterface defines the contract for setup repository operations
type RepositoryInterface interface {
	GetSetupStatus(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error)
	GetOrganisationCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
	GetWorkScheduleTemplates(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error)
	GetLeavePolicyTemplates(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error)
	GetClaimCategoryTemplates(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error)
	MarkSetupComplete(ctx context.Context, tx pgx.Tx, orgID uuid.UUID) error
	MarkSetupSkipped(ctx context.Context, orgID uuid.UUID) error
	CreateWorkScheduleFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID) (uuid.UUID, error)
	CreateCustomWorkSchedule(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, input *CustomScheduleInput) (uuid.UUID, error)
	AssignScheduleToUnassignedEmployeesTx(ctx context.Context, tx pgx.Tx, orgID, scheduleID uuid.UUID) error
	CreateLeavePolicyFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *LeavePolicyCustomization) (uuid.UUID, error)
	CreateClaimCategoryFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *ClaimCategoryCustomization) (uuid.UUID, error)
	CreateInvitation(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, email, role string) (uuid.UUID, error)
	BeginTx(ctx context.Context) (pgx.Tx, error)
}
