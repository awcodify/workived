ALTER TABLE employees
    ADD COLUMN work_schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN employees.work_schedule_id IS
    'Per-employee work schedule override. NULL = use org default schedule.';

CREATE INDEX idx_employees_work_schedule ON employees(work_schedule_id) WHERE work_schedule_id IS NOT NULL;
