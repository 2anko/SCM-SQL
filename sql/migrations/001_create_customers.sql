CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE customers (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(50),
    address       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

