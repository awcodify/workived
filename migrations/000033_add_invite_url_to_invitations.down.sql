-- 000033_add_invite_url_to_invitations.down.sql
ALTER TABLE invitations DROP COLUMN IF EXISTS invite_url;
