package announcements

import (
	"time"

	"github.com/google/uuid"
)

// Announcement is a company-wide message posted by an admin or generated automatically.
type Announcement struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	AuthorID       *uuid.UUID `json:"author_id,omitempty"`
	AuthorName     string     `json:"author_name"`
	Title          string     `json:"title"`
	Body           string     `json:"body"`
	IsPinned       bool       `json:"is_pinned"`
	IsAuto         bool       `json:"is_auto"`
	PublishedAt    *time.Time `json:"published_at,omitempty"`
	IsRead         bool       `json:"is_read"` // computed per-employee
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CreateAnnouncementRequest is the request body for creating an announcement.
type CreateAnnouncementRequest struct {
	Title     string `json:"title"      validate:"required,max=255"`
	Body      string `json:"body"       validate:"required"`
	IsPinned  bool   `json:"is_pinned"`
	Publish   bool   `json:"publish"` // if true, set published_at = now
}

// UpdateAnnouncementRequest is the request body for updating an announcement.
type UpdateAnnouncementRequest struct {
	Title    string `json:"title"    validate:"required,max=255"`
	Body     string `json:"body"     validate:"required"`
	IsPinned bool   `json:"is_pinned"`
}

// ListFilter controls which announcements are returned.
type ListFilter struct {
	PinnedOnly bool
	Published  bool // only published (default true for employees)
}

// UnreadCount is the response for the unread count endpoint.
type UnreadCount struct {
	Count int `json:"count"`
}
