CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS customers (
  customer_id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- optional: prevent duplicate company names
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_company_name
ON customers (company_name);