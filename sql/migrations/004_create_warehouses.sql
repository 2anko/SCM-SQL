CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE warehouses (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    address       TEXT,
    country       VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT now()
);
