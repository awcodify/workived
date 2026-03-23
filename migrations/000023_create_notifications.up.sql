-- 000021_create_notifications.up.sql
CREATE TABLE notifications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             VARCHAR(50) NOT NULL,   -- e.g. leave.approved, claim.rejected
    title            VARCHAR(255) NOT NULL,
    body             TEXT,
    resource_type    VARCHAR(50),            -- e.g. leave_request, claim
    resource_id      UUID,
    is_read          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_org            ON notifications(organisation_id);
CREATE INDEX idx_notif_user_read      ON notifications(user_id, is_read, created_at DESC);
