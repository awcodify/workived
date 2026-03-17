-- 000009_create_employee_documents.up.sql
CREATE TABLE employee_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type    VARCHAR(50) NOT NULL,   -- e.g. contract, id_card, certificate
    file_name        VARCHAR(255) NOT NULL,
    file_url         TEXT NOT NULL,          -- S3 key
    uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emp_docs_org     ON employee_documents(organisation_id);
CREATE INDEX idx_emp_docs_emp     ON employee_documents(employee_id);
