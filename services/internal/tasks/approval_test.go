package tasks_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestCreateApprovalTask verifies that approval tasks can be created
func TestCreateApprovalTask(t *testing.T) {
	approvalID := uuid.New()

	tests := []struct {
		name         string
		approvalType string
		title        string
		setupSvc     func() *fakeService
		wantErr      bool
	}{
		{
			name:         "create leave approval task",
			approvalType: "leave",
			title:        "Approve leave request",
			setupSvc: func() *fakeService {
				return &fakeService{
					createApprovalTaskFn: func(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID, _, _ string, _ uuid.UUID, _ *string) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
		{
			name:         "create claim approval task",
			approvalType: "claim",
			title:        "Approve claim",
			setupSvc: func() *fakeService {
				return &fakeService{
					createApprovalTaskFn: func(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID, _, _ string, _ uuid.UUID, _ *string) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := tt.setupSvc()

			err := svc.CreateApprovalTask(
				context.Background(),
				testOrgID,
				tt.approvalType,
				approvalID,
				tt.title,
				"Test description",
				testEmpID,
				nil,
			)

			if (err != nil) != tt.wantErr {
				t.Errorf("CreateApprovalTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestDeleteApprovalTask verifies that approval tasks can be deleted
func TestDeleteApprovalTask(t *testing.T) {
	tests := []struct {
		name         string
		approvalType string
		approvalID   uuid.UUID
		setupService func() *fakeService
		wantErr      bool
	}{
		{
			name:         "delete leave approval task",
			approvalType: "leave",
			approvalID:   uuid.New(),
			setupService: func() *fakeService {
				return &fakeService{
					deleteApprovalTaskFn: func(_ context.Context, _ string, _ uuid.UUID) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
		{
			name:         "delete claim approval task",
			approvalType: "claim",
			approvalID:   uuid.New(),
			setupService: func() *fakeService {
				return &fakeService{
					deleteApprovalTaskFn: func(_ context.Context, _ string, _ uuid.UUID) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := tt.setupService()

			err := svc.DeleteApprovalTask(context.Background(), tt.approvalType, tt.approvalID)

			if (err != nil) != tt.wantErr {
				t.Errorf("DeleteApprovalTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestCompleteApprovalTask verifies that approval tasks can be completed
func TestCompleteApprovalTask(t *testing.T) {
	approvalID := uuid.New()

	tests := []struct {
		name         string
		approvalType string
		setupSvc     func() *fakeService
		wantErr      bool
	}{
		{
			name:         "complete leave approval task",
			approvalType: "leave",
			setupSvc: func() *fakeService {
				return &fakeService{
					completeApprovalTaskFn: func(_ context.Context, _ string, _ uuid.UUID) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
		{
			name:         "complete claim approval task",
			approvalType: "claim",
			setupSvc: func() *fakeService {
				return &fakeService{
					completeApprovalTaskFn: func(_ context.Context, _ string, _ uuid.UUID) error {
						return nil
					},
				}
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := tt.setupSvc()

			err := svc.CompleteApprovalTask(context.Background(), tt.approvalType, approvalID)

			if (err != nil) != tt.wantErr {
				t.Errorf("CompleteApprovalTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
