-- Simple seed data for Workived task redesign demo
-- Organisation: Rizki Tech
-- Creator: Ahmad Rizki

\set org_id '575c6df6-2096-408a-b924-15b33a8d1a9a'
\set todo_list '9f432045-6787-48b3-b8ba-03586ee241f0'
\set progress_list '3c4fafb0-484b-4eaa-872c-76f570e43e7e'
\set done_list '6ca129fe-cafc-42e1-a8a2-746b84232904'
\set creator '7f90df66-1567-451d-9fcf-2e3e971c44f5'
\set sarah '0c96bffe-d85b-44b1-9e64-aabb49b6eb56'
\set michael 'bb1cbcc1-e294-4387-8d5d-0cd4748a0c13'
\set lisa '75e59e06-0613-40e2-bc6e-318cbf2a4586'
\set david '8b3a8b6a-3c12-4301-81ab-3e7d4dcb6733'
\set ahmad '7f90df66-1567-451d-9fcf-2e3e971c44f5'

-- Clear existing
DELETE FROM tasks WHERE organisation_id = :'org_id';

-- TO DO tasks (6 tasks)
INSERT INTO tasks (organisation_id, task_list_id, created_by, title, description, priority, due_date, assignee_id, position)
VALUES
  -- URGENT + OVERDUE (red pulse)
  (:'org_id', :'todo_list', :'creator', 'Fix critical security vulnerability', 'CVE-2024-1234 requires immediate patch',
   'urgent', CURRENT_DATE - 2, :'sarah', 1000),
  
  -- URGENT + DUE TODAY (yellow border)
  (:'org_id', :'todo_list', :'creator', 'Complete Q2 financial report', 'Board meeting at 3PM',
   'urgent', CURRENT_DATE, :'michael', 2000),
  
  -- HIGH (purple note)
  (:'org_id', :'todo_list', :'creator', 'Design new onboarding flow', 'User feedback shows confusion',
   'high', CURRENT_DATE + 3, :'lisa', 3000),
  
  -- MEDIUM (cyan note)
  (:'org_id', :'todo_list', :'creator', 'Update API documentation', 'New endpoints need examples',
   'medium', CURRENT_DATE + 5, :'david', 4000),
  
  -- LOW + UNASSIGNED (yellow note, no avatar)
  (:'org_id', :'todo_list', :'creator', 'Organize team building event', 'Budget approved for next month',
   'low', CURRENT_DATE + 14, NULL, 5000),
  
  -- MEDIUM + NO DUE DATE
  (:'org_id', :'todo_list', :'creator', 'Research AI tools for support', 'Explore ChatGPT and Claude',
   'medium', NULL, :'ahmad', 6000);

-- IN PROGRESS tasks (4 tasks)
INSERT INTO tasks (organisation_id, task_list_id, created_by, title, description, priority, due_date, assignee_id, position)
VALUES
  -- HIGH
  (:'org_id', :'progress_list', :'creator', 'Implement real-time notifications', 'WebSocket integration',
   'high', CURRENT_DATE + 4, :'michael', 1000),
  
  -- URGENT + Soon due
  (:'org_id', :'progress_list', :'creator', 'Deploy production hotfix', 'Payment gateway bug',
   'urgent', CURRENT_DATE + 1, :'sarah', 2000),
  
  -- MEDIUM
  (:'org_id', :'progress_list', :'creator', 'QA testing employee directory', 'Test search and filters',
   'medium', CURRENT_DATE + 2, :'lisa', 3000),
  
  -- LOW
  (:'org_id', :'progress_list', :'creator', 'Refactor legacy auth code', 'Technical debt cleanup',
   'low', CURRENT_DATE + 21, :'david', 4000);

-- DONE tasks (5 tasks) - marked as completed
INSERT INTO tasks (organisation_id, task_list_id, created_by, title, description, priority, due_date, assignee_id, position, completed_at)
VALUES
  -- Recently completed
  (:'org_id', :'done_list', :'creator', 'Launch marketing campaign', 'Email and social media blast',
   'urgent', CURRENT_DATE - 1, :'sarah', 1000, NOW() - INTERVAL '1 hour'),
  
  (:'org_id', :'done_list', :'creator', 'Set up CI/CD pipeline', 'Automated testing',
   'high', CURRENT_DATE - 2, :'michael', 2000, NOW() - INTERVAL '2 days'),
  
  (:'org_id', :'done_list', :'creator', 'Conduct user interviews', 'Interviewed 15 customers',
   'medium', CURRENT_DATE - 3, :'lisa', 3000, NOW() - INTERVAL '1 day'),
  
  (:'org_id', :'done_list', :'creator', 'Update LinkedIn profile', 'New branding',
   'low', CURRENT_DATE - 10, :'ahmad', 4000, NOW() - INTERVAL '8 days'),
  
  (:'org_id', :'done_list', :'creator', 'Archive old documentation', 'Moved to archive',
   'medium', NULL, NULL, 5000, NOW() - INTERVAL '3 days');

-- Report
\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '  Seed Data Summary'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

SELECT 
  tl.name as "Column",
  COUNT(*) as "Tasks",
  COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as "Urgent",
  COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as "High",
  COUNT(CASE WHEN t.priority = 'medium' THEN 1 END) as "Medium",
  COUNT(CASE WHEN t.priority = 'low' THEN 1 END) as "Low",
  COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.completed_at IS NULL THEN 1 END) as "Overdue",
  COUNT(CASE WHEN t.due_date = CURRENT_DATE AND t.completed_at IS NULL THEN 1 END) as "Due Today"
FROM tasks t
JOIN task_lists tl ON t.task_list_id = tl.id
WHERE t.organisation_id = :'org_id'
GROUP BY tl.name, tl.position
ORDER BY tl.position;

\echo ''
\echo '✅ Done! Login as ahmad@workived.com to see the redesigned task page'
\echo ''
