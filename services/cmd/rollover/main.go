package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
)

func main() {
	fromYear := flag.Int("from", time.Now().Year()-1, "Year to roll over from (default: current year - 1)")
	toYear := flag.Int("to", time.Now().Year(), "Year to roll over to (default: current year)")
	dryRun := flag.Bool("dry-run", false, "Simulate rollover without making changes")
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer func() { _ = logger.Sync() }()

	log.Printf("Leave Balance Rollover: %d → %d (dry-run: %v)", *fromYear, *toYear, *dryRun)

	if *dryRun {
		log.Println("DRY RUN MODE: No database changes will be made")
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	ctx := context.Background()
	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	orgRepo := organisation.NewRepository(db)
	empRepo := employee.NewRepository(db)
	leaveRepo := leave.NewRepository(db)

	// Create adapter functions to match the rollover signature
	orgListAll := func(ctx context.Context) ([]leave.Org, error) {
		orgs, err := orgRepo.ListAll(ctx)
		if err != nil {
			return nil, err
		}
		result := make([]leave.Org, len(orgs))
		for i, org := range orgs {
			result[i] = leave.Org{ID: org.ID, Name: org.Name}
		}
		return result, nil
	}

	empListAllActive := func(ctx context.Context, orgID uuid.UUID) ([]leave.Emp, error) {
		employees, err := empRepo.ListAllActive(ctx, orgID)
		if err != nil {
			return nil, err
		}
		result := make([]leave.Emp, len(employees))
		for i, emp := range employees {
			result[i] = leave.Emp{ID: emp.ID, FullName: emp.FullName}
		}
		return result, nil
	}

	// Perform rollover
	result, err := leave.RolloverBalances(ctx, leaveRepo, orgListAll, empListAllActive, *fromYear, *toYear)
	if err != nil {
		log.Fatalf("Rollover failed: %v", err)
	}

	// Print summary
	separator := strings.Repeat("=", 60)
	fmt.Println("\n" + separator)
	fmt.Println("ROLLOVER SUMMARY")
	fmt.Println(separator)
	fmt.Printf("Organisations processed: %d\n", result.TotalOrganisations)
	fmt.Printf("Employees processed:     %d\n", result.TotalEmployees)
	fmt.Printf("Policies processed:      %d\n", result.TotalPolicies)
	fmt.Printf("Balances created:        %d\n", result.BalancesCreated)
	fmt.Printf("Balances skipped:        %d\n", result.BalancesSkipped)
	fmt.Printf("Errors encountered:      %d\n", len(result.Errors))
	fmt.Println(separator)

	if len(result.Errors) > 0 {
		fmt.Println("\nERRORS:")
		for i, e := range result.Errors {
			fmt.Printf("%d. Org: %s (%s)", i+1, e.OrgName, e.OrgID)
			if e.EmployeeID != uuid.Nil {
				fmt.Printf(" | Employee: %s (%s)", e.EmployeeName, e.EmployeeID)
			}
			if e.PolicyID != uuid.Nil {
				fmt.Printf(" | Policy: %s (%s)", e.PolicyName, e.PolicyID)
			}
			fmt.Printf("\n   Error: %s\n", e.Error)
		}
		os.Exit(1)
	}

	log.Println("Rollover completed successfully")
}
