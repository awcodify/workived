CREATE TABLE attendance_corrections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    record_id           UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    date                DATE NOT NULL,
    original_clock_in   TIMESTAMPTZ,
    original_clock_out  TIMESTAMPTZ,
    requested_clock_in  TIMESTAMPTZ,
    requested_clock_out TIMESTAMPTZ,
    reason              TEXT NOT NULL CHECK (char_length(reason) >= 10),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by         UUID REFERENCES employees(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_corrections_org ON attendance_corrections(organisation_id);
CREATE INDEX idx_attendance_corrections_emp ON attendance_corrections(organisation_id, employee_id);
CREATE INDEX idx_attendance_corrections_status ON attendance_corrections(organisation_id, status) WHERE status = 'pending';
