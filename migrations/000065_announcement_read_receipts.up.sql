CREATE TABLE announcement_read_receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (announcement_id, employee_id)
);

CREATE INDEX idx_ann_reads_org ON announcement_read_receipts(organisation_id);
CREATE INDEX idx_ann_reads_emp ON announcement_read_receipts(organisation_id, employee_id);
