-- 000039_sprint20_leave_prorate_daycount_holidays.up.sql
-- Sprint 20: WOR-35 (prorate), WOR-31 (day count type), WOR-34 (org holidays)

-- WOR-35: Leave pro-rating for partial-year employees
ALTER TABLE leave_policies ADD COLUMN prorate_first_year BOOLEAN NOT NULL DEFAULT TRUE;

-- WOR-31: Calendar vs working days distinction
ALTER TABLE leave_policies ADD COLUMN day_count_type VARCHAR(15) NOT NULL DEFAULT 'working_days'
    CHECK (day_count_type IN ('working_days', 'calendar_days'));
ALTER TABLE leave_policy_templates ADD COLUMN day_count_type VARCHAR(15) NOT NULL DEFAULT 'working_days'
    CHECK (day_count_type IN ('working_days', 'calendar_days'));

-- WOR-34: Org-level public holidays support
ALTER TABLE public_holidays ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE public_holidays ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_holidays_org ON public_holidays(organisation_id, date) WHERE organisation_id IS NOT NULL;
