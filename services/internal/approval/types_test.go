package approval_test

import (
	"testing"

	"github.com/workived/services/internal/approval"
)

func TestStatusConstants(t *testing.T) {
	if approval.StatusPending != "pending" {
		t.Errorf("expected StatusPending = 'pending', got %q", approval.StatusPending)
	}
	if approval.StatusApproved != "approved" {
		t.Errorf("expected StatusApproved = 'approved', got %q", approval.StatusApproved)
	}
	if approval.StatusRejected != "rejected" {
		t.Errorf("expected StatusRejected = 'rejected', got %q", approval.StatusRejected)
	}
	if approval.StatusCancelled != "cancelled" {
		t.Errorf("expected StatusCancelled = 'cancelled', got %q", approval.StatusCancelled)
	}
	if approval.StatusPaid != "paid" {
		t.Errorf("expected StatusPaid = 'paid', got %q", approval.StatusPaid)
	}
}

func TestValidStatus(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		{"pending", true},
		{"approved", true},
		{"rejected", true},
		{"cancelled", true},
		{"paid", true},
		{"", false},
		{"unknown", false},
		{"PENDING", false},
		{"Approved", false},
	}

	for _, tt := range tests {
		got := approval.ValidStatus(tt.status)
		if got != tt.want {
			t.Errorf("ValidStatus(%q) = %v, want %v", tt.status, got, tt.want)
		}
	}
}

func TestIsFinalStatus(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		// Final states — cannot be transitioned further
		{"approved", true},
		{"rejected", true},
		{"cancelled", true},
		{"paid", true},
		// Non-final — still in progress
		{"pending", false},
		{"", false},
		{"unknown", false},
	}

	for _, tt := range tests {
		got := approval.IsFinalStatus(tt.status)
		if got != tt.want {
			t.Errorf("IsFinalStatus(%q) = %v, want %v", tt.status, got, tt.want)
		}
	}
}
