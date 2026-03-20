-- 000041_allow_multiple_holidays_per_date.down.sql
-- Restore UNIQUE constraint (will fail if duplicates exist)

ALTER TABLE public_holidays ADD CONSTRAINT public_holidays_country_code_date_key UNIQUE (country_code, date);
