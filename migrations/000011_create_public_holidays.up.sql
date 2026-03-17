-- 000011_create_public_holidays.up.sql
-- Country-level holidays — no organisation_id. Updated without code deploys.
CREATE TABLE public_holidays (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL,
    date         DATE NOT NULL,
    name         VARCHAR(150) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (country_code, date)
);

CREATE INDEX idx_holidays_country_date ON public_holidays(country_code, date);
