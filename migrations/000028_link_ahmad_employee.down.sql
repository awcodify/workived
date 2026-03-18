-- Remove Ahmad's employee record (the one linked via user_id)
DELETE FROM employees
WHERE user_id = (SELECT id FROM users WHERE email = 'ahmad@workived.com')
  AND email = 'ahmad@workived.com';
