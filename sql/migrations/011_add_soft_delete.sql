ALTER TABLE customers         ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE warehouses        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE suppliers         ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE supplier_factories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
