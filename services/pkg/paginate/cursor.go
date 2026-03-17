package paginate

import (
	"encoding/base64"
	"encoding/json"
)

const DefaultLimit = 20
const MaxLimit = 100

// Cursor is an opaque token encoding the last-seen value(s) for stable pagination.
type Cursor struct {
	Value string `json:"v"` // last-seen sort key (e.g. full_name or created_at RFC3339)
	ID    string `json:"id"` // last-seen id to break ties
}

// Encode serialises a Cursor to a URL-safe base64 string.
func Encode(c Cursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Decode parses a cursor string produced by Encode. Returns zero Cursor on error.
func Decode(token string) Cursor {
	if token == "" {
		return Cursor{}
	}
	b, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return Cursor{}
	}
	var c Cursor
	_ = json.Unmarshal(b, &c)
	return c
}

// ClampLimit ensures limit is within [1, MaxLimit].
func ClampLimit(limit int) int {
	if limit <= 0 {
		return DefaultLimit
	}
	if limit > MaxLimit {
		return MaxLimit
	}
	return limit
}

// Meta is the pagination metadata returned in API responses.
type Meta struct {
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
	Limit      int    `json:"limit"`
}
