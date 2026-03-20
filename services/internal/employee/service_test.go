package employee_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/pkg/apperr"
)

// ── Fakes ─────────────────────────────────────────────────────────────────────

type fakeOrgRepo struct {
	plan    string
	limit   *int
	planErr error
}

func (f *fakeOrgRepo) GetOrgPlanInfo(_ context.Context, _ uuid.UUID) (string, *int, error) {
	if f.planErr != nil {
		return "", nil, f.planErr
	}
	return f.plan, f.limit, nil
}

type fakeEmpRepo struct {
	employees      map[uuid.UUID]*employee.Employee
	count          int
	listErr        error
	countActiveErr error
}

func newFakeEmpRepo() *fakeEmpRepo {
	return &fakeEmpRepo{employees: make(map[uuid.UUID]*employee.Employee)}
}

func (f *fakeEmpRepo) CountActive(_ context.Context, _ uuid.UUID) (int, error) {
	if f.countActiveErr != nil {
		return 0, f.countActiveErr
	}
	return f.count, nil
}

func (f *fakeEmpRepo) Create(_ context.Context, orgID uuid.UUID, req employee.CreateEmployeeRequest) (*employee.Employee, error) {
	emp := &employee.Employee{
		ID:             uuid.New(),
		OrganisationID: orgID,
		UserID:         req.UserID,
		FullName:       req.FullName,
		Email:          req.Email,
		EmploymentType: req.EmploymentType,
		Status:         "active",
		IsActive:       true,
	}
	f.employees[emp.ID] = emp
	f.count++
	return emp, nil
}

func (f *fakeEmpRepo) GetByID(_ context.Context, orgID, id uuid.UUID) (*employee.Employee, error) {
	e, ok := f.employees[id]
	if !ok || e.OrganisationID != orgID {
		return nil, apperr.NotFound("employee")
	}
	return e, nil
}

func (f *fakeEmpRepo) GetByUserID(_ context.Context, orgID, userID uuid.UUID) (*employee.Employee, error) {
	for _, e := range f.employees {
		if e.OrganisationID == orgID && e.UserID != nil && *e.UserID == userID {
			return e, nil
		}
	}
	return nil, apperr.NotFound("employee")
}

func (f *fakeEmpRepo) List(_ context.Context, _ uuid.UUID, filters employee.ListFilters) ([]employee.EmployeeWithManager, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	var result []employee.EmployeeWithManager
	for _, e := range f.employees {
		result = append(result, employee.EmployeeWithManager{Employee: *e})
	}
	return result, nil
}

func (f *fakeEmpRepo) Update(_ context.Context, orgID, id uuid.UUID, req employee.UpdateEmployeeRequest) (*employee.Employee, error) {
	e, ok := f.employees[id]
	if !ok || e.OrganisationID != orgID {
		return nil, apperr.NotFound("employee")
	}
	if req.FullName != nil {
		e.FullName = *req.FullName
	}
	return e, nil
}

func (f *fakeEmpRepo) SoftDelete(_ context.Context, orgID, id uuid.UUID) error {
	e, ok := f.employees[id]
	if !ok || e.OrganisationID != orgID {
		return apperr.NotFound("employee")
	}
	e.IsActive = false
	f.count--
	return nil
}

func (f *fakeEmpRepo) GetDirectReports(_ context.Context, orgID, managerID uuid.UUID) ([]employee.Employee, error) {
	var reports []employee.Employee
	for _, e := range f.employees {
		if e.OrganisationID == orgID && e.ReportingTo != nil && *e.ReportingTo == managerID && e.IsActive {
			reports = append(reports, *e)
		}
	}
	return reports, nil
}

func (f *fakeEmpRepo) GetWithManagerName(_ context.Context, orgID, id uuid.UUID) (*employee.EmployeeWithManager, error) {
	e, ok := f.employees[id]
	if !ok || e.OrganisationID != orgID {
		return nil, apperr.NotFound("employee")
	}

	result := &employee.EmployeeWithManager{
		Employee: *e,
	}

	if e.ReportingTo != nil {
		if mgr, ok := f.employees[*e.ReportingTo]; ok {
			name := mgr.FullName
			result.ManagerName = &name
		}
	}

	return result, nil
}

// ── Fake audit logger ────────────────────────────────────────────────────────

type fakeAuditLogger struct {
	entries []audit.LogEntry
	err     error
}

func (f *fakeAuditLogger) Log(_ context.Context, entry audit.LogEntry) error {
	if f.err != nil {
		return f.err
	}
	f.entries = append(f.entries, entry)
	return nil
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func intPtr(i int) *int       { return &i }
func strPtr(s string) *string { return &s }

func TestEmployeeService_Create_PlanLimit(t *testing.T) {
	tests := []struct {
		name        string
		plan        string
		limit       *int
		activeCount int
		wantErr     string
	}{
		{
			name:        "under free-tier limit",
			plan:        "free",
			limit:       intPtr(25),
			activeCount: 10,
		},
		{
			name:        "exactly at free-tier limit",
			plan:        "free",
			limit:       intPtr(25),
			activeCount: 25,
			wantErr:     apperr.CodeEmployeeLimitReached,
		},
		{
			name:        "pro plan — no limit enforced",
			plan:        "pro",
			limit:       nil,
			activeCount: 100,
		},
		{
			name:        "free plan — one below limit",
			plan:        "free",
			limit:       intPtr(25),
			activeCount: 24,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeRepo := newFakeEmpRepo()
			fakeRepo.count = tt.activeCount

			svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: tt.plan, limit: tt.limit})
			orgID := uuid.New()

			_, err := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
				FullName:       "Test Employee",
				Email:          strPtr("test@example.com"),
				EmploymentType: "full_time",
				StartDate:      "2026-01-01",
			})

			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error %q, got nil", tt.wantErr)
				}
				var appErr *apperr.AppError
				if !errors.As(err, &appErr) || appErr.Code != tt.wantErr {
					t.Errorf("expected code %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestEmployeeService_List(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})
	orgID := uuid.New()

	// Seed two employees
	_, _ = svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Alice", Email: strPtr("alice@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})
	_, _ = svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Bob", Email: strPtr("bob@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})

	t.Run("returns employees with meta", func(t *testing.T) {
		result, err := svc.List(context.Background(), orgID, employee.ListFilters{Limit: 20})
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		if len(result.Employees) != 2 {
			t.Errorf("want 2 employees, got %d", len(result.Employees))
		}
		if result.Meta.Limit != 20 {
			t.Errorf("meta.limit = %d, want 20", result.Meta.Limit)
		}
	})

	t.Run("limit clamped to default when 0", func(t *testing.T) {
		result, err := svc.List(context.Background(), orgID, employee.ListFilters{Limit: 0})
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		if result.Meta.Limit != 20 { // paginate.DefaultLimit
			t.Errorf("meta.limit = %d, want 20", result.Meta.Limit)
		}
	})

	t.Run("has_more false when under limit", func(t *testing.T) {
		result, err := svc.List(context.Background(), orgID, employee.ListFilters{Limit: 20})
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		if result.Meta.HasMore {
			t.Error("has_more should be false")
		}
	})

	t.Run("has_more true when page full", func(t *testing.T) {
		result, err := svc.List(context.Background(), orgID, employee.ListFilters{Limit: 1})
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		if !result.Meta.HasMore {
			t.Error("has_more should be true when result fills the page")
		}
		if result.Meta.NextCursor == "" {
			t.Error("next_cursor should be set")
		}
	})
}

func TestEmployeeService_Get(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})
	orgID := uuid.New()

	emp, _ := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Ahmad", Email: strPtr("ahmad@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})

	t.Run("existing employee returned", func(t *testing.T) {
		got, err := svc.Get(context.Background(), orgID, emp.ID)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.ID != emp.ID {
			t.Errorf("id = %v, want %v", got.ID, emp.ID)
		}
	})

	t.Run("unknown id returns not found", func(t *testing.T) {
		_, err := svc.Get(context.Background(), orgID, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *apperr.AppError
		if !errors.As(err, &appErr) || appErr.Code != apperr.CodeNotFound {
			t.Errorf("expected NOT_FOUND, got %v", err)
		}
	})
}

func TestEmployeeService_Update(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})
	orgID := uuid.New()

	emp, _ := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Ahmad", Email: strPtr("ahmad@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})

	t.Run("update full_name", func(t *testing.T) {
		updated, err := svc.Update(context.Background(), orgID, emp.ID, employee.UpdateEmployeeRequest{
			FullName: strPtr("Ahmad Rashid"),
		})
		if err != nil {
			t.Fatalf("update: %v", err)
		}
		if updated.FullName != "Ahmad Rashid" {
			t.Errorf("full_name = %q, want %q", updated.FullName, "Ahmad Rashid")
		}
	})

	t.Run("unknown id returns not found", func(t *testing.T) {
		_, err := svc.Update(context.Background(), orgID, uuid.New(), employee.UpdateEmployeeRequest{})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *apperr.AppError
		if !errors.As(err, &appErr) || appErr.Code != apperr.CodeNotFound {
			t.Errorf("expected NOT_FOUND, got %v", err)
		}
	})
}

func TestEmployeeService_SoftDelete(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})
	orgID := uuid.New()

	// Create an employee first
	emp, err := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName:       "Ahmad Rashid",
		Email:          strPtr("ahmad@example.com"),
		EmploymentType: "full_time",
		StartDate:      "2026-01-01",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	t.Run("deactivate existing employee", func(t *testing.T) {
		if err := svc.Deactivate(context.Background(), orgID, emp.ID); err != nil {
			t.Fatalf("deactivate: %v", err)
		}
	})

	t.Run("deactivate non-existent employee", func(t *testing.T) {
		err := svc.Deactivate(context.Background(), orgID, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *apperr.AppError
		if !errors.As(err, &appErr) || appErr.Code != apperr.CodeNotFound {
			t.Errorf("expected NOT_FOUND, got %v", err)
		}
	})

	t.Run("employee from different org is not found", func(t *testing.T) {
		err := svc.Deactivate(context.Background(), uuid.New(), emp.ID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Error path coverage ───────────────────────────────────────────────────────

func TestEmployeeService_Create_OrgRepoError(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	orgErr := errors.New("org db down")
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{planErr: orgErr})

	_, err := svc.Create(context.Background(), uuid.New(), employee.CreateEmployeeRequest{
		FullName: "X", Email: strPtr("x@x.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})
	if err == nil {
		t.Fatal("expected org repo error, got nil")
	}
	if err.Error() != orgErr.Error() {
		t.Errorf("error = %v, want %v", err, orgErr)
	}
}

func TestEmployeeService_Create_CountActiveError(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	fakeRepo.countActiveErr = errors.New("count db down")
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})

	_, err := svc.Create(context.Background(), uuid.New(), employee.CreateEmployeeRequest{
		FullName: "X", Email: strPtr("x@x.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})
	if err == nil {
		t.Fatal("expected CountActive error, got nil")
	}
}

func TestEmployeeService_List_RepoError(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	fakeRepo.listErr = errors.New("list db down")
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)})

	_, err := svc.List(context.Background(), uuid.New(), employee.ListFilters{Limit: 20})
	if err == nil {
		t.Fatal("expected repo error, got nil")
	}
}

// ── Audit logging tests ──────────────────────────────────────────────────────

func TestEmployeeService_AuditLog_Create(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	al := &fakeAuditLogger{}
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)}, employee.WithAuditLog(al))
	orgID := uuid.New()
	actorID := uuid.New()

	emp, err := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Ahmad", Email: strPtr("ahmad@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	}, actorID)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if len(al.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(al.entries))
	}
	e := al.entries[0]
	if e.Action != "employee.created" {
		t.Errorf("action = %q, want %q", e.Action, "employee.created")
	}
	if e.ResourceID != emp.ID {
		t.Errorf("resource_id = %s, want %s", e.ResourceID, emp.ID)
	}
	if e.ActorUserID != actorID {
		t.Errorf("actor = %s, want %s", e.ActorUserID, actorID)
	}
}

func TestEmployeeService_AuditLog_Update(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	al := &fakeAuditLogger{}
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)}, employee.WithAuditLog(al))
	orgID := uuid.New()
	actorID := uuid.New()

	emp, _ := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Ahmad", Email: strPtr("ahmad@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	}, actorID)

	al.entries = nil // reset

	_, err := svc.Update(context.Background(), orgID, emp.ID, employee.UpdateEmployeeRequest{
		FullName: strPtr("Ahmad Rashid"),
	}, actorID)
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	if len(al.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(al.entries))
	}
	if al.entries[0].Action != "employee.updated" {
		t.Errorf("action = %q, want %q", al.entries[0].Action, "employee.updated")
	}
}

func TestEmployeeService_AuditLog_Deactivate(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	al := &fakeAuditLogger{}
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)}, employee.WithAuditLog(al))
	orgID := uuid.New()
	actorID := uuid.New()

	emp, _ := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Ahmad", Email: strPtr("ahmad@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	}, actorID)

	al.entries = nil // reset

	err := svc.Deactivate(context.Background(), orgID, emp.ID, actorID)
	if err != nil {
		t.Fatalf("deactivate: %v", err)
	}

	if len(al.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(al.entries))
	}
	if al.entries[0].Action != "employee.deactivated" {
		t.Errorf("action = %q, want %q", al.entries[0].Action, "employee.deactivated")
	}
}

func TestEmployeeService_AuditLog_NoActorSkipsAudit(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	al := &fakeAuditLogger{}
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)}, employee.WithAuditLog(al))
	orgID := uuid.New()

	// Create without actorUserID — should not produce audit entry
	_, err := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "No Actor", Email: strPtr("noactor@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if len(al.entries) != 0 {
		t.Errorf("expected 0 audit entries when no actorUserID, got %d", len(al.entries))
	}
}

func TestEmployeeService_AuditLog_ErrorDoesNotBreakOperation(t *testing.T) {
	fakeRepo := newFakeEmpRepo()
	al := &fakeAuditLogger{err: errors.New("audit db down")}
	svc := employee.NewService(fakeRepo, &fakeOrgRepo{plan: "free", limit: intPtr(25)}, employee.WithAuditLog(al))
	orgID := uuid.New()
	actorID := uuid.New()

	// Create should succeed even though audit logging fails.
	_, err := svc.Create(context.Background(), orgID, employee.CreateEmployeeRequest{
		FullName: "Audit Fail", Email: strPtr("auditfail@example.com"), EmploymentType: "full_time", StartDate: "2026-01-01",
	}, actorID)
	if err != nil {
		t.Fatalf("create should succeed despite audit error: %v", err)
	}
}
