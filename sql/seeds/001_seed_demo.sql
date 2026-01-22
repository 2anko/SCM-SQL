-- Customers
INSERT INTO scm.customers (company_name, address, phone)
VALUES
  ('Acme Retail', '1 King St W, Toronto, ON', '+1-416-555-0101')
ON CONFLICT (company_name) DO NOTHING;

-- Suppliers
INSERT INTO scm.suppliers (company_name, contact_person, address, phone)
VALUES
  ('SteelWorks Inc.', 'Jane Lee', '88 Industrial Rd, Toronto, ON', '+1-416-555-0202')
ON CONFLICT (company_name) DO NOTHING;

-- Warehouses
INSERT INTO scm.warehouses (warehouse_code, warehouse_name, address, phone)
VALUES
  ('TOR-01', 'Toronto Main', '100 Warehouse Way, Toronto, ON', '+1-416-555-0303')
ON CONFLICT (warehouse_code) DO NOTHING;

-- Items
INSERT INTO scm.items (sku, item_name, item_type, unit)
VALUES
  ('RM-STEEL-001', 'Steel Sheet', 'RAW', 'kg'),
  ('FG-WIDGET-001', 'Widget', 'FINISHED', 'pcs')
ON CONFLICT (sku) DO NOTHING;
