-- 000058_seed_claim_category_templates.up.sql
-- Seed default claim category templates for Indonesia (ID) and UAE (AE).
-- These appear in the "Add from template" picker when orgs create claim categories.
-- monthly_limit is in smallest currency unit (IDR has no subunit; AED = 100 fils).

INSERT INTO claim_category_templates
    (country_code, name, description, monthly_limit, currency_code, requires_receipt, budget_period, sort_order)
VALUES
    -- Indonesia
    ('ID', 'Transport',            'Daily commute and business travel reimbursement',  500000,  'IDR', FALSE, 'monthly', 1),
    ('ID', 'Meal Allowance',       'Meal and food expenses during work hours',          750000,  'IDR', FALSE, 'monthly', 2),
    ('ID', 'Medical',              'Out-of-pocket medical and health expenses',        1000000,  'IDR', TRUE,  'monthly', 3),
    ('ID', 'Communication',        'Mobile data and phone bill reimbursement',          300000,  'IDR', FALSE, 'monthly', 4),
    ('ID', 'Training & Education', 'Courses, books, and professional development',      NULL,    NULL,  TRUE,  'yearly',  5),
    ('ID', 'Entertainment',        'Client meals and business entertainment',           500000,  'IDR', TRUE,  'monthly', 6),

    -- UAE
    ('AE', 'Transport',            'Daily commute and business travel reimbursement',   50000,  'AED', FALSE, 'monthly', 1),
    ('AE', 'Meal Allowance',       'Meal and food expenses during work hours',          30000,  'AED', FALSE, 'monthly', 2),
    ('AE', 'Medical',              'Out-of-pocket medical and health expenses',         50000,  'AED', TRUE,  'monthly', 3),
    ('AE', 'Communication',        'Mobile data and phone bill reimbursement',          20000,  'AED', FALSE, 'monthly', 4),
    ('AE', 'Training & Education', 'Courses, books, and professional development',       NULL,   NULL,  TRUE,  'yearly',  5),
    ('AE', 'Entertainment',        'Client meals and business entertainment',           50000,  'AED', TRUE,  'monthly', 6)

ON CONFLICT (country_code, name) DO NOTHING;
