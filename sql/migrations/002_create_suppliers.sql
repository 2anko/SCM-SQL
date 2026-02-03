-- make sure the schema exists
CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.suppliers (
  supplier_id TEXT PRIMARY KEY, --TS
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

