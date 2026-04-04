-- 000052_add_job_title_id_to_employees.up.sql
ALTER TABLE employees
    ADD COLUMN job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_job_title ON employees(job_title_id);

COMMENT ON COLUMN employees.job_title_id IS 'Foreign key to standardized job titles. Keep job_title text field for backward compatibility during migration.';
