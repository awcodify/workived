package audit

import "context"

// Logger is the interface that services depend on for audit logging.
// This allows injecting fakes in unit tests.
type Logger interface {
	Log(ctx context.Context, entry LogEntry) error
}
