CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE items (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    unit_of_measure VARCHAR(50) DEFAULT 'each',  -- e.g. 'kg', 'box', 'each'
    unit_cost       NUMERIC(12, 2),
    unit_price      NUMERIC(12, 2),
    created_at      TIMESTAMPTZ DEFAULT now()
);