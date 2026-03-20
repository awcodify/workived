package leave_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/workived/services/internal/leave"
)

func TestRolloverBalances(t *testing.T) {
	ctx := context.Background()

	testOrgID := uuid.New()
	testEmpID := uuid.New()
	testPolicyID := uuid.New()

	t.Run("happy path — single org, employee, policy", func(t *testing.T) {
		var capturedCarryOver float64
		repo := &mockRepo{
			listPolicies: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, CarryOverDays: 5, IsActive: true},
				}, nil
			},
			getBalance: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, year int) (*leave.Balance, error) {
				if year == 2025 {
					return &leave.Balance{
						EntitledDays:    12,
						CarriedOverDays: 0,
						UsedDays:        8,
						PendingDays:     0,
					}, nil
				}
				return nil, errors.New("not found")
			},
			createBalanceWithCarryOver: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int, entitled, carriedOver float64) error {
				capturedCarryOver = carriedOver
				return nil
			},
		}
		orgList := func(_ context.Context) ([]leave.Org, error) {
			return []leave.Org{{ID: testOrgID, Name: "Test Org"}}, nil
		}
		empList := func(_ context.Context, _ uuid.UUID) ([]leave.Emp, error) {
			return []leave.Emp{{ID: testEmpID, FullName: "John Doe"}}, nil
		}

		result, err := leave.RolloverBalances(ctx, repo, orgList, empList, 2025, 2026)
		if err != nil {
			t.Fatalf("RolloverBalances() error = %v", err)
		}
		if result.TotalOrganisations != 1 {
			t.Errorf("TotalOrganisations = %d, want 1", result.TotalOrganisations)
		}
		if result.TotalEmployees != 1 {
			t.Errorf("TotalEmployees = %d, want 1", result.TotalEmployees)
		}
		if result.BalancesCreated != 1 {
			t.Errorf("BalancesCreated = %d, want 1", result.BalancesCreated)
		}
		if len(result.Errors) != 0 {
			t.Errorf("Errors count = %d, want 0", len(result.Errors))
		}
		// User had 12 - 8 = 4 unused days, should carry over 4
		if capturedCarryOver != 4 {
			t.Errorf("carry-over = %f, want 4", capturedCarryOver)
		}
	})

	t.Run("carry-over capped at policy max", func(t *testing.T) {
		var capturedCarryOver float64
		repo := &mockRepo{
			listPolicies: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, CarryOverDays: 3, IsActive: true},
				}, nil
			},
			getBalance: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, year int) (*leave.Balance, error) {
				if year == 2025 {
					// User has 10 unused days (12 - 2), but policy only allows 3 carry-over
					return &leave.Balance{
						EntitledDays:    12,
						CarriedOverDays: 0,
						UsedDays:        2,
						PendingDays:     0,
					}, nil
				}
				return nil, errors.New("not found")
			},
			createBalanceWithCarryOver: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int, _, carriedOver float64) error {
				capturedCarryOver = carriedOver
				return nil
			},
		}
		orgList := func(_ context.Context) ([]leave.Org, error) {
			return []leave.Org{{ID: testOrgID, Name: "Test Org"}}, nil
		}
		empList := func(_ context.Context, _ uuid.UUID) ([]leave.Emp, error) {
			return []leave.Emp{{ID: testEmpID, FullName: "Jane Doe"}}, nil
		}

		result, err := leave.RolloverBalances(ctx, repo, orgList, empList, 2025, 2026)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.BalancesCreated != 1 {
			t.Errorf("BalancesCreated = %d, want 1", result.BalancesCreated)
		}
		// Should be capped at 3 even though user has 10 unused
		if capturedCarryOver != 3 {
			t.Errorf("carry-over should be capped at 3, got %f", capturedCarryOver)
		}
	})

	t.Run("no balance for previous year — start fresh", func(t *testing.T) {
		var capturedCarryOver float64
		repo := &mockRepo{
			listPolicies: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, CarryOverDays: 5, IsActive: true},
				}, nil
			},
			getBalance: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int) (*leave.Balance, error) {
				return nil, errors.New("not found")
			},
			createBalanceWithCarryOver: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int, _, carriedOver float64) error {
				capturedCarryOver = carriedOver
				return nil
			},
		}
		orgList := func(_ context.Context) ([]leave.Org, error) {
			return []leave.Org{{ID: testOrgID, Name: "Test Org"}}, nil
		}
		empList := func(_ context.Context, _ uuid.UUID) ([]leave.Emp, error) {
			return []leave.Emp{{ID: testEmpID, FullName: "New Employee"}}, nil
		}

		result, err := leave.RolloverBalances(ctx, repo, orgList, empList, 2025, 2026)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.BalancesCreated != 1 {
			t.Errorf("BalancesCreated = %d, want 1", result.BalancesCreated)
		}
		// New employee should have 0 carry-over
		if capturedCarryOver != 0 {
			t.Errorf("expected 0 carry-over for new employee, got %f", capturedCarryOver)
		}
	})

	t.Run("skip inactive policies", func(t *testing.T) {
		repo := &mockRepo{
			listPolicies: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{ID: testPolicyID, Name: "Old Policy", DaysPerYear: 12, CarryOverDays: 5, IsActive: false},
				}, nil
			},
			getBalance: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int) (*leave.Balance, error) {
				return nil, errors.New("not found")
			},
			createBalanceWithCarryOver: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ uuid.UUID, _ int, _, _ float64) error {
				t.Error("should not create balance for inactive policy")
				return nil
			},
		}
		orgList := func(_ context.Context) ([]leave.Org, error) {
			return []leave.Org{{ID: testOrgID, Name: "Test Org"}}, nil
		}
		empList := func(_ context.Context, _ uuid.UUID) ([]leave.Emp, error) {
			return []leave.Emp{{ID: testEmpID, FullName: "John Doe"}}, nil
		}

		result, err := leave.RolloverBalances(ctx, repo, orgList, empList, 2025, 2026)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// No balances should be created for inactive policy
		if result.BalancesCreated != 0 {
			t.Errorf("BalancesCreated = %d, want 0", result.BalancesCreated)
		}
	})
}

// mockRepo implements minimal RepositoryInterface for rollover testing
type mockRepo struct {
	listPolicies               func(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error)
	getBalance                 func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error)
	createBalanceWithCarryOver func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays, carriedOverDays float64) error
}

func (m *mockRepo) ListPolicies(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error) {
	return m.listPolicies(ctx, orgID)
}

func (m *mockRepo) GetBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error) {
	return m.getBalance(ctx, orgID, employeeID, policyID, year)
}

func (m *mockRepo) CreateBalanceWithCarryOver(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays, carriedOverDays float64) error {
	return m.createBalanceWithCarryOver(ctx, orgID, employeeID, policyID, year, entitledDays, carriedOverDays)
}

// Unused interface methods (minimal implementation)
func (m *mockRepo) GetPolicy(context.Context, uuid.UUID, uuid.UUID) (*leave.Policy, error) {
	return nil, nil
}
func (m *mockRepo) CreatePolicy(context.Context, uuid.UUID, leave.CreatePolicyRequest) (*leave.Policy, error) {
	return nil, nil
}
func (m *mockRepo) UpdatePolicy(context.Context, uuid.UUID, uuid.UUID, leave.UpdatePolicyRequest) (*leave.Policy, error) {
	return nil, nil
}
func (m *mockRepo) DeactivatePolicy(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (m *mockRepo) GetBalanceForUpdate(context.Context, pgx.Tx, uuid.UUID, uuid.UUID, uuid.UUID, int) (*leave.Balance, error) {
	return nil, nil
}
func (m *mockRepo) ListBalances(context.Context, uuid.UUID, int) ([]leave.BalanceWithPolicy, error) {
	return nil, nil
}
func (m *mockRepo) ListEmployeeBalances(context.Context, uuid.UUID, uuid.UUID, int) ([]leave.BalanceWithPolicy, error) {
	return nil, nil
}
func (m *mockRepo) EnsureBalance(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, int, float64) error {
	return nil
}
func (m *mockRepo) UpdateBalancePending(context.Context, pgx.Tx, uuid.UUID, float64) error {
	return nil
}
func (m *mockRepo) ApproveBalanceUpdate(context.Context, pgx.Tx, uuid.UUID, float64) error {
	return nil
}
func (m *mockRepo) CreateRequest(context.Context, pgx.Tx, uuid.UUID, uuid.UUID, uuid.UUID, string, string, float64, *string) (*leave.Request, error) {
	return nil, nil
}
func (m *mockRepo) GetRequest(context.Context, uuid.UUID, uuid.UUID) (*leave.Request, error) {
	return nil, nil
}
func (m *mockRepo) UpdateRequestStatus(context.Context, pgx.Tx, uuid.UUID, uuid.UUID, string, string, *uuid.UUID, *string) (*leave.Request, error) {
	return nil, nil
}
func (m *mockRepo) ListRequests(context.Context, uuid.UUID, leave.ListRequestsFilter) ([]leave.RequestWithDetails, error) {
	return nil, nil
}
func (m *mockRepo) HasOverlap(context.Context, uuid.UUID, uuid.UUID, string, string) (bool, error) {
	return false, nil
}
func (m *mockRepo) ListCalendar(context.Context, uuid.UUID, int, int) ([]leave.CalendarEntry, error) {
	return nil, nil
}
func (m *mockRepo) IsOnApprovedLeave(context.Context, uuid.UUID, uuid.UUID, string) (bool, error) {
	return false, nil
}
func (m *mockRepo) ListHolidays(context.Context, string, string, string) ([]leave.PublicHoliday, error) {
	return nil, nil
}
func (m *mockRepo) BeginTx(context.Context) (pgx.Tx, error) { return nil, nil }
func (m *mockRepo) ListTemplates(context.Context, string) ([]leave.PolicyTemplate, error) {
	return nil, nil
}
func (m *mockRepo) GetTemplatesByIDs(context.Context, []uuid.UUID) ([]leave.PolicyTemplate, error) {
	return nil, nil
}
func (m *mockRepo) ImportPoliciesFromTemplates(context.Context, pgx.Tx, uuid.UUID, []leave.PolicyTemplate) ([]leave.Policy, error) {
	return nil, nil
}
func (m *mockRepo) CreateBalancesForAllEmployees(context.Context, pgx.Tx, uuid.UUID, uuid.UUID, int, float64) error {
	return nil
}
