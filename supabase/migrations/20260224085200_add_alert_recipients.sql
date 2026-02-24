-- Adds alert_recipients column to workspaces for Multi-admin DM alerts
-- Initializes it with the installed_by user

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS alert_recipients TEXT[] DEFAULT '{}'::TEXT[];

UPDATE workspaces
  SET alert_recipients = ARRAY[installed_by]
  WHERE array_length(alert_recipients, 1) IS NULL OR array_length(alert_recipients, 1) = 0;
