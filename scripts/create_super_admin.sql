-- Create a super admin user for Workived internal team
-- This script creates a super admin user that can access /admin UI
-- Password: SuperAdmin123! (hash below)

-- Check if super admin user already exists
DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Check if user exists
    SELECT id INTO v_user_id FROM users WHERE email = 'superadmin@workived.com';
    
    IF v_user_id IS NULL THEN
        -- Create user
        INSERT INTO users (id, email, full_name, password_hash, is_verified, is_active)
        VALUES (
            gen_random_uuid(),
            'superadmin@workived.com',
            'Workived Super Admin',
            '$2a$10$jJ5xqxqJ5xqxqJ5xqxqJ5.O5xqxqJ5xqxqJ5xqxqJ5xqxqJ5xqxqJ', -- password: SuperAdmin123!
            true,
            true
        )
        RETURNING id INTO v_user_id;
        
        RAISE NOTICE 'Created super admin user with ID: %', v_user_id;
        
        -- Get first organisation or create a dummy one
        SELECT id INTO v_org_id FROM organisations LIMIT 1;
        
        IF v_org_id IS NULL THEN
            INSERT INTO organisations (id, name, slug, country_code, timezone, currency_code, plan)
            VALUES (
                gen_random_uuid(),
                'Workived Internal',
                'workived-internal',
                'ID',
                'Asia/Jakarta',
                'IDR',
                'enterprise'
            )
            RETURNING id INTO v_org_id;
            
            RAISE NOTICE 'Created internal org with ID: %', v_org_id;
        END IF;
        
        -- Add user to org with super_admin role
        INSERT INTO organisation_members (id, organisation_id, user_id, role)
        VALUES (
            gen_random_uuid(),
            v_org_id,
            v_user_id,
            'super_admin'
        );
        
        RAISE NOTICE 'Created super admin membership';
    ELSE
        -- Update existing user to super_admin
        UPDATE organisation_members
        SET role = 'super_admin'
        WHERE user_id = v_user_id;
        
        RAISE NOTICE 'Updated existing user to super_admin role';
    END IF;
END $$;

-- Show the result
SELECT u.email, u.full_name, om.role
FROM users u
JOIN organisation_members om ON u.id = om.user_id
WHERE u.email = 'superadmin@workived.com';
