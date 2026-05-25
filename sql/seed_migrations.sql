-- One-shot seed: tell the new migration runner that all migrations up to 014
-- have already been applied by hand. Only needed on a database that pre-dates
-- the runner (e.g. your existing dev DB). A fresh install hits an empty schema
-- and the runner applies every file from scratch — no seeding needed.
--
-- Safe to re-run: ON CONFLICT DO NOTHING means a second pass adds no rows.

CREATE TABLE IF NOT EXISTS scm.schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO scm.schema_migrations (filename) VALUES
  ('001_create_customers.sql'),
  ('002_create_suppliers.sql'),
  ('003_create_items.sql'),
  ('004_create_warehouses.sql'),
  ('005_create_users.sql'),
  ('006_create_inventory_transactions.sql'),
  ('007_create_purchase_orders.sql'),
  ('008_create_sales_orders.sql'),
  ('009_create_inventory.sql'),
  ('010_create_user_roles.sql'),
  ('011_add_soft_delete.sql'),
  ('012_fk_constraints.sql'),
  ('013_create_item_pricing.sql'),
  ('014_items_value_refactor.sql')
ON CONFLICT (filename) DO NOTHING;
