-- Add a fax number to the two "company" entities: suppliers and customers.
-- Nullable free-text (same shape as the existing phone columns). IF NOT EXISTS
-- keeps the migration safely re-runnable.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS fax VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fax VARCHAR(50);
