// queries/dashboard.js
//
// One round-trip's worth of dashboard data, all aggregated server-side so the
// renderer never pulls full tables just to count/sum them.
//
// Urgency: we don't label urgency in SQL (that logic lives once, in the
// frontend's lib/orderStatus.js). Instead we return only the in-flight orders
// whose expected_date is within the urgency window (overdue → due in 3 days),
// and the client computes the level/days. That window is small even on huge
// datasets, so the payload stays tiny.

const PO_OPEN     = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'];
const SO_OPEN     = ['DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED'];
const PO_IN_FLIGHT = ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'];
const SO_IN_FLIGHT = ['CONFIRMED', 'PARTIALLY_SHIPPED'];

export async function getDashboardStats(db) {
  const [
    counts,
    poAgg,
    soAgg,
    invAgg,
    recentPos,
    recentSos,
    urgentPos,
    urgentSos,
  ] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*) FROM items)                              AS items,
        (SELECT COUNT(*) FROM warehouses WHERE is_active = true)  AS warehouses,
        (SELECT COUNT(*) FROM suppliers  WHERE is_active = true)  AS suppliers,
        (SELECT COUNT(*) FROM customers  WHERE is_active = true)  AS customers
    `),

    db.query(`
      SELECT
        COUNT(DISTINCT po.id)                                        AS open_count,
        COALESCE(SUM(pol.quantity_ordered * pol.unit_cost), 0)       AS open_value
      FROM purchase_orders po
      LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
      WHERE po.status = ANY($1)
    `, [PO_OPEN]),

    db.query(`
      SELECT
        COUNT(DISTINCT so.id)                                        AS open_count,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0)      AS open_value
      FROM sales_orders so
      LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
      WHERE so.status = ANY($1)
    `, [SO_OPEN]),

    db.query(`
      SELECT
        COUNT(*)                          AS stock_lines,
        COALESCE(SUM(quantity), 0)        AS total_units,
        COALESCE(SUM(inv.quantity * i.value), 0) AS total_value
      FROM inventory inv
      JOIN items i ON i.id = inv.item_id
      WHERE inv.quantity > 0
    `),

    db.query(`
      SELECT po.id, s.name AS supplier, po.status, po.total_value, po.created_at
      FROM (
        SELECT po.id, po.supplier_id, po.status, po.created_at,
               SUM(pol.quantity_ordered * pol.unit_cost) AS total_value
        FROM purchase_orders po
        LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
        GROUP BY po.id
        ORDER BY po.created_at DESC
        LIMIT 5
      ) po
      JOIN suppliers s ON s.id = po.supplier_id
      ORDER BY po.created_at DESC
    `),

    db.query(`
      SELECT so.id, c.name AS customer, so.status, so.total_value, so.created_at
      FROM (
        SELECT so.id, so.customer_id, so.status, so.created_at,
               SUM(sol.quantity_ordered * sol.unit_price) AS total_value
        FROM sales_orders so
        LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
        GROUP BY so.id
        ORDER BY so.created_at DESC
        LIMIT 5
      ) so
      JOIN customers c ON c.id = so.customer_id
      ORDER BY so.created_at DESC
    `),

    // In-flight POs due within the urgency window (overdue → +3 days).
    db.query(`
      SELECT po.id, s.name AS supplier, po.status, po.expected_date
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status = ANY($1)
        AND po.expected_date IS NOT NULL
        AND po.expected_date <= CURRENT_DATE + 3
      ORDER BY po.expected_date ASC
    `, [PO_IN_FLIGHT]),

    db.query(`
      SELECT so.id, c.name AS customer, so.status, so.expected_date
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.status = ANY($1)
        AND so.expected_date IS NOT NULL
        AND so.expected_date <= CURRENT_DATE + 3
      ORDER BY so.expected_date ASC
    `, [SO_IN_FLIGHT]),
  ]);

  const c = counts.rows[0];
  return {
    counts: {
      items:      Number(c.items),
      warehouses: Number(c.warehouses),
      suppliers:  Number(c.suppliers),
      customers:  Number(c.customers),
    },
    purchaseOrders: {
      open_count: Number(poAgg.rows[0].open_count),
      open_value: Number(poAgg.rows[0].open_value),
    },
    salesOrders: {
      open_count: Number(soAgg.rows[0].open_count),
      open_value: Number(soAgg.rows[0].open_value),
    },
    inventory: {
      stock_lines: Number(invAgg.rows[0].stock_lines),
      total_units: Number(invAgg.rows[0].total_units),
      total_value: Number(invAgg.rows[0].total_value),
    },
    recentPos:  recentPos.rows,
    recentSos:  recentSos.rows,
    urgentPos:  urgentPos.rows,
    urgentSos:  urgentSos.rows,
  };
}
