CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.warehouses (
  warehouse_id   BIGSERIAL PRIMARY KEY,
  warehouse_code TEXT NOT NULL UNIQUE,   -- e.g., "TOR-01"
  warehouse_name TEXT NOT NULL,          -- e.g., "Toronto Main"
  address        TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
