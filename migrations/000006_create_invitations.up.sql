-- 000006_create_invitations.up.sql
CREATE TABLE invitations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    email            VARCHAR(255) NOT NULL,
    role             VARCHAR(20) NOT NULL DEFAULT 'member'
                         CHECK (role IN ('admin', 'member')),
    invited_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash       TEXT NOT NULL UNIQUE,
    expires_at       TIMESTAMPTZ NOT NULL,
    accepted_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_org ON invitations(organisation_id);
CREATE INDEX idx_invitations_email ON invitations(email);
