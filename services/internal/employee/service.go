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
	List(ctx context.Context, orgID uuid.UUID, f ListFilters) ([]Employee, error)
	CountActive(ctx context.Context, orgID uuid.UUID) (int, error)
	Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error)
	GetByID(ctx context.Context, orgID, id uuid.UUID) (*Employee, error)
	GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest) (*Employee, error)
	SoftDelete(ctx context.Context, orgID, id uuid.UUID) error
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
	Employees []Employee
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
