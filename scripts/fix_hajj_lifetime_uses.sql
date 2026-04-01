-- Fix existing Hajj leave policies that were created before max_lifetime_uses was added.
-- Sets max_lifetime_uses = 1 for any policy named 'Hajj Leave' that doesn't already have it set.
-- Safe to run multiple times (idempotent).

UPDATE leave_policies
SET max_lifetime_uses = 1,
    updated_at = NOW()
WHERE LOWER(name) LIKE '%hajj%'
  AND max_lifetime_uses IS NULL
  AND is_active = TRUE;
