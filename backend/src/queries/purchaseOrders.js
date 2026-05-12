// queries/purchaseOrders.js

export async function getAllPurchaseOrders(db, { status } = {}) {
  const values = [];
  const where  = status ? (values.push(status), `WHERE po.status = $1`) : '';

  const { rows } = await db.query(`
    SELECT
      po.id,
      s.name        AS supplier,
      sf.name       AS factory,
      po.status,
      po.expected_date,
      po.created_at,
      COUNT(pol.id)           AS line_count,
      SUM(pol.quantity_ordered * pol.unit_cost) AS total_value
    FROM purchase_orders po
    JOIN suppliers         s  ON s.id  = po.supplier_id
    LEFT JOIN supplier_factories sf ON sf.id = po.factory_id
    LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
    ${where}
    GROUP BY po.id, s.name, sf.name
    ORDER BY po.created_at DESC
  `, values);
  return rows;
}

export async function getPurchaseOrderById(db, id) {
  // Header
  const { rows: [po] } = await db.query(`
    SELECT
      po.*,
      s.name  AS supplier_name,
      sf.name AS factory_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN supplier_factories sf ON sf.id = po.factory_id
    WHERE po.id = $1
  `, [id]);
  if (!po) return null;

  // Lines
  const { rows: lines } = await db.query(`
    SELECT
      pol.*,
      i.sku,
      i.name AS item_name,
      w.name AS destination_warehouse
    FROM purchase_order_lines pol
    JOIN items i ON i.id = pol.item_id
    LEFT JOIN warehouses w ON w.id = pol.destination_warehouse_id
    WHERE pol.po_id = $1
    ORDER BY pol.id
  `, [id]);

  return { ...po, lines };
}

export async function createPurchaseOrder(db, { supplier_id, factory_id, expected_date, lines }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(`
      INSERT INTO purchase_orders (supplier_id, factory_id, expected_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [supplier_id, factory_id ?? null, expected_date ?? null]);

    for (const line of lines) {
      await client.query(`
        INSERT INTO purchase_order_lines
          (po_id, item_id, quantity_ordered, unit_cost, destination_warehouse_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [po.id, line.item_id, line.quantity_ordered, line.unit_cost, line.destination_warehouse_id ?? null]);
    }

    await client.query('COMMIT');
    return getPurchaseOrderById(client, po.id);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Edit a PO. Only allowed while status is DRAFT.
 * If `lines` is provided, ALL existing lines are replaced wholesale.
 */
export async function updatePurchaseOrder(db, id, { supplier_id, factory_id, expected_date, lines }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      `SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!po) { await client.query('ROLLBACK'); return null; }
    if (po.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchase orders can be edited. Cancel and recreate if needed.');
    }

    // Header
    const headerUpdates = [];
    const headerValues  = [];
    if (supplier_id   !== undefined) headerUpdates.push(`supplier_id = $${headerValues.push(supplier_id)}`);
    if (factory_id    !== undefined) headerUpdates.push(`factory_id = $${headerValues.push(factory_id)}`);
    if (expected_date !== undefined) headerUpdates.push(`expected_date = $${headerValues.push(expected_date)}`);
    if (headerUpdates.length > 0) {
      headerUpdates.push(`updated_at = now()`);
      headerValues.push(id);
      await client.query(
        `UPDATE purchase_orders SET ${headerUpdates.join(', ')} WHERE id = $${headerValues.length}`,
        headerValues
      );
    }

    // Lines (replace all)
    if (lines) {
      await client.query(`DELETE FROM purchase_order_lines WHERE po_id = $1`, [id]);
      for (const line of lines) {
        await client.query(`
          INSERT INTO purchase_order_lines
            (po_id, item_id, quantity_ordered, unit_cost, destination_warehouse_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, line.item_id, line.quantity_ordered, line.unit_cost, line.destination_warehouse_id ?? null]);
      }
    }

    await client.query('COMMIT');
    return getPurchaseOrderById(client, id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a PO. Only allowed for DRAFT or CANCELLED orders with no inventory transactions.
 * Cascades to lines via FK ON DELETE CASCADE.
 */
export async function deletePurchaseOrder(db, id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      `SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!po) { await client.query('ROLLBACK'); return false; }
    if (!['DRAFT', 'CANCELLED'].includes(po.status)) {
      throw new Error('Only DRAFT or CANCELLED purchase orders can be deleted.');
    }

    const { rows: [{ count }] } = await client.query(
      `SELECT COUNT(*) FROM inventory_transactions WHERE purchase_order_id = $1`,
      [id]
    );
    if (Number(count) > 0) {
      throw new Error('Cannot delete a PO with recorded inventory transactions.');
    }

    const { rowCount } = await client.query(`DELETE FROM purchase_orders WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark a SENT PO as RECEIVED. Atomically receives every remaining line into the
 * line's own destination_warehouse_id (NOT a single picked warehouse), records
 * inventory transactions, and sets status to RECEIVED (terminal).
 *
 * Also handles legacy PARTIALLY_RECEIVED orders.
 */
export async function receivePurchaseOrder(db, { id, created_by }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      `SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!po) { await client.query('ROLLBACK'); return null; }
    if (!['SENT', 'PARTIALLY_RECEIVED', 'CONFIRMED'].includes(po.status)) {
      throw new Error(`Cannot receive a PO with status ${po.status}. Only SENT orders can be received.`);
    }

    const { rows: lines } = await client.query(
      `SELECT id, item_id, quantity_ordered, quantity_received, destination_warehouse_id
         FROM purchase_order_lines WHERE po_id = $1`,
      [id]
    );
    if (lines.length === 0) {
      throw new Error('Cannot receive a PO with no line items.');
    }
    const missingDest = lines.filter(ln => ln.destination_warehouse_id == null);
    if (missingDest.length > 0) {
      throw new Error(
        `Cannot receive: ${missingDest.length} line(s) have no destination warehouse. ` +
        `Each line must specify where the goods go. Edit the PO to set destinations first.`
      );
    }

    for (const line of lines) {
      const remaining = Number(line.quantity_ordered) - Number(line.quantity_received);
      if (remaining <= 0) continue;

      await client.query(
        `UPDATE purchase_order_lines SET quantity_received = quantity_ordered WHERE id = $1`,
        [line.id]
      );

      await client.query(`
        INSERT INTO inventory_transactions
          (txn_type, item_id, warehouse_id, quantity, purchase_order_id, created_by)
        VALUES ('RECEIPT', $1, $2, $3, $4, $5)
      `, [line.item_id, line.destination_warehouse_id, remaining, id, created_by]);

      await client.query(`
        INSERT INTO inventory (warehouse_id, item_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, item_id)
        DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
      `, [line.destination_warehouse_id, line.item_id, remaining]);
    }

    await client.query(
      `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = now() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    return getPurchaseOrderById(client, id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Aggregate PO data for a date range.
 * `from` and `to` are YYYY-MM-DD strings, both inclusive.
 * Aggregates exclude CANCELLED POs but the list returns all statuses.
 */
export async function getPurchaseOrderSummary(db, { from, to }) {
  const { rows: byItem } = await db.query(`
    SELECT
      i.id   AS item_id,
      i.sku,
      i.name AS item,
      SUM(pol.quantity_ordered)                  AS total_quantity,
      SUM(pol.quantity_ordered * pol.unit_cost)  AS total_cost
    FROM purchase_order_lines pol
    JOIN items i             ON i.id  = pol.item_id
    JOIN purchase_orders po  ON po.id = pol.po_id
    WHERE po.created_at::date BETWEEN $1::date AND $2::date
      AND po.status = 'RECEIVED'
    GROUP BY i.id, i.sku, i.name
    ORDER BY total_cost DESC NULLS LAST
  `, [from, to]);

  const { rows: pos } = await db.query(`
    SELECT
      po.id,
      s.name  AS supplier,
      sf.name AS factory,
      po.status,
      po.expected_date,
      po.created_at,
      COUNT(pol.id)                             AS line_count,
      SUM(pol.quantity_ordered * pol.unit_cost) AS total_value
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN supplier_factories sf ON sf.id = po.factory_id
    LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
    WHERE po.created_at::date BETWEEN $1::date AND $2::date
    GROUP BY po.id, s.name, sf.name
    ORDER BY po.created_at DESC
  `, [from, to]);

  const totalCost = byItem.reduce((sum, r) => sum + Number(r.total_cost || 0), 0);
  const poCount   = pos.filter(p => p.status === 'RECEIVED').length;

  return {
    range:   { from, to },
    totals:  { po_count: poCount, total_cost: totalCost },
    by_item: byItem,
    pos,
  };
}

// Status transitions allowed via PATCH /:id/status.
// RECEIVED requires the /receive endpoint (inventory side effects).
const PO_TRANSITIONS = {
  DRAFT:              ['SENT', 'CANCELLED'],
  SENT:               ['CANCELLED'],
  CONFIRMED:          ['CANCELLED'],            // legacy
  PARTIALLY_RECEIVED: ['CANCELLED'],            // legacy
  RECEIVED:           [],
  CANCELLED:          [],
};

export async function updatePurchaseOrderStatus(db, id, status) {
  const { rows: [current] } = await db.query(
    `SELECT status FROM purchase_orders WHERE id = $1`,
    [id]
  );
  if (!current) return null;
  const allowed = PO_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Cannot change status from ${current.status} to ${status}. ` +
      (current.status === 'SENT' && status === 'RECEIVED'
        ? 'Use the Receive action — it adds stock to inventory using each line\'s destination warehouse.'
        : 'Invalid transition.')
    );
  }
  const { rows } = await db.query(`
    UPDATE purchase_orders
    SET status = $1, updated_at = now()
    WHERE id = $2
    RETURNING *
  `, [status, id]);
  return rows[0] ?? null;
}

/**
 * Receive goods against a PO line.
 * Updates quantity_received, auto-advances PO status, and triggers an inventory RECEIPT.
 */
export async function receivePurchaseOrderLine(db, { po_id, line_id, quantity_received, warehouse_id, created_by = null }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Update the line
    const { rows: [line] } = await client.query(`
      UPDATE purchase_order_lines
      SET quantity_received = quantity_received + $1
      WHERE id = $2 AND po_id = $3
      RETURNING *
    `, [quantity_received, line_id, po_id]);

    if (!line) throw new Error(`PO line ${line_id} not found on PO ${po_id}`);

    // Record inventory receipt
    await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, quantity, purchase_order_id, created_by)
      VALUES ('RECEIPT', $1, $2, $3, $4, $5)
    `, [line.item_id, warehouse_id, quantity_received, po_id, created_by]);

    await client.query(`
      INSERT INTO inventory (warehouse_id, item_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (warehouse_id, item_id)
      DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
    `, [warehouse_id, line.item_id, quantity_received]);

    // Auto-update PO status based on all lines
    const { rows: allLines } = await client.query(
      `SELECT quantity_ordered, quantity_received FROM purchase_order_lines WHERE po_id = $1`,
      [po_id]
    );

    const allReceived     = allLines.every(l => l.quantity_received >= l.quantity_ordered);
    const anyReceived     = allLines.some(l => l.quantity_received > 0);
    const newStatus       = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED';

    await client.query(
      `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, po_id]
    );

    await client.query('COMMIT');
    return { line, new_po_status: newStatus };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
