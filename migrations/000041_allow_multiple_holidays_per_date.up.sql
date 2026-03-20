-- 000041_allow_multiple_holidays_per_date.up.sql
-- Allow multiple holidays on the same date (e.g., Isra Mi'raj + Eid Al-Fitr Day 1 on same day)

ALTER TABLE public_holidays DROP CONSTRAINT IF EXISTS public_holidays_country_code_date_key;
