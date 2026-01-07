-- make sure the schema exists
CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.suppliers (
  supplier_id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- optional: prevent duplicate supplier names
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_company_name
ON scm.suppliers (company_name);