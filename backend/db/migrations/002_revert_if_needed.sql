-- Temporary revert if needed (run this in Neon if you want to test without redeployment)
-- This adds back the DEFAULT constraints temporarily

ALTER TABLE query_requests ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE execution_logs ALTER COLUMN executed_at SET DEFAULT NOW();

-- Note: After running this, you should still redeploy the backend with the proper fix
-- and then run the original migration (001_fix_timestamps.sql) again