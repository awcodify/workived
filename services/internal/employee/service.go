package employee

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/employmentchange"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/cache"
	"github.com/workived/services/pkg/paginate"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	List(ctx context.Context, orgID uuid.UUID, f ListFilters) ([]EmployeeWithManager, error)
	CountActive(ctx context.Context, orgID uuid.UUID) (int, error)
	ListAllActive(ctx context.Context, orgID uuid.UUID) ([]Employee, error)
	Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error)
	GetByID(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error)
	GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest) (*Employee, error)
	SoftDelete(ctx context.Context, orgID, id uuid.UUID) error
	GetDirectReports(ctx context.Context, orgID, managerID uuid.UUID) ([]Employee, error)
	GetWithManagerName(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error)
	GetWorkload(ctx context.Context, orgID uuid.UUID) ([]EmployeeWorkload, error)
}

// OrgInfoProvider is the narrow interface the employee service needs from organisation.
type OrgInfoProvider interface {
	GetOrgPlanInfo(ctx context.Context, orgID uuid.UUID) (plan string, limit *int, err error)
	UpdateManagerSubordinateFlag(ctx context.Context, orgID, managerEmployeeID uuid.UUID) error
}

type Service struct {
	repo           RepositoryInterface
	orgRepo        OrgInfoProvider
	cache          *cache.Store
	auditLog       audit.Logger
	employmentRepo employmentchange.Repository
	log            zerolog.Logger
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, opts ...ServiceOption) *Service {
	s := &Service{repo: repo, orgRepo: orgRepo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// ServiceOption configures optional Service dependencies.
type ServiceOption func(*Service)

// WithAuditLog sets the audit logger for the service.
func WithAuditLog(al audit.Logger) ServiceOption {
	return func(s *Service) {
		s.auditLog = al
	}
}

// WithLogger sets the zerolog logger for the service.
func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

// WithEmploymentChangeRepo sets the employment change repository for the service.
func WithEmploymentChangeRepo(repo employmentchange.Repository) ServiceOption {
	return func(s *Service) {
		s.employmentRepo = repo
	}
}

// logAudit records an audit entry. If audit logging fails, it logs the error but does not
// propagate it — audit failures must never break the main operation.
func (s *Service) logAudit(ctx context.Context, entry audit.LogEntry) {
	if s.auditLog == nil {
		return
	}
	if err := s.auditLog.Log(ctx, entry); err != nil {
		s.log.Error().Err(err).Msg("audit log error")
	}
}

type ListResult struct {
	Employees []EmployeeWithManager
	Meta      paginate.Meta
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID, f ListFilters) (*ListResult, error) {
	limit := paginate.ClampLimit(f.Limit)
	f.Limit = limit + 1 // fetch one extra to detect next page

	emps, err := s.repo.List(ctx, orgID, f)
	if err != nil {
		return nil, err
	}

	hasMore := len(emps) > limit
	if hasMore {
		emps = emps[:limit]
	}

	var nextCursor string
	if hasMore && len(emps) > 0 {
		last := emps[len(emps)-1]
		nextCursor = paginate.Encode(paginate.Cursor{Value: last.FullName, ID: last.ID.String()})
	}

	return &ListResult{
		Employees: emps,
		Meta:      paginate.Meta{NextCursor: nextCursor, HasMore: hasMore, Limit: limit},
	}, nil
}

func (s *Service) Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest, actorUserID ...uuid.UUID) (*Employee, error) {
	plan, limit, err := s.orgRepo.GetOrgPlanInfo(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if plan != "pro" && limit != nil {
		count, err := s.countActiveCached(ctx, orgID)
		if err != nil {
			return nil, err
		}
		if count >= *limit {
			return nil, apperr.New(apperr.CodeUpgradeRequired,
				"free plan limit reached — upgrade to Pro for unlimited employees")
		}
	}

	// Validate email is provided
	if req.Email == nil || *req.Email == "" {
		return nil, apperr.New(apperr.CodeValidation, "Email should be filled")
	}

	// Validate reporting_to if provided
	if req.ReportingTo != nil {
		if err := s.validateReportingTo(ctx, orgID, uuid.Nil, *req.ReportingTo); err != nil {
			return nil, err
		}
	}

	emp, err := s.repo.Create(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	// Update manager's has_subordinate flag if employee has a manager
	if req.ReportingTo != nil {
		_ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *req.ReportingTo)
	}

	s.invalidateCache(ctx, orgID)

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "employee.created",
			ResourceType: "employee",
			ResourceID:   emp.ID,
			AfterState:   emp,
		})
	}

	return emp, nil
}

func (s *Service) Get(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error) {
	return s.getCached(ctx, orgID, id)
}

func (s *Service) GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error) {
	return s.getByUserIDCached(ctx, orgID, userID)
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest, actorUserID ...uuid.UUID) (*Employee, error) {
	// Get old employee data to detect changes
	oldEmpWithMgr, err := s.repo.GetByID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}
	oldEmp := &oldEmpWithMgr.Employee

	if req.ReportingTo != nil && req.ClearReportingTo {
		return nil, fmt.Errorf("cannot set and clear reporting_to simultaneously: %w", apperr.New(apperr.CodeValidation, "cannot set and clear reporting_to simultaneously"))
	}

	// Validate reporting_to if being updated
	if req.ReportingTo != nil {
		if err := s.validateReportingTo(ctx, orgID, id, *req.ReportingTo); err != nil {
			return nil, err
		}
	}

	emp, err := s.repo.Update(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	// Update has_subordinate flags if reporting_to changed
	if req.ReportingTo != nil {
		newManagerID := *req.ReportingTo
		if oldEmp.ReportingTo != nil && *oldEmp.ReportingTo != newManagerID {
			_ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *oldEmp.ReportingTo)
		}
		_ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, newManagerID)
	}

	// Clear manager assignment: update old manager's flag
	if req.ClearReportingTo && oldEmp.ReportingTo != nil {
		_ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *oldEmp.ReportingTo)
	}

	// Log employment changes if repository is configured
	if len(actorUserID) > 0 && s.employmentRepo != nil {
		s.log.Info().
			Str("old_title", ptrStr(oldEmp.JobTitle)).
			Str("new_title", ptrStr(emp.JobTitle)).
			Str("old_type", oldEmp.EmploymentType).
			Str("new_type", emp.EmploymentType).
			Msg("DEBUG: calling logEmploymentChanges")
		s.logEmploymentChanges(ctx, orgID, oldEmp, emp, actorUserID[0])
	} else {
		s.log.Warn().
			Bool("has_actor", len(actorUserID) > 0).
			Bool("has_repo", s.employmentRepo != nil).
			Msg("DEBUG: skipping employment changes (missing actor or repo)")
	}

	s.invalidateCache(ctx, orgID)

	// Log to audit_logs
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "employee.updated",
			ResourceType: "employee",
			ResourceID:   id,
			BeforeState:  oldEmp,
			AfterState:   emp,
		})
	}

	return emp, nil
}

func (s *Service) Deactivate(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	// Get employee data to update their manager's flag
	emp, err := s.repo.GetByID(ctx, orgID, id)
	if err != nil {
		return err
	}

	if err := s.repo.SoftDelete(ctx, orgID, id); err != nil {
		return err
	}

	s.invalidateCache(ctx, orgID)

	// Update manager's has_subordinate flag if employee had a manager
	if emp.ReportingTo != nil {
		_ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *emp.ReportingTo)
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "employee.deactivated",
			ResourceType: "employee",
			ResourceID:   id,
		})
	}

	return nil
}

// GetDirectReports returns all active employees who report to the given manager.
func (s *Service) GetDirectReports(ctx context.Context, orgID, managerID uuid.UUID) ([]Employee, error) {
	return s.repo.GetDirectReports(ctx, orgID, managerID)
}

// GetWithManagerName returns an employee with their manager's name populated.
func (s *Service) GetWithManagerName(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error) {
	return s.repo.GetWithManagerName(ctx, orgID, id)
}

// GetOrgChart returns the organizational hierarchy tree starting from top-level employees (no manager).
func (s *Service) GetOrgChart(ctx context.Context, orgID uuid.UUID) ([]*OrgChartNode, error) {
	// Fetch all active employees
	employees, err := s.listAllActiveCached(ctx, orgID)
	if err != nil {
		return nil, err
	}

	// Build a map for quick lookup
	empMap := make(map[uuid.UUID]*Employee)
	for i := range employees {
		empMap[employees[i].ID] = &employees[i]
	}

	// Build the tree: create nodes and organize by parent
	nodes := make(map[uuid.UUID]*OrgChartNode)
	var roots []*OrgChartNode

	// First pass: create all nodes
	for _, emp := range employees {
		node := &OrgChartNode{
			ID:             emp.ID,
			FullName:       emp.FullName,
			Email:          emp.Email,
			JobTitle:       emp.JobTitle,
			DepartmentID:   emp.DepartmentID,
			EmploymentType: emp.EmploymentType,
			Status:         emp.Status,
			ReportingTo:    emp.ReportingTo,
			DirectReports:  []*OrgChartNode{},
		}
		nodes[emp.ID] = node
	}

	// Second pass: build parent-child relationships
	for _, node := range nodes {
		if node.ReportingTo == nil {
			// No manager = top-level (CEO/Founders)
			roots = append(roots, node)
		} else if parent, exists := nodes[*node.ReportingTo]; exists {
			// Add as direct report to manager
			parent.DirectReports = append(parent.DirectReports, node)
		} else {
			// Manager not found or inactive, treat as root
			roots = append(roots, node)
		}
	}

	return roots, nil
}

// validateReportingTo ensures:
// - Manager exists and belongs to the same organisation
// - Employee is not reporting to themselves
// - No circular reporting chains (max depth: 5 levels)
func (s *Service) validateReportingTo(ctx context.Context, orgID, employeeID, managerID uuid.UUID) error {
	// Check 1: Self-reference
	if employeeID != uuid.Nil && employeeID == managerID {
		return apperr.New(apperr.CodeValidation, "an employee cannot report to themselves")
	}

	// Check 2: Manager exists in same org
	manager, err := s.repo.GetByID(ctx, orgID, managerID)
	if err != nil {
		return apperr.New(apperr.CodeValidation, "reporting_to employee not found or not in your organisation")
	}
	if manager.OrganisationID != orgID {
		return apperr.New(apperr.CodeValidation, "manager must belong to the same organisation")
	}

	// Check 3: Circular chain detection (walk up the chain, max 5 levels)
	if employeeID != uuid.Nil {
		visited := make(map[uuid.UUID]bool)
		current := manager.ReportingTo
		depth := 0
		const maxDepth = 5

		for current != nil && depth < maxDepth {
			if *current == employeeID {
				return apperr.New(apperr.CodeValidation, "circular reporting chain detected")
			}
			if visited[*current] {
				// Cycle detected in the existing chain (shouldn't happen if DB is consistent)
				return apperr.New(apperr.CodeValidation, "reporting chain contains a cycle")
			}
			visited[*current] = true

			parent, err := s.repo.GetByID(ctx, orgID, *current)
			if err != nil {
				break // Chain ends here (manager not found or inactive)
			}
			current = parent.ReportingTo
			depth++
		}

		if depth >= maxDepth {
			return apperr.New(apperr.CodeValidation, "reporting chain is too deep (max 5 levels)")
		}
	}

	return nil
}

// GetWorkload returns workload information for all active employees.
// This is used for workload-aware task assignment.
func (s *Service) GetWorkload(ctx context.Context, orgID uuid.UUID) ([]EmployeeWorkload, error) {
	workloads, err := s.repo.GetWorkload(ctx, orgID)
	if err != nil {
		s.log.Error().
			Err(err).
			Str("org_id", orgID.String()).
			Msg("failed to fetch employee workload")
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Int("employee_count", len(workloads)).
		Msg("employee.workload.fetched")

	return workloads, nil
}

// logEmploymentChanges detects and logs changes to employment_changes table.
func (s *Service) logEmploymentChanges(ctx context.Context, orgID uuid.UUID, oldEmp, newEmp *Employee, changedBy uuid.UUID) {
	now := time.Now()

	// Check department change
	if !uuidPtrEqual(oldEmp.DepartmentID, newEmp.DepartmentID) {
		_, _ = s.employmentRepo.Create(ctx, orgID, employmentchange.CreateChangeRequest{
			EmployeeID:    newEmp.ID,
			ChangeType:    employmentchange.ChangeTypeDepartment,
			OldValue:      uuidPtrToString(oldEmp.DepartmentID),
			NewValue:      uuidPtrToString(newEmp.DepartmentID),
			EffectiveDate: now,
			ChangedBy:     &changedBy,
		})
	}

	// Check job title change
	if !stringPtrEqual(oldEmp.JobTitle, newEmp.JobTitle) {
		s.log.Info().
			Str("old", ptrStr(oldEmp.JobTitle)).
			Str("new", ptrStr(newEmp.JobTitle)).
			Msg("DEBUG: job title changed, creating employment change record")
		change, err := s.employmentRepo.Create(ctx, orgID, employmentchange.CreateChangeRequest{
			EmployeeID:    newEmp.ID,
			ChangeType:    employmentchange.ChangeTypeTitle,
			OldValue:      oldEmp.JobTitle,
			NewValue:      newEmp.JobTitle,
			EffectiveDate: now,
			ChangedBy:     &changedBy,
		})
		if err != nil {
			s.log.Error().Err(err).Msg("DEBUG: failed to create title change record")
		} else {
			s.log.Info().Str("change_id", change.ID.String()).Msg("DEBUG: title change recorded")
		}
	}

	// Check salary change
	if !salaryEqual(oldEmp.BaseSalary, oldEmp.SalaryCurrency, newEmp.BaseSalary, newEmp.SalaryCurrency) {
		_, _ = s.employmentRepo.Create(ctx, orgID, employmentchange.CreateChangeRequest{
			EmployeeID:    newEmp.ID,
			ChangeType:    employmentchange.ChangeTypeSalary,
			OldSalary:     oldEmp.BaseSalary,
			NewSalary:     newEmp.BaseSalary,
			CurrencyCode:  newEmp.SalaryCurrency,
			EffectiveDate: now,
			ChangedBy:     &changedBy,
		})
	}

	// Check status change
	if oldEmp.Status != newEmp.Status {
		oldVal := oldEmp.Status
		newVal := newEmp.Status
		_, _ = s.employmentRepo.Create(ctx, orgID, employmentchange.CreateChangeRequest{
			EmployeeID:    newEmp.ID,
			ChangeType:    employmentchange.ChangeTypeStatus,
			OldValue:      &oldVal,
			NewValue:      &newVal,
			EffectiveDate: now,
			ChangedBy:     &changedBy,
		})
	}

	// Check employment type change
	if oldEmp.EmploymentType != newEmp.EmploymentType {
		oldVal := oldEmp.EmploymentType
		newVal := newEmp.EmploymentType
		s.log.Info().
			Str("old", oldVal).
			Str("new", newVal).
			Msg("DEBUG: employment type changed, creating employment change record")
		change, err := s.employmentRepo.Create(ctx, orgID, employmentchange.CreateChangeRequest{
			EmployeeID:    newEmp.ID,
			ChangeType:    employmentchange.ChangeTypeEmploymentType,
			OldValue:      &oldVal,
			NewValue:      &newVal,
			EffectiveDate: now,
			ChangedBy:     &changedBy,
		})
		if err != nil {
			s.log.Error().Err(err).Msg("DEBUG: failed to create employment type change record")
		} else {
			s.log.Info().Str("change_id", change.ID.String()).Msg("DEBUG: employment type change recorded")
		}
	}
}

// Helper function for logging
func ptrStr(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

// Helper functions for change detection

func uuidPtrEqual(a, b *uuid.UUID) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func stringPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func salaryEqual(oldSalary *int64, oldCurrency *string, newSalary *int64, newCurrency *string) bool {
	if oldSalary == nil && newSalary == nil {
		return true
	}
	if oldSalary == nil || newSalary == nil {
		return false
	}
	if *oldSalary != *newSalary {
		return false
	}
	// If salaries are the same, also check currency
	return stringPtrEqual(oldCurrency, newCurrency)
}

func uuidPtrToString(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	s := id.String()
	return &s
}
