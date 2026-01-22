BEGIN;
-- Find ids (safe way)
SELECT supplier_id FROM scm.suppliers WHERE company_name='SteelWorks Inc.';
SELECT warehouse_id FROM scm.warehouses WHERE warehouse_code='TOR-01';
SELECT item_id FROM scm.items WHERE sku='RM-STEEL-001';

-- Create PO
INSERT INTO scm.purchase_orders (po_number, supplier_id, ship_to_warehouse_id, status, note)
VALUES ('PO-2026-0002',
        (SELECT supplier_id FROM scm.suppliers WHERE company_name='SteelWorks Inc.'),
        (SELECT warehouse_id FROM scm.warehouses WHERE warehouse_code='TOR-01'),
        'SUBMITTED',
        'Demo PO');

-- Add PO line
INSERT INTO scm.purchase_order_lines (purchase_order_id, item_id, qty_ordered, unit_cost)
VALUES (
  (SELECT purchase_order_id FROM scm.purchase_orders WHERE po_number='PO-2026-0002'),
  (SELECT item_id FROM scm.items WHERE sku='RM-STEEL-001'),
  100, 2.50
);

INSERT INTO scm.inventory_transactions (warehouse_id, item_id, qty, txn_type, reference_type, reference_id, note)
VALUES (
  (SELECT warehouse_id FROM scm.warehouses WHERE warehouse_code='TOR-01'),
  (SELECT item_id FROM scm.items WHERE sku='RM-STEEL-001'),
  100, 'RECEIPT', 'PO',
  (SELECT purchase_order_id FROM scm.purchase_orders WHERE po_number='PO-2026-0002'),
  'Received PO-2026-0002'
);

INSERT INTO scm.sales_orders (so_number, customer_id, ship_from_warehouse_id, status, note)
VALUES ('SO-2026-0002',
        (SELECT customer_id FROM scm.customers WHERE company_name='Acme Retail'),
        (SELECT warehouse_id FROM scm.warehouses WHERE warehouse_code='TOR-01'),
        'CONFIRMED',
        'Demo SO');

INSERT INTO scm.sales_order_lines (sales_order_id, item_id, qty_ordered, unit_price)
VALUES (
  (SELECT sales_order_id FROM scm.sales_orders WHERE so_number='SO-2026-0002'),
  (SELECT item_id FROM scm.items WHERE sku='RM-STEEL-001'),
  5, 12.50
);

INSERT INTO scm.inventory_transactions (warehouse_id, item_id, qty, txn_type, reference_type, reference_id, note)
VALUES (
  (SELECT warehouse_id FROM scm.warehouses WHERE warehouse_code='TOR-01'),
  (SELECT item_id FROM scm.items WHERE sku='RM-STEEL-001'),
  -5, 'SALE_SHIP', 'SO',
  (SELECT sales_order_id FROM scm.sales_orders WHERE so_number='SO-2026-0002'),
  'Shipped SO-2026-0002'
);

ROLLBACK;