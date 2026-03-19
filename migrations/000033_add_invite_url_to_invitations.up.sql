-- 000033_add_invite_url_to_invitations.up.sql
-- Store the invite URL so the list endpoint can return it directly.
-- The URL contains the raw token and is safe to store — it expires in 72h.
ALTER TABLE invitations ADD COLUMN invite_url TEXT NOT NULL DEFAULT '';
