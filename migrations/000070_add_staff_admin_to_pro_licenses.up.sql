-- Add staff admin audit tracking to pro_licenses
-- Staff admins (internal_admins table) can create/modify licenses
-- but they're separate from regular users, so we need a separate FK

ALTER TABLE pro_licenses
ADD COLUMN created_by_staff_admin_id UUID REFERENCES internal_admins(id) ON DELETE SET NULL;

CREATE INDEX idx_pro_licenses_staff_admin ON pro_licenses(created_by_staff_admin_id);
