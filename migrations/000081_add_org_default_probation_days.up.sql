-- Org-configurable probation duration. Used to auto-fill probation_end_date
-- when HR creates a new employee. ID law: 90 days. UAE law: up to 180 days.
ALTER TABLE organisations ADD COLUMN default_probation_days INT NOT NULL DEFAULT 90;
