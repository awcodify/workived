-- 000008_create_employees.up.sql
CREATE TABLE employees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL if not yet onboarded
    employee_code    VARCHAR(50),
    full_name        VARCHAR(255) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    phone            VARCHAR(30),
    department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
    job_title        VARCHAR(150),
    employment_type  VARCHAR(20) NOT NULL DEFAULT 'full_time'
                         CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    status           VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'on_leave', 'probation', 'inactive')),
    start_date       DATE NOT NULL,
    end_date         DATE,
    base_salary      BIGINT,                     -- smallest currency unit
    salary_currency  CHAR(3),                    -- IDR, AED, MYR, SGD
    custom_fields    JSONB,                      -- Pro tier only
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organisation_id, email)
);

CREATE INDEX idx_employees_org            ON employees(organisation_id);
CREATE INDEX idx_employees_org_status     ON employees(organisation_id, status);
CREATE INDEX idx_employees_user           ON employees(user_id);

CREATE TRIGGER set_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
