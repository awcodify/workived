-- 000026_seed_public_holidays_uae.up.sql
-- UAE public holidays 2025-2027
-- Source: UAE Federal Authority for Government Human Resources

INSERT INTO public_holidays (country_code, date, name) VALUES
-- 2025
('AE', '2025-01-01', 'New Year''s Day'),
('AE', '2025-01-29', 'Prophet Muhammad''s Birthday'),
('AE', '2025-03-30', 'Eid Al-Fitr Day 1'),
('AE', '2025-03-31', 'Eid Al-Fitr Day 2'),
('AE', '2025-04-01', 'Eid Al-Fitr Day 3'),
('AE', '2025-06-06', 'Arafat Day'),
('AE', '2025-06-07', 'Eid Al-Adha Day 1'),
('AE', '2025-06-08', 'Eid Al-Adha Day 2'),
('AE', '2025-06-09', 'Eid Al-Adha Day 3'),
('AE', '2025-06-26', 'Islamic New Year'),
('AE', '2025-08-04', 'Founding Day'),
('AE', '2025-09-02', 'Prophet Muhammad''s Birthday'),
('AE', '2025-12-01', 'Commemoration Day'),
('AE', '2025-12-02', 'National Day'),
('AE', '2025-12-03', 'National Day Holiday'),

-- 2026
('AE', '2026-01-01', 'New Year''s Day'),
('AE', '2026-03-20', 'Eid Al-Fitr Day 1'),
('AE', '2026-03-21', 'Eid Al-Fitr Day 2'),
('AE', '2026-03-22', 'Eid Al-Fitr Day 3'),
('AE', '2026-05-27', 'Arafat Day'),
('AE', '2026-05-28', 'Eid Al-Adha Day 1'),
('AE', '2026-05-29', 'Eid Al-Adha Day 2'),
('AE', '2026-05-30', 'Eid Al-Adha Day 3'),
('AE', '2026-06-16', 'Islamic New Year'),
('AE', '2026-08-04', 'Founding Day'),
('AE', '2026-08-22', 'Prophet Muhammad''s Birthday'),
('AE', '2026-12-01', 'Commemoration Day'),
('AE', '2026-12-02', 'National Day'),
('AE', '2026-12-03', 'National Day Holiday'),

-- 2027
('AE', '2027-01-01', 'New Year''s Day'),
('AE', '2027-03-09', 'Eid Al-Fitr Day 1'),
('AE', '2027-03-10', 'Eid Al-Fitr Day 2'),
('AE', '2027-03-11', 'Eid Al-Fitr Day 3'),
('AE', '2027-05-16', 'Arafat Day'),
('AE', '2027-05-17', 'Eid Al-Adha Day 1'),
('AE', '2027-05-18', 'Eid Al-Adha Day 2'),
('AE', '2027-05-19', 'Eid Al-Adha Day 3'),
('AE', '2027-06-05', 'Islamic New Year'),
('AE', '2027-08-04', 'Founding Day'),
('AE', '2027-08-11', 'Prophet Muhammad''s Birthday'),
('AE', '2027-12-01', 'Commemoration Day'),
('AE', '2027-12-02', 'National Day'),
('AE', '2027-12-03', 'National Day Holiday')

ON CONFLICT (country_code, date) DO NOTHING;
