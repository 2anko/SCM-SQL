CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.factory (
    factory_id BIGSERIAL PRIMARY KEY, --TS3M[YYYY/MM/DD]
    address TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    supplier_id BIGINT NOT NULL,
    CONSTRAINT fk_supplier
        FOREIGN KEY (supplier_id) REFERENCES scm.suppliers(supplier_id)
);
