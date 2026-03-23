-- Seed config data for Workived
-- Feature flags and admin configuration
-- Run after migrations

-- Feature Flags
INSERT INTO feature_flags (feature_key, name, description, is_enabled, scope) VALUES
    ('tasks', 'Task Management', 'Enable task lists, tasks, and task comments', TRUE, 'global'),
    ('reports', 'Reports', 'Enable reports and analytics pages', FALSE, 'global'),
    ('announcements', 'Announcements', 'Enable company announcements', TRUE, 'global'),
    ('claims', 'Claims/Reimbursements', 'Enable expense claims feature', TRUE, 'global'),
    ('attendance_geolocation', 'Attendance Geolocation', 'Require GPS location for clock in/out', FALSE, 'global'),
    ('pro_custom_reports', 'Custom Reports (Pro)', 'Custom report builder - Pro tier only', FALSE, 'global'),
    ('pro_advanced_analytics', 'Advanced Analytics (Pro)', 'Advanced analytics dashboard - Pro tier only', FALSE, 'global')
ON CONFLICT (feature_key) DO NOTHING;

-- Admin Config
INSERT INTO admin_config (key, value, description) VALUES
    ('maintenance_mode', 'false', 'Enable maintenance mode - blocks all user access'),
    ('allow_free_signups', 'true', 'Allow new free tier signups'),
    ('max_free_tier_orgs', '1000', 'Maximum number of free tier organisations')
ON CONFLICT (key) DO NOTHING;

SELECT 
    (SELECT COUNT(*) FROM feature_flags) || ' feature flags' as feature_flags_count,
    (SELECT COUNT(*) FROM admin_config) || ' admin config entries' as admin_config_count;
