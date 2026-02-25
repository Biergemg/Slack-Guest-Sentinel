-- Add unique constraint to subscriptions.workspace_id for UPSERT operations
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_workspace_id_key UNIQUE (workspace_id);
