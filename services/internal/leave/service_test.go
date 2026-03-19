package leave_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/workived/services/internal/leave"
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
	listPoliciesFn        func(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error)
	getPolicyFn           func(ctx context.Context, orgID, policyID uuid.UUID) (*leave.Policy, error)
	createPolicyFn        func(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error)
	updatePolicyFn        func(ctx context.Context, orgID, policyID uuid.UUID, req leave.UpdatePolicyRequest) (*leave.Policy, error)
	deactivatePolicyFn    func(ctx context.Context, orgID, policyID uuid.UUID) error
	getBalanceFn          func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error)
	getBalanceForUpdateFn func(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, year int) (*leave.Balance, error)
	listBalancesFn        func(ctx context.Context, orgID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	listEmployeeBalsFn    func(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	ensureBalanceFn       func(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays float64) error
	updateBalPendingFn    func(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, deltaDays float64) error
	approveBalUpdateFn    func(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, totalDays float64) error
	createRequestFn       func(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, startDate, endDate string, totalDays float64, reason *string) (*leave.Request, error)
	getRequestFn          func(ctx context.Context, orgID, requestID uuid.UUID) (*leave.Request, error)
	updateRequestStatusFn func(ctx context.Context, tx pgx.Tx, orgID, requestID uuid.UUID, expectedCurrentStatus, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*leave.Request, error)
	listRequestsFn        func(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter) ([]leave.RequestWithDetails, error)
	hasOverlapFn          func(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error)
	listCalendarFn        func(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error)
	isOnApprovedLeaveFn   func(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error)
	listHolidaysFn        func(ctx context.Context, countryCode, startDate, endDate string) ([]leave.PublicHoliday, error)
	beginTxFn             func(ctx context.Context) (pgx.Tx, error)
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
func (f *fakeRepo) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return f.beginTxFn(ctx)
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

// ── Helpers ─────────────────────────────────────────────────────────────────

func defaultFakeRepo() *fakeRepo {
	return &fakeRepo{
		listPoliciesFn: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
			return []leave.Policy{
				{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, IsActive: true},
			}, nil
		},
		getPolicyFn: func(_ context.Context, _, _ uuid.UUID) (*leave.Policy, error) {
			return &leave.Policy{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12, IsActive: true}, nil
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
	return leave.NewService(repo, orgRepo)
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
	}{
		{
			name: "happy path",
		},
		{
			name: "repo error",
			setup: func(r *fakeRepo) {
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
			wantCode: apperr.CodeInsufficientBalance,
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
			req, err := svc.SubmitRequest(context.Background(), testOrgID, testEmpID, tt.input)

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
