-- Check Leave and Claim Balance Status
-- Run this to debug why balances aren't showing

\echo '=== ORGANISATIONS ==='
SELECT id, name, country_code, setup_completed_at, setup_skipped 
FROM organisations 
ORDER BY created_at DESC LIMIT 3;

\echo '\n=== EMPLOYEES ==='
SELECT id, organisation_id, full_name, email, is_active 
FROM employees 
ORDER BY created_at DESC LIMIT 5;

\echo '\n=== LEAVE POLICIES ==='
SELECT id, organisation_id, name, days_per_year, is_active 
FROM leave_policies 
ORDER BY created_at DESC LIMIT 5;

\echo '\n=== LEAVE BALANCES ==='
SELECT 
    lb.id, 
    lb.employee_id,
    e.full_name,
    lp.name as policy_name,
    lb.year,
    lb.entitled_days,
    lb.used_days,
    lb.pending_days
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id
JOIN leave_policies lp ON lp.id = lb.leave_policy_id
ORDER BY lb.created_at DESC LIMIT 10;

\echo '\n=== CLAIM CATEGORIES ==='
SELECT id, organisation_id, name, monthly_limit, currency_code, is_active 
FROM claim_categories 
ORDER BY created_at DESC LIMIT 5;

\echo '\n=== CLAIM BALANCES ==='
SELECT 
    cb.id,
    cb.employee_id,
    e.full_name,
    cc.name as category_name,
    cb.year,
    cb.month,
    cb.total_spent,
    cb.monthly_limit
FROM claim_balances cb
JOIN employees e ON e.id = cb.employee_id  
JOIN claim_categories cc ON cc.id = cb.category_id
ORDER BY cb.created_at DESC LIMIT 10;

\echo '\n=== USER → EMPLOYEE MAPPING ==='
SELECT 
    om.user_id,
    u.email as user_email,
    om.organisation_id,
    e.id as employee_id,
    e.full_name as employee_name
FROM organisation_members om
JOIN users u ON u.id = om.user_id
LEFT JOIN employees e ON e.organisation_id = om.organisation_id 
    AND LOWER(e.email) = LOWER(u.email)
ORDER BY om.created_at DESC LIMIT 5;
