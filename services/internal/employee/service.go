package employee

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	List(ctx context.Context, orgID uuid.UUID, f ListFilters) ([]EmployeeWithManager, error)
	CountActive(ctx context.Context, orgID uuid.UUID) (int, error)
	ListAllActive(ctx context.Context, orgID uuid.UUID) ([]Employee, error)
	Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error)
	GetByID(ctx context.Context, orgID, id uuid.UUID) (*Employee, error)
	GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest) (*Employee, error)
	SoftDelete(ctx context.Context, orgID, id uuid.UUID) error
	GetDirectReports(ctx context.Context, orgID, managerID uuid.UUID) ([]Employee, error)
	GetWithManagerName(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error)
}

// OrgInfoProvider is the narrow interface the employee service needs from organisation.
type OrgInfoProvider interface {
	GetOrgPlanInfo(ctx context.Context, orgID uuid.UUID) (plan string, limit *int, err error)
}

type Service struct {
	repo     RepositoryInterface
	orgRepo  OrgInfoProvider
	auditLog audit.Logger
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

// logAudit records an audit entry. If audit logging fails, it logs the error but does not
// propagate it — audit failures must never break the main operation.
func (s *Service) logAudit(ctx context.Context, entry audit.LogEntry) {
	if s.auditLog == nil {
		return
	}
	if err := s.auditLog.Log(ctx, entry); err != nil {
		log.Printf("audit log error: %v", err)
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
	_, limit, err := s.orgRepo.GetOrgPlanInfo(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if limit != nil {
		count, err := s.repo.CountActive(ctx, orgID)
		if err != nil {
			return nil, err
		}
		if count >= *limit {
			return nil, apperr.New(apperr.CodeEmployeeLimitReached,
				"free plan limit reached — upgrade to Pro for unlimited employees")
		}
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

func (s *Service) Get(ctx context.Context, orgID, id uuid.UUID) (*Employee, error) {
	return s.repo.GetByID(ctx, orgID, id)
}

func (s *Service) GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error) {
	return s.repo.GetByUserID(ctx, orgID, userID)
}

func (s *Service) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest, actorUserID ...uuid.UUID) (*Employee, error) {
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

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "employee.updated",
			ResourceType: "employee",
			ResourceID:   id,
			AfterState:   emp,
		})
	}

	return emp, nil
}

func (s *Service) Deactivate(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	if err := s.repo.SoftDelete(ctx, orgID, id); err != nil {
		return err
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
	employees, err := s.repo.ListAllActive(ctx, orgID)
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
