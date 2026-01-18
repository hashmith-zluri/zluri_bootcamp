-- Migration: Fix timestamp handling to match approved_at pattern
-- This removes DEFAULT NOW() and sets timestamps explicitly when events occur

-- 1. Remove DEFAULT constraints from existing columns
ALTER TABLE query_requests ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE execution_logs ALTER COLUMN executed_at DROP DEFAULT;

-- 2. Update any existing NULL timestamps to current time
-- (This handles any existing data that might have NULL values)
UPDATE query_requests SET created_at = NOW() WHERE created_at IS NULL;
UPDATE execution_logs SET executed_at = NOW() WHERE executed_at IS NULL;

-- 3. Make the columns NOT NULL since they should always have values
ALTER TABLE query_requests ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE execution_logs ALTER COLUMN executed_at SET NOT NULL;