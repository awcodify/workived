-- Migration: Create internal_admins table
-- Purpose: Separate authentication system for Workived internal staff
-- Security: Completely isolated from users table - no foreign key relationship

CREATE TABLE internal_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for fast email lookup during authentication
CREATE INDEX idx_internal_admins_email ON internal_admins(email) WHERE is_active = true;

-- Comment for documentation
COMMENT ON TABLE internal_admins IS 'Workived internal staff - completely separate authentication from regular users';
COMMENT ON COLUMN internal_admins.email IS 'Internal admin email - independent from users table';
COMMENT ON COLUMN internal_admins.password_hash IS 'Bcrypt password hash';
COMMENT ON COLUMN internal_admins.is_active IS 'Soft delete flag - set to false to revoke access';

