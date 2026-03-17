-- 000025_seed_public_holidays_indonesia.up.sql
-- Indonesian national public holidays 2025-2027
-- Source: Government of Indonesia — updated without code deploys.

INSERT INTO public_holidays (country_code, date, name) VALUES
-- 2025
('ID', '2025-01-01', 'New Year''s Day'),
('ID', '2025-01-27', 'Chinese New Year'),
('ID', '2025-01-29', 'Isra Mi''raj'),
('ID', '2025-03-29', 'Nyepi (Balinese New Year)'),
('ID', '2025-03-30', 'Good Sunday'),
('ID', '2025-04-18', 'Good Friday'),
('ID', '2025-03-31', 'Eid Al-Fitr Day 1'),
('ID', '2025-04-01', 'Eid Al-Fitr Day 2'),
('ID', '2025-05-01', 'Labour Day'),
('ID', '2025-05-12', 'Vesak Day'),
('ID', '2025-05-29', 'Ascension of Jesus Christ'),
('ID', '2025-06-01', 'Pancasila Day'),
('ID', '2025-06-06', 'Eid Al-Adha'),
('ID', '2025-06-27', 'Islamic New Year'),
('ID', '2025-08-17', 'Independence Day'),
('ID', '2025-09-05', 'Prophet Muhammad''s Birthday'),
('ID', '2025-12-25', 'Christmas Day'),
('ID', '2025-12-26', 'Christmas Holiday'),

-- 2026
('ID', '2026-01-01', 'New Year''s Day'),
('ID', '2026-02-17', 'Chinese New Year'),
('ID', '2026-03-20', 'Isra Mi''raj'),
('ID', '2026-03-19', 'Nyepi (Balinese New Year)'),
('ID', '2026-03-20', 'Eid Al-Fitr Day 1'),
('ID', '2026-03-21', 'Eid Al-Fitr Day 2'),
('ID', '2026-04-03', 'Good Friday'),
('ID', '2026-05-01', 'Labour Day'),
('ID', '2026-05-14', 'Ascension of Jesus Christ'),
('ID', '2026-05-27', 'Eid Al-Adha'),
('ID', '2026-06-01', 'Pancasila Day'),
('ID', '2026-06-16', 'Vesak Day'),
('ID', '2026-06-17', 'Islamic New Year'),
('ID', '2026-08-17', 'Independence Day'),
('ID', '2026-08-27', 'Prophet Muhammad''s Birthday'),
('ID', '2026-12-25', 'Christmas Day'),

-- 2027
('ID', '2027-01-01', 'New Year''s Day'),
('ID', '2027-02-06', 'Chinese New Year'),
('ID', '2027-03-09', 'Isra Mi''raj'),
('ID', '2027-03-08', 'Nyepi (Balinese New Year)'),
('ID', '2027-03-10', 'Eid Al-Fitr Day 1'),
('ID', '2027-03-11', 'Eid Al-Fitr Day 2'),
('ID', '2027-03-26', 'Good Friday'),
('ID', '2027-05-01', 'Labour Day'),
('ID', '2027-05-16', 'Eid Al-Adha'),
('ID', '2027-05-06', 'Ascension of Jesus Christ'),
('ID', '2027-06-01', 'Pancasila Day'),
('ID', '2027-06-07', 'Islamic New Year'),
('ID', '2027-06-05', 'Vesak Day'),
('ID', '2027-08-17', 'Independence Day'),
('ID', '2027-08-17', 'Prophet Muhammad''s Birthday'),
('ID', '2027-12-25', 'Christmas Day')

ON CONFLICT (country_code, date) DO NOTHING;
