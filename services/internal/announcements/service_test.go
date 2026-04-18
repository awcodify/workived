package announcements_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/announcements"
)

// ── Fake repo ─────────────────────────────────────────────────────────────────

type fakeRepo struct {
	listFn        func(ctx context.Context, orgID, empID uuid.UUID) ([]announcements.Announcement, error)
	listAdminFn   func(ctx context.Context, orgID uuid.UUID) ([]announcements.Announcement, error)
	getByIDFn     func(ctx context.Context, orgID, id uuid.UUID) (*announcements.Announcement, error)
	createFn      func(ctx context.Context, orgID, authorID uuid.UUID, req announcements.CreateAnnouncementRequest, now time.Time) (*announcements.Announcement, error)
	updateFn      func(ctx context.Context, orgID, id uuid.UUID, req announcements.UpdateAnnouncementRequest) (*announcements.Announcement, error)
	publishFn     func(ctx context.Context, orgID, id uuid.UUID, now time.Time) (*announcements.Announcement, error)
	setPinnedFn   func(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*announcements.Announcement, error)
	deleteFn      func(ctx context.Context, orgID, id uuid.UUID) error
	markReadFn    func(ctx context.Context, orgID, annID, empID uuid.UUID) error
	countUnreadFn func(ctx context.Context, orgID, empID uuid.UUID) (int, error)
}

func (f *fakeRepo) List(ctx context.Context, orgID, empID uuid.UUID) ([]announcements.Announcement, error) {
	if f.listFn != nil {
		return f.listFn(ctx, orgID, empID)
	}
	return []announcements.Announcement{}, nil
}
func (f *fakeRepo) ListAdmin(ctx context.Context, orgID uuid.UUID) ([]announcements.Announcement, error) {
	if f.listAdminFn != nil {
		return f.listAdminFn(ctx, orgID)
	}
	return []announcements.Announcement{}, nil
}
func (f *fakeRepo) GetByID(ctx context.Context, orgID, id uuid.UUID) (*announcements.Announcement, error) {
	if f.getByIDFn != nil {
		return f.getByIDFn(ctx, orgID, id)
	}
	return &announcements.Announcement{ID: id}, nil
}
func (f *fakeRepo) Create(ctx context.Context, orgID, authorID uuid.UUID, req announcements.CreateAnnouncementRequest, now time.Time) (*announcements.Announcement, error) {
	if f.createFn != nil {
		return f.createFn(ctx, orgID, authorID, req, now)
	}
	return &announcements.Announcement{ID: uuid.New(), OrganisationID: orgID, AuthorID: authorID, Title: req.Title, Body: req.Body}, nil
}
func (f *fakeRepo) Update(ctx context.Context, orgID, id uuid.UUID, req announcements.UpdateAnnouncementRequest) (*announcements.Announcement, error) {
	if f.updateFn != nil {
		return f.updateFn(ctx, orgID, id, req)
	}
	return &announcements.Announcement{ID: id, Title: req.Title}, nil
}
func (f *fakeRepo) Publish(ctx context.Context, orgID, id uuid.UUID, now time.Time) (*announcements.Announcement, error) {
	if f.publishFn != nil {
		return f.publishFn(ctx, orgID, id, now)
	}
	return &announcements.Announcement{ID: id, PublishedAt: &now}, nil
}
func (f *fakeRepo) SetPinned(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*announcements.Announcement, error) {
	if f.setPinnedFn != nil {
		return f.setPinnedFn(ctx, orgID, id, pinned)
	}
	return &announcements.Announcement{ID: id, IsPinned: pinned}, nil
}
func (f *fakeRepo) Delete(ctx context.Context, orgID, id uuid.UUID) error {
	if f.deleteFn != nil {
		return f.deleteFn(ctx, orgID, id)
	}
	return nil
}
func (f *fakeRepo) MarkRead(ctx context.Context, orgID, annID, empID uuid.UUID) error {
	if f.markReadFn != nil {
		return f.markReadFn(ctx, orgID, annID, empID)
	}
	return nil
}
func (f *fakeRepo) CountUnread(ctx context.Context, orgID, empID uuid.UUID) (int, error) {
	if f.countUnreadFn != nil {
		return f.countUnreadFn(ctx, orgID, empID)
	}
	return 0, nil
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func TestService_Create(t *testing.T) {
	orgID := uuid.New()
	authorID := uuid.New()
	svc := announcements.NewService(&fakeRepo{}, zerolog.Nop())

	ann, err := svc.Create(context.Background(), orgID, authorID, announcements.CreateAnnouncementRequest{
		Title:   "Office closed tomorrow",
		Body:    "Due to Lebaran, office will be closed.",
		Publish: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ann.Title != "Office closed tomorrow" {
		t.Errorf("expected title, got %q", ann.Title)
	}
}

func TestService_List_emptyWhenNoAnnouncements(t *testing.T) {
	orgID := uuid.New()
	empID := uuid.New()
	svc := announcements.NewService(&fakeRepo{}, zerolog.Nop())

	list, err := svc.List(context.Background(), orgID, empID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected empty list, got %d", len(list))
	}
}

func TestService_List_returnsAnnouncements(t *testing.T) {
	orgID := uuid.New()
	empID := uuid.New()
	expected := []announcements.Announcement{
		{ID: uuid.New(), Title: "First", IsPinned: true},
		{ID: uuid.New(), Title: "Second"},
	}

	repo := &fakeRepo{
		listFn: func(_ context.Context, _, _ uuid.UUID) ([]announcements.Announcement, error) {
			return expected, nil
		},
	}
	svc := announcements.NewService(repo, zerolog.Nop())

	list, err := svc.List(context.Background(), orgID, empID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 announcements, got %d", len(list))
	}
}

func TestService_SetPinned(t *testing.T) {
	orgID := uuid.New()
	id := uuid.New()
	svc := announcements.NewService(&fakeRepo{}, zerolog.Nop())

	ann, err := svc.SetPinned(context.Background(), orgID, id, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ann.IsPinned {
		t.Error("expected is_pinned = true")
	}
}

func TestService_CountUnread(t *testing.T) {
	orgID := uuid.New()
	empID := uuid.New()

	repo := &fakeRepo{
		countUnreadFn: func(_ context.Context, _, _ uuid.UUID) (int, error) { return 3, nil },
	}
	svc := announcements.NewService(repo, zerolog.Nop())

	count, err := svc.CountUnread(context.Background(), orgID, empID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestService_MarkRead(t *testing.T) {
	called := false
	repo := &fakeRepo{
		markReadFn: func(_ context.Context, _, _, _ uuid.UUID) error {
			called = true
			return nil
		},
	}
	svc := announcements.NewService(repo, zerolog.Nop())

	err := svc.MarkRead(context.Background(), uuid.New(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("expected MarkRead to be called on repo")
	}
}

func TestService_Delete(t *testing.T) {
	deleted := false
	repo := &fakeRepo{
		deleteFn: func(_ context.Context, _, _ uuid.UUID) error {
			deleted = true
			return nil
		},
	}
	svc := announcements.NewService(repo, zerolog.Nop())

	err := svc.Delete(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected Delete to be called on repo")
	}
}

func TestService_Publish_setsPublishedAt(t *testing.T) {
	orgID := uuid.New()
	id := uuid.New()
	now := time.Date(2026, 4, 18, 10, 0, 0, 0, time.UTC)

	var capturedNow time.Time
	repo := &fakeRepo{
		publishFn: func(_ context.Context, _, _ uuid.UUID, n time.Time) (*announcements.Announcement, error) {
			capturedNow = n
			return &announcements.Announcement{ID: id, PublishedAt: &n}, nil
		},
	}
	svc := announcements.NewService(repo, zerolog.Nop())
	svc.SetNowFunc(func() time.Time { return now })

	ann, err := svc.Publish(context.Background(), orgID, id)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ann.PublishedAt == nil {
		t.Error("expected published_at to be set")
	}
	if !capturedNow.Equal(now) {
		t.Errorf("expected now=%v, got %v", now, capturedNow)
	}
}
