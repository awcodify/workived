package auth

// HashTokenForTest exposes the internal hashToken function for use in tests.
func HashTokenForTest(raw string) string {
	return hashToken(raw)
}
