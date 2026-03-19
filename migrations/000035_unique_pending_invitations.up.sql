-- 000035_unique_pending_invitations.up.sql
-- Prevent duplicate pending invitations for the same email in the same organization.
-- This partial unique index only enforces uniqueness for invitations that haven't been accepted yet.

CREATE UNIQUE INDEX idx_invitations_unique_pending 
ON invitations(organisation_id, email) 
WHERE accepted_at IS NULL;
