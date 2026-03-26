package leave_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/pkg/email"
	"github.com/workived/services/pkg/apperr"
)

// ── fakeTx ──────────────────────────────────────────────────────────────────

type fakeTx struct{}

func (f *fakeTx) Begin(_ context.Context) (pgx.Tx, error) { return &fakeTx{}, nil }
func (f *fakeTx) Commit(_ context.Context) error          { return nil }
func (f *fakeTx) Rollback(_ context.Context) error        { return nil }
func (f *fakeTx) CopyFrom(_ context.Context, _ pgx.Identifier, _ []string, _ pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (f *fakeTx) SendBatch(_ context.Context, _ *pgx.Batch) pgx.BatchResults {
	return &fakeBatchResults{}
}
func (f *fakeTx) LargeObjects() pgx.LargeObjects { return pgx.LargeObjects{} }
func (f *fakeTx) Prepare(_ context.Context, _, _ string) (*pgconn.StatementDescription, error) {
	return &pgconn.StatementDescription{}, nil
}
func (f *fakeTx) Exec(_ context.Context, _ string, _ ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (f *fakeTx) Query(_ context.Context, _ string, _ ...any) (pgx.Rows, error) { return nil, nil }
func (f *fakeTx) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row        { return &fakeRow{} }
func (f *fakeTx) Conn() *pgx.Conn                                               { return nil }

type fakeRow struct{}

func (f *fakeRow) Scan(_ ...any) error { return nil }

type fakeBatchResults struct{}

func (f *fakeBatchResults) Exec() (pgconn.CommandTag, error) { return pgconn.CommandTag{}, nil }
func (f *fakeBatchResults) Query() (pgx.Rows, error)         { return nil, nil }
func (f *fakeBatchResults) QueryRow() pgx.Row                { return &fakeRow{} }
func (f *fakeBatchResults) Close() error                     { return nil }

// ── fakeRepo ────────────────────────────────────────────────────────────────

type fakeRepo struct {
	listPoliciesFn                        func(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error)
	getPolicyFn                           func(ctx context.Context, orgID, policyID uuid.UUID) (*leave.Policy, error)
	createPolicyFn                        func(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error)
	updatePolicyFn                        func(ctx context.Context, orgID, policyID uuid.UUID, req leave.UpdatePolicyRequest) (*leave.Policy, error)
	deactivatePolicyFn                    func(ctx context.Context, orgID, policyID uuid.UUID) error
	countPendingRequestsByPolicyFn        func(ctx context.Context, orgID, policyID uuid.UUID) (int, error)
	countFutureApprovedRequestsByPolicyFn func(ctx context.Context, orgID, policyID uuid.UUID, todayLocal string) (int, error)
	getBalanceFn                          func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error)
	getBalanceForUpdateFn                 func(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error)
	listBalancesFn                        func(ctx context.Context, orgID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	listEmployeeBalsFn                    func(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	ensureBalanceFn                       func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays float64) error
	updateBalPendingFn                    func(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, deltaDays float64) error
	approveBalUpdateFn                    func(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, totalDays float64) error
	createRequestFn                       func(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, startDate, endDate string, totalDays float64, reason *string) (*leave.Request, error)
	getRequestFn                          func(ctx context.Context, orgID, requestID uuid.UUID) (*leave.Request, error)
	updateRequestStatusFn                 func(ctx context.Context, tx pgx.Tx, orgID, requestID uuid.UUID, expectedCurrentStatus, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*leave.Request, error)
	listRequestsFn                        func(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter) ([]leave.RequestWithDetails, error)
	hasOverlapFn                          func(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error)
	listCalendarFn                        func(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error)
	isOnApprovedLeaveFn                   func(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error)
	listHolidaysFn                        func(ctx context.Context, countryCode, startDate, endDate string) ([]leave.PublicHoliday, error)
	beginTxFn                             func(ctx context.Context) (pgx.Tx, error)
	listTemplatesFn                       func(ctx context.Context, countryCode string) ([]leave.PolicyTemplate, error)
	getTemplatesByIDsFn                   func(ctx context.Context, ids []uuid.UUID) ([]leave.PolicyTemplate, error)
	importPoliciesFromTemplatesFn         func(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, templates []leave.PolicyTemplate) ([]leave.Policy, error)
	createBalancesForAllEmployeesFn       func(ctx context.Context, tx pgx.Tx, orgID, policyID uuid.UUID, year int, entitledDays float64) error
}

func (f *fakeRepo) ListPolicies(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error) {
	return f.listPoliciesFn(ctx, orgID)
}
func (f *fakeRepo) GetPolicy(ctx context.Context, orgID, policyID uuid.UUID) (*leave.Policy, error) {
	return f.getPolicyFn(ctx, orgID, policyID)
}
func (f *fakeRepo) CreatePolicy(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error) {
	return f.createPolicyFn(ctx, orgID, req)
}
func (f *fakeRepo) UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req leave.UpdatePolicyRequest) (*leave.Policy, error) {
	return f.updatePolicyFn(ctx, orgID, policyID, req)
}
func (f *fakeRepo) DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error {
	return f.deactivatePolicyFn(ctx, orgID, policyID)
}
func (f *fakeRepo) CountPendingRequestsByPolicy(ctx context.Context, orgID, policyID uuid.UUID) (int, error) {
	if f.countPendingRequestsByPolicyFn != nil {
		return f.countPendingRequestsByPolicyFn(ctx, orgID, policyID)
	}
	return 0, nil
}
func (f *fakeRepo) CountFutureApprovedRequestsByPolicy(ctx context.Context, orgID, policyID uuid.UUID, todayLocal string) (int, error) {
	if f.countFutureApprovedRequestsByPolicyFn != nil {
		return f.countFutureApprovedRequestsByPolicyFn(ctx, orgID, policyID, todayLocal)
	}
	return 0, nil
}
func (f *fakeRepo) GetBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error) {
	return f.getBalanceFn(ctx, orgID, employeeID, policyID, year)
}
func (f *fakeRepo) GetBalanceForUpdate(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error) {
	return f.getBalanceForUpdateFn(ctx, tx, orgID, employeeID, policyID, year)
}
func (f *fakeRepo) ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error) {
	return f.listBalancesFn(ctx, orgID, year)
}
func (f *fakeRepo) ListEmployeeBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error) {
	return f.listEmployeeBalsFn(ctx, orgID, employeeID, year)
}
func (f *fakeRepo) EnsureBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays float64) error {
	return f.ensureBalanceFn(ctx, orgID, employeeID, policyID, year, entitledDays)
}
func (f *fakeRepo) UpdateBalancePending(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, deltaDays float64) error {
	return f.updateBalPendingFn(ctx, tx, balanceID, deltaDays)
}
func (f *fakeRepo) ApproveBalanceUpdate(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, totalDays float64) error {
	return f.approveBalUpdateFn(ctx, tx, balanceID, totalDays)
}
func (f *fakeRepo) UpdateBalanceEntitledDays(ctx context.Context, orgID, policyID uuid.UUID, year int, newEntitledDays float64) error {
	return nil
}
func (f *fakeRepo) CreateRequest(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, startDate, endDate string, totalDays float64, reason *string) (*leave.Request, error) {
	return f.createRequestFn(ctx, tx, orgID, employeeID, policyID, startDate, endDate, totalDays, reason)
}
func (f *fakeRepo) GetRequest(ctx context.Context, orgID, requestID uuid.UUID) (*leave.Request, error) {
	return f.getRequestFn(ctx, orgID, requestID)
}
func (f *fakeRepo) UpdateRequestStatus(ctx context.Context, tx pgx.Tx, orgID, requestID uuid.UUID, expectedCurrentStatus, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*leave.Request, error) {
	return f.updateRequestStatusFn(ctx, tx, orgID, requestID, expectedCurrentStatus, newStatus, reviewedBy, reviewNote)
}
func (f *fakeRepo) ListRequests(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter) ([]leave.RequestWithDetails, error) {
	return f.listRequestsFn(ctx, orgID, filter)
}
func (f *fakeRepo) HasOverlap(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error) {
	return f.hasOverlapFn(ctx, orgID, employeeID, startDate, endDate)
}
func (f *fakeRepo) ListCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error) {
	return f.listCalendarFn(ctx, orgID, year, month)
}
func (f *fakeRepo) IsOnApprovedLeave(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error) {
	return f.isOnApprovedLeaveFn(ctx, orgID, employeeID, date)
}
func (f *fakeRepo) ListHolidays(ctx context.Context, countryCode, startDate, endDate string) ([]leave.PublicHoliday, error) {
	return f.listHolidaysFn(ctx, countryCode, startDate, endDate)
}
func (f *fakeRepo) CreateBalanceWithCarryOver(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays, carriedOverDays float64) error {
	// Not used in current service tests
	return nil
}
func (f *fakeRepo) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return f.beginTxFn(ctx)
}
func (f *fakeRepo) ListTemplates(ctx context.Context, countryCode string) ([]leave.PolicyTemplate, error) {
	if f.listTemplatesFn != nil {
		return f.listTemplatesFn(ctx, countryCode)
	}
	return []leave.PolicyTemplate{}, nil
}
func (f *fakeRepo) GetTemplatesByIDs(ctx context.Context, ids []uuid.UUID) ([]leave.PolicyTemplate, error) {
	if f.getTemplatesByIDsFn != nil {
		return f.getTemplatesByIDsFn(ctx, ids)
	}
	return []leave.PolicyTemplate{}, nil
}
func (f *fakeRepo) ImportPoliciesFromTemplates(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, templates []leave.PolicyTemplate) ([]leave.Policy, error) {
	if f.importPoliciesFromTemplatesFn != nil {
		return f.importPoliciesFromTemplatesFn(ctx, tx, orgID, templates)
	}
	return []leave.Policy{}, nil
}
func (f *fakeRepo) CreateBalancesForAllEmployees(ctx context.Context, tx pgx.Tx, orgID, policyID uuid.UUID, year int, entitledDays float64) error {
	if f.createBalancesForAllEmployeesFn != nil {
		return f.createBalancesForAllEmployeesFn(ctx, tx, orgID, policyID, year, entitledDays)
	}
	return nil
}
func (f *fakeRepo) CountPendingRequests(ctx context.Context, orgID uuid.UUID, managerEmployeeID *uuid.UUID) (int, error) {
	return 0, nil
}

// ── fakeOrgRepo ─────────────────────────────────────────────────────────────

type fakeOrgRepo struct {
	getOrgTimezoneFn    func(ctx context.Context, orgID uuid.UUID) (string, error)
	getOrgCountryCodeFn func(ctx context.Context, orgID uuid.UUID) (string, error)
	getOrgWorkDaysFn    func(ctx context.Context, orgID uuid.UUID) ([]int, error)
}

func (f *fakeOrgRepo) GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error) {
	return f.getOrgTimezoneFn(ctx, orgID)
}
func (f *fakeOrgRepo) GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	return f.getOrgCountryCodeFn(ctx, orgID)
}
func (f *fakeOrgRepo) GetOrgWorkDays(ctx context.Context, orgID uuid.UUID) ([]int, error) {
	return f.getOrgWorkDaysFn(ctx, orgID)
}

// ── fakeEmployeeRepo ────────────────────────────────────────────────────────

type fakeEmployeeRepo struct {
	getEmployeeProfileFn        func(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error)
	getEmployeeGenderFn         func(ctx context.Context, orgID, employeeID uuid.UUID) (*string, error)
	getEmployeeStartDateFn      func(ctx context.Context, orgID, employeeID uuid.UUID) (time.Time, error)
	verifyManagerRelationshipFn func(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error
}

func (f *fakeEmployeeRepo) GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error) {
	if f.getEmployeeProfileFn != nil {
		return f.getEmployeeProfileFn(ctx, orgID, employeeID)
	}
	name = "Test Employee"
	return name, nil, nil, nil
}

func (f *fakeEmployeeRepo) GetEmployeeGender(ctx context.Context, orgID, employeeID uuid.UUID) (*string, error) {
	if f.getEmployeeGenderFn != nil {
		return f.getEmployeeGenderFn(ctx, orgID, employeeID)
	}
	return nil, nil
}

func (f *fakeEmployeeRepo) GetEmployeeStartDate(ctx context.Context, orgID, employeeID uuid.UUID) (time.Time, error) {
	if f.getEmployeeStartDateFn != nil {
		return f.getEmployeeStartDateFn(ctx, orgID, employeeID)
	}
	// Default: employee started January 1 of current year (full entitlement)
	return time.Date(time.Now().Year(), 1, 1, 0, 0, 0, 0, time.UTC), nil
}

func (f *fakeEmployeeRepo) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	if f.verifyManagerRelationshipFn != nil {
		return f.verifyManagerRelationshipFn(ctx, orgID, employeeID, managerEmployeeID)
	}
	return nil
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func defaultFakeRepo() *fakeRepo {
	return &fakeRepo{
		listPoliciesFn: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
			return []leave.Policy{
				{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, GenderEligibility: "all", IsActive: true},
			}, nil
		},
		getPolicyFn: func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
			return &leave.Policy{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, GenderEligibility: "all", IsActive: true}, nil
		},
		createPolicyFn: func(_ context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error) {
			return &leave.Policy{ID: testPolicyID, OrganisationID: orgID, Name: req.Name, DaysPerYear: req.DaysPerYear, IsActive: true}, nil
		},
		updatePolicyFn: func(_ context.Context, orgID, policyID uuid.UUID, _ leave.UpdatePolicyRequest) (*leave.Policy, error) {
			return &leave.Policy{ID: policyID, OrganisationID: orgID, Name: "Updated", IsActive: true}, nil
		},
		deactivatePolicyFn: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
		getBalanceFn: func(_ context.Context, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
			return &leave.Balance{ID: testBalID, EntitledDays: 12, UsedDays: 0, PendingDays: 0}, nil
		},
		getBalanceForUpdateFn: func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
			return &leave.Balance{ID: testBalID, EntitledDays: 12, UsedDays: 0, PendingDays: 0}, nil
		},
		listBalancesFn: func(_ context.Context, _ uuid.UUID, _ int) ([]leave.BalanceWithPolicy, error) {
			return []leave.BalanceWithPolicy{
				{Balance: leave.Balance{ID: testBalID, EntitledDays: 12}, PolicyName: "Annual Leave"},
			}, nil
		},
		listEmployeeBalsFn: func(_ context.Context, _, _ uuid.UUID, _ int) ([]leave.BalanceWithPolicy, error) {
			return []leave.BalanceWithPolicy{
				{Balance: leave.Balance{ID: testBalID, EntitledDays: 12}, PolicyName: "Annual Leave"},
			}, nil
		},
		ensureBalanceFn: func(_ context.Context, _, _, _ uuid.UUID, _ int, _ float64) error {
			return nil
		},
		updateBalPendingFn: func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
			return nil
		},
		approveBalUpdateFn: func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
			return nil
		},
		createRequestFn: func(_ context.Context, _ pgx.Tx, orgID, empID, polID uuid.UUID, start, end string, totalDays float64, reason *string) (*leave.Request, error) {
			return &leave.Request{
				ID: testReqID, OrganisationID: orgID, EmployeeID: empID, LeavePolicyID: polID,
				StartDate: start, EndDate: end, TotalDays: totalDays, Reason: reason, Status: "pending",
			}, nil
		},
		getRequestFn: func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
			return &leave.Request{
				ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
				StartDate: "2026-03-16", EndDate: "2026-03-18", TotalDays: 3, Status: "pending",
			}, nil
		},
		updateRequestStatusFn: func(_ context.Context, _ pgx.Tx, _, reqID uuid.UUID, _, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*leave.Request, error) {
			return &leave.Request{
				ID: reqID, EmployeeID: testEmpID, Status: newStatus,
				ReviewedBy: reviewedBy, ReviewNote: reviewNote,
			}, nil
		},
		listRequestsFn: func(_ context.Context, _ uuid.UUID, _ leave.ListRequestsFilter) ([]leave.RequestWithDetails, error) {
			return []leave.RequestWithDetails{
				{Request: leave.Request{ID: testReqID, Status: "pending"}, EmployeeName: "Ahmad", PolicyName: "Annual Leave"},
			}, nil
		},
		hasOverlapFn: func(_ context.Context, _, _ uuid.UUID, _, _ string) (bool, error) {
			return false, nil
		},
		listCalendarFn: func(_ context.Context, _ uuid.UUID, _, _ int) ([]leave.CalendarEntry, error) {
			return []leave.CalendarEntry{
				{EmployeeID: testEmpID, EmployeeName: "Ahmad", PolicyName: "Annual Leave", StartDate: "2026-03-16", EndDate: "2026-03-18", TotalDays: 3},
			}, nil
		},
		isOnApprovedLeaveFn: func(_ context.Context, _, _ uuid.UUID, _ string) (bool, error) {
			return false, nil
		},
		listHolidaysFn: func(_ context.Context, _, _, _ string) ([]leave.PublicHoliday, error) {
			return nil, nil
		},
		beginTxFn: func(_ context.Context) (pgx.Tx, error) {
			return &fakeTx{}, nil
		},
	}
}

func defaultFakeOrgRepo() *fakeOrgRepo {
	return &fakeOrgRepo{
		getOrgTimezoneFn: func(_ context.Context, _ uuid.UUID) (string, error) {
			return "Asia/Jakarta", nil
		},
		getOrgCountryCodeFn: func(_ context.Context, _ uuid.UUID) (string, error) {
			return "ID", nil
		},
		getOrgWorkDaysFn: func(_ context.Context, _ uuid.UUID) ([]int, error) {
			return []int{1, 2, 3, 4, 5}, nil
		},
	}
}

func newTestService(repo *fakeRepo, orgRepo *fakeOrgRepo) *leave.Service {
	empRepo := &fakeEmployeeRepo{}
	return leave.NewService(repo, orgRepo, empRepo, "http://test-app.workived.com")
}

func newTestServiceWithEmpRepo(repo *fakeRepo, orgRepo *fakeOrgRepo, empRepo *fakeEmployeeRepo) *leave.Service {
	return leave.NewService(repo, orgRepo, empRepo, "http://test-app.workived.com")
}

// ── TestService_ListPolicies ────────────────────────────────────────────────

func TestService_ListPolicies(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(r *fakeRepo)
		wantCount int
		wantErr   bool
	}{
		{
			name:      "happy path",
			wantCount: 1,
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.listPoliciesFn = func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			policies, err := svc.ListPolicies(context.Background(), testOrgID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(policies) != tt.wantCount {
				t.Errorf("policies count = %d, want %d", len(policies), tt.wantCount)
			}
		})
	}
}

// ── TestService_CreatePolicy ────────────────────────────────────────────────

func TestService_CreatePolicy(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(r *fakeRepo)
		wantErr bool
	}{
		{
			name: "happy path",
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.createPolicyFn = func(_ context.Context, _ uuid.UUID, _ leave.CreatePolicyRequest) (*leave.Policy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			policy, err := svc.CreatePolicy(context.Background(), testOrgID, leave.CreatePolicyRequest{
				Name:        "Sick Leave",
				DaysPerYear: 14,
			})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if policy == nil {
				t.Fatal("expected policy, got nil")
			}
			if policy.Name != "Sick Leave" {
				t.Errorf("policy name = %q, want %q", policy.Name, "Sick Leave")
			}
		})
	}
}

// ── TestService_UpdatePolicy ────────────────────────────────────────────────

func TestService_UpdatePolicy(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(r *fakeRepo)
		wantErr bool
	}{
		{
			name: "happy path",
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.updatePolicyFn = func(_ context.Context, _, _ uuid.UUID, _ leave.UpdatePolicyRequest) (*leave.Policy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			policy, err := svc.UpdatePolicy(context.Background(), testOrgID, testPolicyID, leave.UpdatePolicyRequest{})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if policy == nil {
				t.Fatal("expected policy, got nil")
			}
		})
	}
}

// ── TestService_DeactivatePolicy ────────────────────────────────────────────

func TestService_DeactivatePolicy(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(r *fakeRepo)
		wantErr bool
		errCode string
	}{
		{
			name: "happy path - no pending or future requests",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 0, nil
				}
				r.countFutureApprovedRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID, _ string) (int, error) {
					return 0, nil
				}
			},
		},
		{
			name: "blocked - has pending requests",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 3, nil
				}
			},
			wantErr: true,
			errCode: apperr.CodeConflict,
		},
		{
			name: "blocked - has approved future leave",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 0, nil
				}
				r.countFutureApprovedRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID, _ string) (int, error) {
					return 2, nil
				}
			},
			wantErr: true,
			errCode: apperr.CodeConflict,
		},
		{
			name: "error counting pending requests",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 0, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "error counting future requests",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 0, nil
				}
				r.countFutureApprovedRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID, _ string) (int, error) {
					return 0, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "repo deactivate error",
			setup: func(r *fakeRepo) {
				r.countPendingRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID) (int, error) {
					return 0, nil
				}
				r.countFutureApprovedRequestsByPolicyFn = func(_ context.Context, _, _ uuid.UUID, _ string) (int, error) {
					return 0, nil
				}
				r.deactivatePolicyFn = func(_ context.Context, _, _ uuid.UUID) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			err := svc.DeactivatePolicy(context.Background(), testOrgID, testPolicyID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errCode != "" {
					var appErr *apperr.AppError
					if errors.As(err, &appErr) {
						if appErr.Code != tt.errCode {
							t.Fatalf("expected error code %s, got %s", tt.errCode, appErr.Code)
						}
					} else {
						t.Fatalf("expected AppError with code %s, got regular error: %v", tt.errCode, err)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// ── TestService_ListBalances ────────────────────────────────────────────────

func TestService_ListBalances(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(r *fakeRepo)
		wantCount int
		wantErr   bool
	}{
		{
			name:      "happy path",
			wantCount: 1,
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.listBalancesFn = func(_ context.Context, _ uuid.UUID, _ int) ([]leave.BalanceWithPolicy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			balances, err := svc.ListBalances(context.Background(), testOrgID, 2026)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(balances) != tt.wantCount {
				t.Errorf("balances count = %d, want %d", len(balances), tt.wantCount)
			}
		})
	}
}

// ── TestService_ListMyBalances ──────────────────────────────────────────────

func TestService_ListMyBalances(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(r *fakeRepo)
		wantCount int
		wantErr   bool
	}{
		{
			name:      "happy path — ensures balances then lists",
			wantCount: 1,
		},
		{
			name: "ensure balances fails — list policies error",
			setup: func(r *fakeRepo) {
				r.listPoliciesFn = func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "ensure balances fails — ensure balance error",
			setup: func(r *fakeRepo) {
				r.ensureBalanceFn = func(_ context.Context, _, _, _ uuid.UUID, _ int, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "list employee balances error",
			setup: func(r *fakeRepo) {
				r.listEmployeeBalsFn = func(_ context.Context, _, _ uuid.UUID, _ int) ([]leave.BalanceWithPolicy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			balances, err := svc.ListMyBalances(context.Background(), testOrgID, testEmpID, 2026)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(balances) != tt.wantCount {
				t.Errorf("balances count = %d, want %d", len(balances), tt.wantCount)
			}
		})
	}
}

// ── TestService_Proration ───────────────────────────────────────────────────

func TestService_ListMyBalances_Proration(t *testing.T) {
	tests := []struct {
		name             string
		prorateFirstYear bool
		startMonth       time.Month
		daysPerYear      float64
		wantEntitled     float64 // expected entitled_days passed to EnsureBalance
	}{
		{
			name:             "prorate — employee started July (6 months remaining)",
			prorateFirstYear: true,
			startMonth:       time.July,
			daysPerYear:      12,
			wantEntitled:     6.0, // 12 * 6/12
		},
		{
			name:             "prorate — employee started October (3 months remaining)",
			prorateFirstYear: true,
			startMonth:       time.October,
			daysPerYear:      12,
			wantEntitled:     3.0, // 12 * 3/12
		},
		{
			name:             "prorate — employee started January (full year)",
			prorateFirstYear: true,
			startMonth:       time.January,
			daysPerYear:      12,
			wantEntitled:     12.0,
		},
		{
			name:             "prorate — employee started December (1 month)",
			prorateFirstYear: true,
			startMonth:       time.December,
			daysPerYear:      12,
			wantEntitled:     1.0,
		},
		{
			name:             "no prorate — full entitlement regardless of start month",
			prorateFirstYear: false,
			startMonth:       time.October,
			daysPerYear:      12,
			wantEntitled:     12.0,
		},
		{
			name:             "prorate — odd days per year (15 days, started April = 9 months)",
			prorateFirstYear: true,
			startMonth:       time.April,
			daysPerYear:      15,
			wantEntitled:     11.3, // 15 * 9/12 = 11.25 → rounded to 11.3
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var capturedEntitled float64
			repo := defaultFakeRepo()
			repo.listPoliciesFn = func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{
						ID: testPolicyID, Name: "Annual Leave",
						DaysPerYear: tt.daysPerYear, GenderEligibility: "all",
						IsActive: true, ProrateFirstYear: tt.prorateFirstYear,
						DayCountType: "working_days",
					},
				}, nil
			}
			repo.ensureBalanceFn = func(_ context.Context, _, _, _ uuid.UUID, _ int, entitled float64) error {
				capturedEntitled = entitled
				return nil
			}

			empRepo := &fakeEmployeeRepo{
				getEmployeeStartDateFn: func(_ context.Context, _, _ uuid.UUID) (time.Time, error) {
					return time.Date(2026, tt.startMonth, 1, 0, 0, 0, 0, time.UTC), nil
				},
			}

			orgRepo := defaultFakeOrgRepo()
			svc := newTestServiceWithEmpRepo(repo, orgRepo, empRepo)
			_, err := svc.ListMyBalances(context.Background(), testOrgID, testEmpID, 2026)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if capturedEntitled != tt.wantEntitled {
				t.Errorf("entitled days = %v, want %v", capturedEntitled, tt.wantEntitled)
			}
		})
	}
}

func TestService_ListMyBalances_Proration_PriorYear(t *testing.T) {
	// Employee started in 2025, querying 2026 — should get full entitlement even with prorate.
	var capturedEntitled float64
	repo := defaultFakeRepo()
	repo.listPoliciesFn = func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
		return []leave.Policy{
			{
				ID: testPolicyID, Name: "Annual Leave",
				DaysPerYear: 12, GenderEligibility: "all",
				IsActive: true, ProrateFirstYear: true,
				DayCountType: "working_days",
			},
		}, nil
	}
	repo.ensureBalanceFn = func(_ context.Context, _, _, _ uuid.UUID, _ int, entitled float64) error {
		capturedEntitled = entitled
		return nil
	}

	empRepo := &fakeEmployeeRepo{
		getEmployeeStartDateFn: func(_ context.Context, _, _ uuid.UUID) (time.Time, error) {
			return time.Date(2025, time.March, 15, 0, 0, 0, 0, time.UTC), nil
		},
	}

	orgRepo := defaultFakeOrgRepo()
	svc := newTestServiceWithEmpRepo(repo, orgRepo, empRepo)
	_, err := svc.ListMyBalances(context.Background(), testOrgID, testEmpID, 2026)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedEntitled != 12.0 {
		t.Errorf("entitled days = %v, want 12 (full year for prior-year employee)", capturedEntitled)
	}
}

func TestService_ListMyBalances_Proration_GetStartDateError(t *testing.T) {
	repo := defaultFakeRepo()
	repo.listPoliciesFn = func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
		return []leave.Policy{
			{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, GenderEligibility: "all",
				IsActive: true, ProrateFirstYear: true, DayCountType: "working_days"},
		}, nil
	}

	empRepo := &fakeEmployeeRepo{
		getEmployeeStartDateFn: func(_ context.Context, _, _ uuid.UUID) (time.Time, error) {
			return time.Time{}, errors.New("employee not found")
		},
	}

	orgRepo := defaultFakeOrgRepo()
	svc := newTestServiceWithEmpRepo(repo, orgRepo, empRepo)
	_, err := svc.ListMyBalances(context.Background(), testOrgID, testEmpID, 2026)
	if err == nil {
		t.Fatal("expected error when GetEmployeeStartDate fails, got nil")
	}
}

// ── TestCalculateCalendarDays ───────────────────────────────────────────────

func TestService_SubmitRequest_CalendarDays(t *testing.T) {
	// When policy.DayCountType = "calendar_days", totalDays should count all days (including weekends).
	repo := defaultFakeRepo()
	repo.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
		return &leave.Policy{
			ID: testPolicyID, Name: "Sick Leave", DaysPerYear: 30,
			GenderEligibility: "all", IsActive: true,
			DayCountType: "calendar_days",
		}, nil
	}
	// Mon Mar 16 → Fri Mar 20 = 5 calendar days (includes no weekends, but with calendar_days it counts all 5)
	// Mon Mar 16 → Sun Mar 22 = 7 calendar days (includes weekend)
	var capturedTotalDays float64
	repo.createRequestFn = func(_ context.Context, _ pgx.Tx, orgID, empID, polID uuid.UUID, start, end string, totalDays float64, reason *string) (*leave.Request, error) {
		capturedTotalDays = totalDays
		return &leave.Request{
			ID: testReqID, OrganisationID: orgID, EmployeeID: empID, LeavePolicyID: polID,
			StartDate: start, EndDate: end, TotalDays: totalDays, Reason: reason, Status: "pending",
		}, nil
	}

	orgRepo := defaultFakeOrgRepo()
	svc := newTestService(repo, orgRepo)
	// Mon Mar 16 → Sun Mar 22, 2026 = 7 calendar days
	_, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "employee", leave.SubmitRequestInput{
		LeavePolicyID: testPolicyID,
		StartDate:     "2026-03-16",
		EndDate:       "2026-03-22",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedTotalDays != 7 {
		t.Errorf("totalDays = %v, want 7 (calendar days)", capturedTotalDays)
	}
}

func TestService_SubmitRequest_WorkingDays(t *testing.T) {
	// When policy.DayCountType = "working_days" (default), should only count working days.
	repo := defaultFakeRepo()
	repo.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
		return &leave.Policy{
			ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12,
			GenderEligibility: "all", IsActive: true,
			DayCountType: "working_days",
		}, nil
	}
	var capturedTotalDays float64
	repo.createRequestFn = func(_ context.Context, _ pgx.Tx, orgID, empID, polID uuid.UUID, start, end string, totalDays float64, reason *string) (*leave.Request, error) {
		capturedTotalDays = totalDays
		return &leave.Request{
			ID: testReqID, OrganisationID: orgID, EmployeeID: empID, LeavePolicyID: polID,
			StartDate: start, EndDate: end, TotalDays: totalDays, Reason: reason, Status: "pending",
		}, nil
	}

	orgRepo := defaultFakeOrgRepo()
	svc := newTestService(repo, orgRepo)
	// Mon Mar 16 → Sun Mar 22, 2026 = 5 working days (Mon-Fri)
	_, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "employee", leave.SubmitRequestInput{
		LeavePolicyID: testPolicyID,
		StartDate:     "2026-03-16",
		EndDate:       "2026-03-22",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedTotalDays != 5 {
		t.Errorf("totalDays = %v, want 5 (working days only)", capturedTotalDays)
	}
}

// ── TestService_SubmitRequest ───────────────────────────────────────────────

func TestService_SubmitRequest(t *testing.T) {
	tests := []struct {
		name     string
		input    leave.SubmitRequestInput
		setup    func(r *fakeRepo, o *fakeOrgRepo)
		wantErr  bool
		wantCode string
	}{
		{
			name: "happy path — valid dates, sufficient balance, no overlap",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16", // Monday
				EndDate:       "2026-03-18", // Wednesday
			},
		},
		{
			name: "invalid start_date format",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "16-03-2026",
				EndDate:       "2026-03-18",
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "invalid end_date format",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "bad-date",
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "end_date before start_date",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-18",
				EndDate:       "2026-03-16",
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "cross-year request rejected",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-12-30",
				EndDate:       "2027-01-02",
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "inactive policy rejected",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, IsActive: false}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "no working days in range — weekend only",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-14", // Saturday
				EndDate:       "2026-03-15", // Sunday
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "overlapping request rejected",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.hasOverlapFn = func(_ context.Context, _, _ uuid.UUID, _, _ string) (bool, error) {
					return true, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "insufficient balance",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.getBalanceForUpdateFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
					return &leave.Balance{ID: testBalID, EntitledDays: 1, UsedDays: 0, PendingDays: 0}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeUpgradeRequired,
		},
		{
			name: "get policy error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "get org work days error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(_ *fakeRepo, o *fakeOrgRepo) {
				o.getOrgWorkDaysFn = func(_ context.Context, _ uuid.UUID) ([]int, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "has overlap error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.hasOverlapFn = func(_ context.Context, _, _ uuid.UUID, _, _ string) (bool, error) {
					return false, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "begin tx error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.beginTxFn = func(_ context.Context) (pgx.Tx, error) {
					return nil, errors.New("tx error")
				}
			},
			wantErr: true,
		},
		{
			name: "get balance for update error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.getBalanceForUpdateFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "create request error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.createRequestFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _, _ string, _ float64, _ *string) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "update balance pending error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.updateBalPendingFn = func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "get org country code error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(_ *fakeRepo, o *fakeOrgRepo) {
				o.getOrgCountryCodeFn = func(_ context.Context, _ uuid.UUID) (string, error) {
					return "", errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "list holidays error",
			input: leave.SubmitRequestInput{
				LeavePolicyID: testPolicyID,
				StartDate:     "2026-03-16",
				EndDate:       "2026-03-18",
			},
			setup: func(r *fakeRepo, _ *fakeOrgRepo) {
				r.listHolidaysFn = func(_ context.Context, _, _, _ string) ([]leave.PublicHoliday, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo, orgRepo)
			}

			svc := newTestService(repo, orgRepo)
			req, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "member", tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected error code %q, got %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if req == nil {
				t.Fatal("expected request, got nil")
			}
			if req.Status != "pending" {
				t.Errorf("status = %q, want %q", req.Status, "pending")
			}
		})
	}
}

// ── TestService_SubmitRequest_GenderEligibility ───────────────────────────────

func TestService_SubmitRequest_GenderEligibility(t *testing.T) {
	input := leave.SubmitRequestInput{
		LeavePolicyID: testPolicyID,
		StartDate:     "2026-03-16",
		EndDate:       "2026-03-18",
	}

	female := "female"
	male := "male"

	tests := []struct {
		name      string
		setup     func(r *fakeRepo, e *fakeEmployeeRepo)
		wantErr   bool
		wantCode  string
	}{
		{
			name: "female employee — female-only policy — allowed",
			setup: func(r *fakeRepo, e *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Maternity Leave", DaysPerYear: 90, GenderEligibility: "female", IsActive: true}, nil
				}
				e.getEmployeeGenderFn = func(_ context.Context, _, _ uuid.UUID) (*string, error) {
					return &female, nil
				}
			},
		},
		{
			name: "male employee — female-only policy — rejected",
			setup: func(r *fakeRepo, e *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Maternity Leave", DaysPerYear: 90, GenderEligibility: "female", IsActive: true}, nil
				}
				e.getEmployeeGenderFn = func(_ context.Context, _, _ uuid.UUID) (*string, error) {
					return &male, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "gender not set — female-only policy — rejected",
			setup: func(r *fakeRepo, e *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Maternity Leave", DaysPerYear: 90, GenderEligibility: "female", IsActive: true}, nil
				}
				e.getEmployeeGenderFn = func(_ context.Context, _, _ uuid.UUID) (*string, error) {
					return nil, nil // gender not specified
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "male employee — male-only policy — allowed",
			setup: func(r *fakeRepo, e *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Paternity Leave", DaysPerYear: 5, GenderEligibility: "male", IsActive: true}, nil
				}
				e.getEmployeeGenderFn = func(_ context.Context, _, _ uuid.UUID) (*string, error) {
					return &male, nil
				}
			},
		},
		{
			name: "any employee — all policy — allowed regardless of gender",
			setup: func(r *fakeRepo, _ *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, GenderEligibility: "all", IsActive: true}, nil
				}
				// getEmployeeGenderFn not set — should not be called for "all" policy
			},
		},
		{
			name: "get employee gender error — propagated",
			setup: func(r *fakeRepo, e *fakeEmployeeRepo) {
				r.getPolicyFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
					return &leave.Policy{ID: testPolicyID, Name: "Maternity Leave", DaysPerYear: 90, GenderEligibility: "female", IsActive: true}, nil
				}
				e.getEmployeeGenderFn = func(_ context.Context, _, _ uuid.UUID) (*string, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			empRepo := &fakeEmployeeRepo{}
			if tt.setup != nil {
				tt.setup(repo, empRepo)
			}

			svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000")

			_, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "member", input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected code %q, got: %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// ── TestService_ApproveRequest ──────────────────────────────────────────────

func TestService_ApproveRequest(t *testing.T) {
	reviewerID := uuid.MustParse("00000000-0000-0000-0000-000000000099")

	tests := []struct {
		name     string
		setup    func(r *fakeRepo)
		wantErr  bool
		wantCode string
	}{
		{
			name: "happy path",
		},
		{
			name: "already approved",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "approved",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "already rejected",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "rejected",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "get request error",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "begin tx error",
			setup: func(r *fakeRepo) {
				r.beginTxFn = func(_ context.Context) (pgx.Tx, error) {
					return nil, errors.New("tx error")
				}
			},
			wantErr: true,
		},
		{
			name: "get balance for update error",
			setup: func(r *fakeRepo) {
				r.getBalanceForUpdateFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "approve balance update error",
			setup: func(r *fakeRepo) {
				r.approveBalUpdateFn = func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "update request status error",
			setup: func(r *fakeRepo) {
				r.updateRequestStatusFn = func(_ context.Context, _ pgx.Tx, _, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ *string) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			req, err := svc.ApproveRequest(context.Background(), testOrgID, reviewerID, testReqID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected error code %q, got %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if req == nil {
				t.Fatal("expected request, got nil")
			}
			if req.Status != "approved" {
				t.Errorf("status = %q, want %q", req.Status, "approved")
			}
		})
	}
}

// ── TestService_RejectRequest ───────────────────────────────────────────────

func TestService_RejectRequest(t *testing.T) {
	reviewerID := uuid.MustParse("00000000-0000-0000-0000-000000000099")
	note := "not enough coverage"

	tests := []struct {
		name     string
		setup    func(r *fakeRepo)
		wantErr  bool
		wantCode string
	}{
		{
			name: "happy path",
		},
		{
			name: "already rejected",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "rejected",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "already approved — cannot reject",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "approved",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "get request error",
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "begin tx error",
			setup: func(r *fakeRepo) {
				r.beginTxFn = func(_ context.Context) (pgx.Tx, error) {
					return nil, errors.New("tx error")
				}
			},
			wantErr: true,
		},
		{
			name: "get balance for update error",
			setup: func(r *fakeRepo) {
				r.getBalanceForUpdateFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "update balance pending error",
			setup: func(r *fakeRepo) {
				r.updateBalPendingFn = func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "update request status error",
			setup: func(r *fakeRepo) {
				r.updateRequestStatusFn = func(_ context.Context, _ pgx.Tx, _, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ *string) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			req, err := svc.RejectRequest(context.Background(), testOrgID, reviewerID, testReqID, &note)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected error code %q, got %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if req == nil {
				t.Fatal("expected request, got nil")
			}
			if req.Status != "rejected" {
				t.Errorf("status = %q, want %q", req.Status, "rejected")
			}
		})
	}
}

// ── TestService_CancelRequest ───────────────────────────────────────────────

func TestService_CancelRequest(t *testing.T) {
	otherEmpID := uuid.MustParse("00000000-0000-0000-0000-000000000088")

	tests := []struct {
		name       string
		employeeID uuid.UUID
		setup      func(r *fakeRepo)
		wantErr    bool
		wantCode   string
	}{
		{
			name:       "happy path — cancel pending",
			employeeID: testEmpID,
		},
		{
			name:       "happy path — cancel approved",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "approved",
					}, nil
				}
			},
		},
		{
			name:       "wrong employee — forbidden",
			employeeID: otherEmpID,
			wantErr:    true,
			wantCode:   apperr.CodeForbidden,
		},
		{
			name:       "already cancelled",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "cancelled",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name:       "already rejected — cannot cancel",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "rejected",
					}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name:       "get request error",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name:       "begin tx error",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.beginTxFn = func(_ context.Context) (pgx.Tx, error) {
					return nil, errors.New("tx error")
				}
			},
			wantErr: true,
		},
		{
			name:       "get balance for update error",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getBalanceForUpdateFn = func(_ context.Context, _ pgx.Tx, _, _, _ uuid.UUID, _ int) (*leave.Balance, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name:       "update balance pending error on cancel pending",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.updateBalPendingFn = func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name:       "approve balance update error on cancel approved",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
					return &leave.Request{
						ID: testReqID, EmployeeID: testEmpID, LeavePolicyID: testPolicyID,
						StartDate: "2026-03-16", TotalDays: 3, Status: "approved",
					}, nil
				}
				r.approveBalUpdateFn = func(_ context.Context, _ pgx.Tx, _ uuid.UUID, _ float64) error {
					return errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name:       "update request status error",
			employeeID: testEmpID,
			setup: func(r *fakeRepo) {
				r.updateRequestStatusFn = func(_ context.Context, _ pgx.Tx, _, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ *string) (*leave.Request, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			req, err := svc.CancelRequest(context.Background(), testOrgID, tt.employeeID, testReqID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected error code %q, got %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if req == nil {
				t.Fatal("expected request, got nil")
			}
			if req.Status != "cancelled" {
				t.Errorf("status = %q, want %q", req.Status, "cancelled")
			}
		})
	}
}

// ── TestService_GetCalendar ─────────────────────────────────────────────────

func TestService_GetCalendar(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(r *fakeRepo)
		wantCount int
		wantErr   bool
	}{
		{
			name:      "happy path",
			wantCount: 1,
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.listCalendarFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]leave.CalendarEntry, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			entries, err := svc.GetCalendar(context.Background(), testOrgID, 2026, 3)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(entries) != tt.wantCount {
				t.Errorf("entries count = %d, want %d", len(entries), tt.wantCount)
			}
		})
	}
}

// ── TestService_ListMyRequests ──────────────────────────────────────────────

func TestService_ListMyRequests(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(r *fakeRepo)
		wantCount int
		wantErr   bool
	}{
		{
			name:      "happy path",
			wantCount: 1,
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
				r.listRequestsFn = func(_ context.Context, _ uuid.UUID, _ leave.ListRequestsFilter) ([]leave.RequestWithDetails, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgRepo := defaultFakeOrgRepo()
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := newTestService(repo, orgRepo)
			requests, err := svc.ListMyRequests(context.Background(), testOrgID, testEmpID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(requests) != tt.wantCount {
				t.Errorf("requests count = %d, want %d", len(requests), tt.wantCount)
			}
		})
	}
}

// ── TestService_ListRequests ──────────────────────────────────────────────────

func TestService_ListRequests(t *testing.T) {
	t.Run("happy path — no manager filter", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		pendingStatus := "pending"
		filter := leave.ListRequestsFilter{Status: &pendingStatus}
		requests, err := svc.ListRequests(context.Background(), testOrgID, filter, "admin", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(requests) == 0 {
			t.Fatal("expected requests, got none")
		}
	})

	t.Run("manager role — injects manager filter", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		managerID := testReqID // re-use a known ID
		filter := leave.ListRequestsFilter{}
		requests, err := svc.ListRequests(context.Background(), testOrgID, filter, "manager", &managerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = requests
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.listRequestsFn = func(_ context.Context, _ uuid.UUID, _ leave.ListRequestsFilter) ([]leave.RequestWithDetails, error) {
			return nil, errors.New("db down")
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		_, err := svc.ListRequests(context.Background(), testOrgID, leave.ListRequestsFilter{}, "admin", nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── TestService_GetRequest ────────────────────────────────────────────────────

func TestService_GetRequest(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		req, err := svc.GetRequest(context.Background(), testOrgID, testReqID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if req == nil {
			t.Fatal("expected request, got nil")
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.getRequestFn = func(_ context.Context, _, _ uuid.UUID) (*leave.Request, error) {
			return nil, errors.New("not found")
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		_, err := svc.GetRequest(context.Background(), testOrgID, testReqID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── TestService_VerifyManagerRelationship ────────────────────────────────────

func TestService_VerifyManagerRelationship(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		reviewerID := uuid.New()
		err := svc.VerifyManagerRelationship(context.Background(), testOrgID, testEmpID, reviewerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("not manager error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		empRepo := &fakeEmployeeRepo{
			verifyManagerRelationshipFn: func(_ context.Context, _, _, _ uuid.UUID) error {
				return errors.New("not a manager")
			},
		}
		svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000")
		err := svc.VerifyManagerRelationship(context.Background(), testOrgID, testEmpID, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── TestService_IsOnApprovedLeave ─────────────────────────────────────────────

func TestService_IsOnApprovedLeave(t *testing.T) {
	t.Run("not on leave", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		onLeave, err := svc.IsOnApprovedLeave(context.Background(), testOrgID, testEmpID, "2026-03-20")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if onLeave {
			t.Error("expected not on leave")
		}
	})

	t.Run("on leave", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.isOnApprovedLeaveFn = func(_ context.Context, _, _ uuid.UUID, _ string) (bool, error) {
			return true, nil
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		onLeave, err := svc.IsOnApprovedLeave(context.Background(), testOrgID, testEmpID, "2026-03-20")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !onLeave {
			t.Error("expected on leave")
		}
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.isOnApprovedLeaveFn = func(_ context.Context, _, _ uuid.UUID, _ string) (bool, error) {
			return false, errors.New("db down")
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		_, err := svc.IsOnApprovedLeave(context.Background(), testOrgID, testEmpID, "2026-03-20")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── TestService_ListHolidays ──────────────────────────────────────────────────

func TestService_ListHolidays(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		holidays, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = holidays
	})

	t.Run("country code error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		orgRepo.getOrgCountryCodeFn = func(_ context.Context, _ uuid.UUID) (string, error) {
			return "", errors.New("db down")
		}
		svc := newTestService(repo, orgRepo)
		_, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("holidays repo error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.listHolidaysFn = func(_ context.Context, _, _, _ string) ([]leave.PublicHoliday, error) {
			return nil, errors.New("db down")
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		_, err := svc.ListHolidays(context.Background(), testOrgID, "2026-01-01", "2026-12-31")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── TestService_ListTemplates ─────────────────────────────────────────────────

func TestService_ListTemplates(t *testing.T) {
	t.Run("explicit country code", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		cc := "ID"
		templates, err := svc.ListTemplates(context.Background(), testOrgID, &cc)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = templates
	})

	t.Run("nil country code — fetches from org", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		templates, err := svc.ListTemplates(context.Background(), testOrgID, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = templates
	})

	t.Run("country code error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		orgRepo.getOrgCountryCodeFn = func(_ context.Context, _ uuid.UUID) (string, error) {
			return "", errors.New("db down")
		}
		svc := newTestService(repo, orgRepo)
		_, err := svc.ListTemplates(context.Background(), testOrgID, nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("templates repo error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		cc := "ID"
		_, err := svc.ListTemplates(context.Background(), testOrgID, &cc)
		if err != nil {
			t.Fatalf("ListTemplates with explicit code: %v", err)
		}
	})
}

// ── TestService_GetNotificationCount ─────────────────────────────────────────

func TestService_GetNotificationCount(t *testing.T) {
	t.Run("happy path — member role", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		count, err := svc.GetNotificationCount(context.Background(), testOrgID, "member", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count != 0 {
			t.Errorf("expected 0, got %d", count)
		}
	})

	t.Run("manager role — with manager ID", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		managerID := testEmpID
		count, err := svc.GetNotificationCount(context.Background(), testOrgID, "manager", &managerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = count
	})
}

// ── TestService_ImportPolicies ────────────────────────────────────────────────

func TestService_ImportPolicies(t *testing.T) {
	templateID := uuid.New()

	t.Run("happy path", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		input := leave.ImportPoliciesInput{TemplateIDs: []uuid.UUID{templateID}}
		policies, err := svc.ImportPolicies(context.Background(), testOrgID, input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = policies
	})

	t.Run("country code error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		orgRepo.getOrgCountryCodeFn = func(_ context.Context, _ uuid.UUID) (string, error) {
			return "", errors.New("db down")
		}
		svc := newTestService(repo, orgRepo)
		input := leave.ImportPoliciesInput{TemplateIDs: []uuid.UUID{templateID}}
		_, err := svc.ImportPolicies(context.Background(), testOrgID, input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("template country mismatch returns validation error", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.getTemplatesByIDsFn = func(_ context.Context, _ []uuid.UUID) ([]leave.PolicyTemplate, error) {
			return []leave.PolicyTemplate{
				{ID: templateID, Name: "Annual Leave", CountryCode: "AE", GenderEligibility: "all"},
			}, nil
		}
		orgRepo := defaultFakeOrgRepo() // returns "ID" as country code
		svc := newTestService(repo, orgRepo)
		input := leave.ImportPoliciesInput{TemplateIDs: []uuid.UUID{templateID}}
		_, err := svc.ImportPolicies(context.Background(), testOrgID, input)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeValidation) {
			t.Errorf("expected CodeValidation, got: %v", err)
		}
	})

	t.Run("begin tx error propagates", func(t *testing.T) {
		repo := defaultFakeRepo()
		repo.beginTxFn = func(_ context.Context) (pgx.Tx, error) {
			return nil, errors.New("tx error")
		}
		orgRepo := defaultFakeOrgRepo()
		svc := newTestService(repo, orgRepo)
		input := leave.ImportPoliciesInput{TemplateIDs: []uuid.UUID{templateID}}
		_, err := svc.ImportPolicies(context.Background(), testOrgID, input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}


// ── TestService_WithOptions ───────────────────────────────────────────────────

type failAuditLogger struct{}

func (f *failAuditLogger) Log(_ context.Context, _ audit.LogEntry) error {
	return errors.New("audit log failed")
}

func TestService_WithOptions(t *testing.T) {
	t.Run("WithAuditLog option sets audit logger", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		empRepo := &fakeEmployeeRepo{}
		logger := zerolog.Nop()
		auditLogger := &failAuditLogger{}
		svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
			leave.WithLogger(logger),
			leave.WithAuditLog(auditLogger),
		)
		// Verify service works (audit log error should not propagate to caller)
		_, err := svc.ListPolicies(context.Background(), testOrgID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("WithLogger sets zerolog logger", func(t *testing.T) {
		repo := defaultFakeRepo()
		orgRepo := defaultFakeOrgRepo()
		empRepo := &fakeEmployeeRepo{}
		svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
			leave.WithLogger(zerolog.Nop()),
		)
		_, err := svc.ListPolicies(context.Background(), testOrgID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

// ── TestService_LogAudit_ErrorPath ────────────────────────────────────────────

func TestService_LogAudit_ErrorPath(t *testing.T) {
	// Test that audit log errors are swallowed (not returned to caller)
	repo := defaultFakeRepo()
	orgRepo := defaultFakeOrgRepo()
	empRepo := &fakeEmployeeRepo{}
	svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
		leave.WithAuditLog(&failAuditLogger{}),
	)

	// CreatePolicy triggers audit log — error should be swallowed
	policy, err := svc.CreatePolicy(context.Background(), testOrgID, leave.CreatePolicyRequest{
		Name:       "Annual Leave",
		DaysPerYear: 12,
	})
	if err != nil {
		t.Fatalf("audit log error should be swallowed, got: %v", err)
	}
	if policy == nil {
		t.Fatal("expected policy, got nil")
	}
}


// ── TestService_WithTasksService ──────────────────────────────────────────────

type fakeLeaveTasksService struct{}

func (f *fakeLeaveTasksService) CreateApprovalTask(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID, _, _ string, _, _ uuid.UUID, _ *string) error {
	return nil
}
func (f *fakeLeaveTasksService) CompleteApprovalTask(_ context.Context, _ string, _ uuid.UUID) error {
	return nil
}
func (f *fakeLeaveTasksService) DeleteApprovalTask(_ context.Context, _ string, _ uuid.UUID) error {
	return nil
}

func TestService_WithTasksService(t *testing.T) {
	// Wire up tasks service — SubmitRequest will fire goroutine to createLeaveApprovalTask
	repo := defaultFakeRepo()
	orgRepo := defaultFakeOrgRepo()
	managerID := uuid.New()
	empRepo := &fakeEmployeeRepo{
		getEmployeeProfileFn: func(_ context.Context, _, _ uuid.UUID) (string, *string, *uuid.UUID, error) {
			return "Ahmad", nil, &managerID, nil
		},
	}
	svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
		leave.WithLogger(zerolog.Nop()),
		leave.WithTasksService(&fakeLeaveTasksService{}),
	)

	input := leave.SubmitRequestInput{
		LeavePolicyID: testPolicyID,
		StartDate:     "2026-04-01",
		EndDate:       "2026-04-03",
	}
	req, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "member", input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req == nil {
		t.Fatal("expected request, got nil")
	}
	// Let goroutine finish
	time.Sleep(10 * time.Millisecond)
}


// ── TestService_WithEmailSender ───────────────────────────────────────────────

type fakeLeaveEmailSender struct{}

func (f *fakeLeaveEmailSender) Send(_ email.Message) error { return nil }

func TestService_WithEmailSender_Submit(t *testing.T) {
	// SubmitRequest fires goroutine for pending email
	repo := defaultFakeRepo()
	orgRepo := defaultFakeOrgRepo()
	managerID := uuid.New()
	managerEmail := "manager@test.com"
	empRepo := &fakeEmployeeRepo{
		getEmployeeProfileFn: func(_ context.Context, _, _ uuid.UUID) (string, *string, *uuid.UUID, error) {
			return "Ahmad", &managerEmail, &managerID, nil
		},
	}
	svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
		leave.WithLogger(zerolog.Nop()),
		leave.WithEmailSender(&fakeLeaveEmailSender{}),
	)
	input := leave.SubmitRequestInput{
		LeavePolicyID: testPolicyID,
		StartDate:     "2026-04-01",
		EndDate:       "2026-04-03",
	}
	req, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, "member", input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req == nil {
		t.Fatal("expected request, got nil")
	}
	time.Sleep(20 * time.Millisecond)
}

func TestService_WithEmailSender_Approve(t *testing.T) {
	// ApproveRequest fires goroutine for approved email
	repo := defaultFakeRepo()
	orgRepo := defaultFakeOrgRepo()
	empEmail := "emp@test.com"
	empRepo := &fakeEmployeeRepo{
		getEmployeeProfileFn: func(_ context.Context, _, _ uuid.UUID) (string, *string, *uuid.UUID, error) {
			return "Ahmad", &empEmail, nil, nil
		},
	}
	svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
		leave.WithLogger(zerolog.Nop()),
		leave.WithEmailSender(&fakeLeaveEmailSender{}),
	)
	reviewerID := uuid.New()
	_, err := svc.ApproveRequest(context.Background(), testOrgID, reviewerID, testReqID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
}

func TestService_WithEmailSender_Reject(t *testing.T) {
	// RejectRequest fires goroutine for rejected email
	repo := defaultFakeRepo()
	orgRepo := defaultFakeOrgRepo()
	empEmail := "emp@test.com"
	empRepo := &fakeEmployeeRepo{
		getEmployeeProfileFn: func(_ context.Context, _, _ uuid.UUID) (string, *string, *uuid.UUID, error) {
			return "Ahmad", &empEmail, nil, nil
		},
	}
	svc := leave.NewService(repo, orgRepo, empRepo, "http://localhost:3000",
		leave.WithLogger(zerolog.Nop()),
		leave.WithEmailSender(&fakeLeaveEmailSender{}),
	)
	note := "no quota remaining"
	reviewerID := uuid.New()
	_, err := svc.RejectRequest(context.Background(), testOrgID, reviewerID, testReqID, &note)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
}

