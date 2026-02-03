CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.personnel(
    pid BIGSERIAL PRIMARY KEY, --TS3M[YYYY/MM/DD]-00
    address TEXT NOT NULL REFERENCES scm.factory(address),
    phone_num VARCHAR(20) NOT NULL,
    name TEXT NOT NULL,
    factory_id BIGINT NOT NULL,
    CONSTRAINT fk_factory
        FOREIGN KEY (factory_id) REFERENCES scm.factory(factory_id)
);