-- make sure the schema exists
CREATE SCHEMA IF NOT EXISTS scm;

-- Suppliers: the top-level vendor
CREATE TABLE suppliers (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(50),
    address       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Factories: many per supplier
CREATE TABLE supplier_factories (
    id            SERIAL PRIMARY KEY,
    supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    address       TEXT,
    country       VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Representatives: exactly one per factory (1:1)
CREATE TABLE factory_rep (
    id            SERIAL PRIMARY KEY,
    factory_id    INT NOT NULL UNIQUE REFERENCES supplier_factories(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(50)
);

