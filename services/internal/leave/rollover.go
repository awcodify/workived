package leave

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
)

// OrgProvider provides organization data for rollover.
type OrgProvider interface {
	GetByID(ctx context.Context, orgID uuid.UUID) (Org, error)
}

// Org represents minimal organization data needed for rollover.
type Org struct {
	ID   uuid.UUID
	Name string
}

// EmployeeProvider provides employee data for rollover.
type EmployeeProvider interface {
	ListActiveEmployees(ctx context.Context, orgID uuid.UUID) ([]Emp, error)
}

// Emp represents minimal employee data needed for rollover.
type Emp struct {
	ID       uuid.UUID
	FullName string
}

// RolloverResult tracks the outcome of a year-end rollover operation.
type RolloverResult struct {
	TotalOrganisations int
	TotalEmployees     int
	TotalPolicies      int
	BalancesCreated    int
	BalancesSkipped    int // Already existed (idempotent)
	Errors             []RolloverError
}

// RolloverError captures an error that occurred during rollover.
type RolloverError struct {
	OrgID        uuid.UUID
	OrgName      string
	EmployeeID   uuid.UUID
	EmployeeName string
	PolicyID     uuid.UUID
	PolicyName   string
	Error        string
}

// RolloverBalances performs year-end leave balance rollover for all organizations.
// It creates new balances for `toYear` with entitlements and carry-over from `fromYear`.
// This operation is idempotent — existing balances are not modified.
func RolloverBalances(
	ctx context.Context,
	repo RepositoryInterface,
	orgListAll func(ctx context.Context) ([]Org, error),
	empListAllActive func(ctx context.Context, orgID uuid.UUID) ([]Emp, error),
	fromYear, toYear int,
) (*RolloverResult, error) {
	result := &RolloverResult{}

	// Get all organizations
	orgs, err := orgListAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("list organizations: %w", err)
	}
	result.TotalOrganisations = len(orgs)

	log.Printf("[Rollover] Processing %d organisations (from %d to %d)", len(orgs), fromYear, toYear)

	for _, org := range orgs {
		// Get active employees
		employees, err := empListAllActive(ctx, org.ID)
		if err != nil {
			log.Printf("[Rollover] Error listing employees for org %s: %v", org.Name, err)
			result.Errors = append(result.Errors, RolloverError{
				OrgID:   org.ID,
				OrgName: org.Name,
				Error:   fmt.Sprintf("list employees: %v", err),
			})
			continue
		}
		result.TotalEmployees += len(employees)

		//Get active leave policies
		policies, err := repo.ListPolicies(ctx, org.ID)
		if err != nil {
			log.Printf("[Rollover] Error listing policies for org %s: %v", org.Name, err)
			result.Errors = append(result.Errors, RolloverError{
				OrgID:   org.ID,
				OrgName: org.Name,
				Error:   fmt.Sprintf("list policies: %v", err),
			})
			continue
		}
		result.TotalPolicies += len(policies)

		log.Printf("[Rollover] Org %s: %d employees × %d policies", org.Name, len(employees), len(policies))

		// For each employee × policy combination
		for _, emp := range employees {
			for _, policy := range policies {
				if !policy.IsActive {
					continue
				}

				// Get balance for previous year
				prevBalance, err := repo.GetBalance(ctx, org.ID, emp.ID, policy.ID, fromYear)
				var carriedOver float64
				if err == nil && prevBalance != nil {
					// Calculate carry-over: min(unused days, policy max)
					unused := prevBalance.Available()
					if unused > 0 {
						carriedOver = min(unused, policy.CarryOverDays)
					}
				}
				// If no balance exists or error, start fresh with 0 carry-over

				// Create new balance for toYear (idempotent)
				err = repo.CreateBalanceWithCarryOver(ctx, org.ID, emp.ID, policy.ID, toYear, policy.DaysPerYear, carriedOver)
				if err != nil {
					log.Printf("[Rollover] Error creating balance for %s (%s) / %s: %v", emp.FullName, org.Name, policy.Name, err)
					result.Errors = append(result.Errors, RolloverError{
						OrgID:        org.ID,
						OrgName:      org.Name,
						EmployeeID:   emp.ID,
						EmployeeName: emp.FullName,
						PolicyID:     policy.ID,
						PolicyName:   policy.Name,
						Error:        fmt.Sprintf("create balance: %v", err),
					})
					continue
				}

				// Check if balance was actually created or already existed
				// (we can't easily distinguish in idempotent INSERT, so count all as "created")
				result.BalancesCreated++
			}
		}
	}

	log.Printf("[Rollover] Complete: %d orgs, %d employees, %d balances created, %d errors",
		result.TotalOrganisations, result.TotalEmployees, result.BalancesCreated, len(result.Errors))

	return result, nil
}

// min returns the smaller of two float64 values.
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
