-- Seed demo data for local development
-- User: ahmad@workived.com / password123

DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_dept_eng_id UUID;
    v_dept_ops_id UUID;
BEGIN
    -- Skip if demo user already exists
    IF EXISTS (SELECT 1 FROM users WHERE email = 'ahmad@workived.com') THEN
        RAISE NOTICE 'Demo data already seeded, skipping.';
        RETURN;
    END IF;

    -- 1. Create demo user
    INSERT INTO users (id, email, password_hash, full_name, is_verified, is_active)
    VALUES (
        gen_random_uuid(),
        'ahmad@workived.com',
        '$2a$10$KjpGorJ68Vj/mwvfpj6UR.Z2hMgpUiNoja5bAAfiA4iXyWP3M3g1O', -- password123
        'Ahmad Rizki',
        TRUE,
        TRUE
    ) RETURNING id INTO v_user_id;

    -- 2. Create demo organisation
    INSERT INTO organisations (id, name, slug, country_code, timezone, currency_code, plan)
    VALUES (
        gen_random_uuid(),
        'Rizki Tech',
        'rizki-tech',
        'ID',
        'Asia/Jakarta',
        'IDR',
        'free'
    ) RETURNING id INTO v_org_id;

    -- 3. Link user as owner
    INSERT INTO organisation_members (organisation_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner');

    -- 4. Create departments
    INSERT INTO departments (id, organisation_id, name, is_active)
    VALUES (gen_random_uuid(), v_org_id, 'Engineering', TRUE)
    RETURNING id INTO v_dept_eng_id;

    INSERT INTO departments (id, organisation_id, name, is_active)
    VALUES (gen_random_uuid(), v_org_id, 'Operations', TRUE)
    RETURNING id INTO v_dept_ops_id;

    -- 5. Create a default work schedule
    INSERT INTO work_schedules (organisation_id, name, work_days, start_time, end_time, is_default, is_active)
    VALUES (v_org_id, 'Standard', '{1,2,3,4,5}', '09:00', '18:00', TRUE, TRUE);

    -- 6. Create demo employees
    INSERT INTO employees (organisation_id, full_name, email, phone, job_title, department_id, employment_type, status, start_date, is_active)
    VALUES
        (v_org_id, 'Budi Santoso', 'budi@rizkitech.com', '+6281234567890', 'Senior Engineer', v_dept_eng_id, 'full_time', 'active', '2025-01-15', TRUE),
        (v_org_id, 'Siti Nurhaliza', 'siti@rizkitech.com', '+6281234567891', 'Product Designer', v_dept_eng_id, 'full_time', 'active', '2025-02-01', TRUE),
        (v_org_id, 'Reza Pratama', 'reza@rizkitech.com', '+6281234567892', 'Backend Engineer', v_dept_eng_id, 'full_time', 'active', '2025-03-10', TRUE),
        (v_org_id, 'Dewi Lestari', 'dewi@rizkitech.com', '+6281234567893', 'Office Manager', v_dept_ops_id, 'full_time', 'active', '2025-01-20', TRUE),
        (v_org_id, 'Adi Nugroho', 'adi@rizkitech.com', '+6281234567894', 'Intern', v_dept_eng_id, 'intern', 'probation', '2026-03-01', TRUE);

    RAISE NOTICE 'Demo data seeded: user=%, org=%', v_user_id, v_org_id;
END $$;
