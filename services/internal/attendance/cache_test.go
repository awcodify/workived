package attendance_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/attendance"
)

func TestListWorkSchedules_delegatesToRepo(t *testing.T) {
	orgID := uuid.New()

	repo := &fakeRepo{
		getDefaultSchedFn: func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
			return nil, nil
		},
		listHolidaysFn: func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
			return nil, nil
		},
		listActiveEmpsFn: func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
			return nil, nil
		},
		getEmployeeNameFn: func(_ context.Context, _, _ uuid.UUID) (string, error) {
			return "", nil
		},
	}

	orgInfo := &fakeOrgInfo{tz: "UTC", cc: "ID"}
	empInfo := &fakeEmployeeInfo{}

	// Without cache — calls go directly to repo
	svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())

	result, err := svc.ListWorkSchedules(context.Background(), orgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// fakeRepo.ListWorkSchedules returns nil
	if result != nil {
		t.Fatalf("expected nil, got %v", result)
	}
}
