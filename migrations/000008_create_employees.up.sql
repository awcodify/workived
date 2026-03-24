-- 000008_create_employees.up.sql
CREATE TABLE employees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL if not yet onboarded
    employee_code    VARCHAR(50),
    full_name        VARCHAR(255) NOT NULL,
    email            VARCHAR(255),  -- Nullable - not all employees need email
    phone            VARCHAR(30),
    gender           VARCHAR(10) CHECK (gender IN ('male', 'female')),  -- NULL = not specified
    department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
    job_title        VARCHAR(150),
    reporting_to     UUID REFERENCES employees(id) ON DELETE SET NULL,
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

    UNIQUE (organisation_id, email),
    CONSTRAINT check_employee_status_inactive_consistency CHECK (
        (status = 'inactive' AND is_active = FALSE) OR
        (status != 'inactive' AND is_active = TRUE)
    )
);

CREATE INDEX idx_employees_org            ON employees(organisation_id);
CREATE INDEX idx_employees_org_status     ON employees(organisation_id, status);
CREATE INDEX idx_employees_user           ON employees(user_id);
CREATE INDEX idx_employees_reporting_to   ON employees(reporting_to);

COMMENT ON COLUMN employees.reporting_to IS 'Manager this employee reports to (self-referencing FK). NULL = reports to nobody (typically owner/founder).';
COMMENT ON CONSTRAINT check_employee_status_inactive_consistency ON employees IS 'Ensures status and is_active fields remain synchronized: inactive status requires is_active=FALSE, all other statuses require is_active=TRUE';

-- Trigger to automatically sync is_active when status changes
CREATE OR REPLACE FUNCTION sync_employee_is_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'inactive' THEN
    NEW.is_active := FALSE;
  ELSIF OLD.status = 'inactive' AND NEW.status != 'inactive' THEN
    NEW.is_active := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_employee_is_active
  BEFORE INSERT OR UPDATE OF status ON employees
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_is_active();

COMMENT ON FUNCTION sync_employee_is_active() IS 'Automatically synchronizes is_active field when employee status changes';

CREATE TRIGGER set_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
