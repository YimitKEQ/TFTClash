-- Migration 023: Add missing host tournament columns
-- invite_only, entry_fee, rules_text needed by HostDashboardScreen tournament creation

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS invite_only boolean default false;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rules_text text;
