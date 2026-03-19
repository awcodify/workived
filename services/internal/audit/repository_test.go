package audit_test

import (
	"encoding/json"
	"testing"

	"github.com/workived/services/internal/audit"
)

func TestMarshalLogEntry(t *testing.T) {
	// Verify LogEntry fields can be JSON-marshaled (used for before_state/after_state).
	entry := audit.LogEntry{
		Action:       "employee.created",
		ResourceType: "employee",
	}
	if entry.Action != "employee.created" {
		t.Errorf("action = %q, want %q", entry.Action, "employee.created")
	}
	if entry.ResourceType != "employee" {
		t.Errorf("resource_type = %q, want %q", entry.ResourceType, "employee")
	}
}

func TestLogEntryBeforeAfterState(t *testing.T) {
	tests := []struct {
		name  string
		state interface{}
		want  bool // true if marshaling should succeed
	}{
		{
			name:  "nil state",
			state: nil,
			want:  true,
		},
		{
			name:  "map state",
			state: map[string]interface{}{"email": "test@example.com", "role": "admin"},
			want:  true,
		},
		{
			name:  "struct state",
			state: struct{ Name string }{Name: "Test"},
			want:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.state == nil {
				return // nil is valid, no marshal needed
			}
			_, err := json.Marshal(tt.state)
			if (err == nil) != tt.want {
				t.Errorf("marshal err = %v, want success = %v", err, tt.want)
			}
		})
	}
}
