package leave_test

import "github.com/google/uuid"

// ── Shared test UUIDs ────────────────────────────────────────────────────────
// Single source of truth for all leave test files.

var (
	testOrgID    = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testUserID   = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	testEmpID    = uuid.MustParse("00000000-0000-0000-0000-000000000003")
	testPolicyID = uuid.MustParse("00000000-0000-0000-0000-000000000004")
	testReqID    = uuid.MustParse("00000000-0000-0000-0000-000000000005")
	testBalID    = uuid.MustParse("00000000-0000-0000-0000-000000000006")
)
