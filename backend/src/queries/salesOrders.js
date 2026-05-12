// queries/salesOrders.js

export async function getAllSalesOrders(db, { status } = {}) {
  const values = [];
  const where  = status ? (values.push(status), `WHERE so.status = $1`) : '';

  const { rows } = await db.query(`
    SELECT
      so.id,
      c.name        AS customer,
      so.status,
      so.expected_date,
      so.created_at,
      COUNT(sol.id)                             AS line_count,
      SUM(sol.quantity_ordered * sol.unit_price) AS total_value
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
    ${where}
    GROUP BY so.id, c.name
    ORDER BY so.created_at DESC
  `, values);
  return rows;
}

export async function getSalesOrderById(db, id) {
  const { rows: [so] } = await db.query(`
    SELECT so.*, c.name AS customer_name
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE so.id = $1
  `, [id]);
  if (!so) return null;

  const { rows: lines } = await db.query(`
    SELECT
      sol.*,
      i.sku,
      i.name AS item_name,
      w.name AS source_warehouse
    FROM sales_order_lines sol
    JOIN items i ON i.id = sol.item_id
    LEFT JOIN warehouses w ON w.id = sol.source_warehouse_id
    WHERE sol.so_id = $1
    ORDER BY sol.id
  `, [id]);

  return { ...so, lines };
}

export async function createSalesOrder(db, { customer_id, shipping_address, expected_date, lines }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(`
      INSERT INTO sales_orders (customer_id, shipping_address, expected_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [customer_id, shipping_address ?? null, expected_date ?? null]);

    for (const line of lines) {
      await client.query(`
        INSERT INTO sales_order_lines
          (so_id, item_id, quantity_ordered, unit_price, source_warehouse_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [so.id, line.item_id, line.quantity_ordered, line.unit_price, line.source_warehouse_id ?? null]);
    }

    await client.query('COMMIT');
    return getSalesOrderById(client, so.id);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Edit an SO. Only allowed while status is DRAFT.
 * If `lines` is provided, ALL existing lines are replaced wholesale.
 */
export async function updateSalesOrder(db, id, { customer_id, shipping_address, expected_date, lines }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(
      `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!so) { await client.query('ROLLBACK'); return null; }
    if (so.status !== 'DRAFT') {
      throw new Error('Only DRAFT sales orders can be edited. Cancel and recreate if needed.');
    }

    const headerUpdates = [];
    const headerValues  = [];
    if (customer_id      !== undefined) headerUpdates.push(`customer_id = $${headerValues.push(customer_id)}`);
    if (shipping_address !== undefined) headerUpdates.push(`shipping_address = $${headerValues.push(shipping_address)}`);
    if (expected_date    !== undefined) headerUpdates.push(`expected_date = $${headerValues.push(expected_date)}`);
    if (headerUpdates.length > 0) {
      headerUpdates.push(`updated_at = now()`);
      headerValues.push(id);
      await client.query(
        `UPDATE sales_orders SET ${headerUpdates.join(', ')} WHERE id = $${headerValues.length}`,
        headerValues
      );
    }

    if (lines) {
      await client.query(`DELETE FROM sales_order_lines WHERE so_id = $1`, [id]);
      for (const line of lines) {
        await client.query(`
          INSERT INTO sales_order_lines
            (so_id, item_id, quantity_ordered, unit_price, source_warehouse_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, line.item_id, line.quantity_ordered, line.unit_price, line.source_warehouse_id ?? null]);
      }
    }

    await client.query('COMMIT');
    return getSalesOrderById(client, id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SO transitions — SHIPPED requires /ship endpoint (inventory side effects).
const SO_TRANSITIONS = {
  DRAFT:             ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:         ['CANCELLED'],
  PARTIALLY_SHIPPED: ['CANCELLED'],   // legacy
  SHIPPED:           [],
  DELIVERED:         [],              // legacy
  CANCELLED:         [],
};

export async function updateSalesOrderStatus(db, id, status) {
  const { rows: [current] } = await db.query(
    `SELECT status FROM sales_orders WHERE id = $1`,
    [id]
  );
  if (!current) return null;
  const allowed = SO_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Cannot change status from ${current.status} to ${status}. ` +
      (current.status === 'CONFIRMED' && status === 'SHIPPED'
        ? 'Use the Ship action — it deducts stock from each line\'s source warehouse.'
        : 'Invalid transition.')
    );
  }
  const { rows } = await db.query(
    `UPDATE sales_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] ?? null;
}

/**
 * Ship a CONFIRMED SO. Atomically ships every remaining line from the line's
 * own source_warehouse_id (NOT a single picked warehouse), checks stock,
 * records inventory transactions, and sets status to SHIPPED (terminal).
 */
export async function shipSalesOrder(db, { id, created_by }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(
      `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!so) { await client.query('ROLLBACK'); return null; }
    if (!['CONFIRMED', 'PARTIALLY_SHIPPED'].includes(so.status)) {
      throw new Error(`Cannot ship an SO with status ${so.status}. Only CONFIRMED orders can be shipped.`);
    }

    const { rows: lines } = await client.query(
      `SELECT id, item_id, quantity_ordered, quantity_shipped, source_warehouse_id
         FROM sales_order_lines WHERE so_id = $1`,
      [id]
    );
    if (lines.length === 0) {
      throw new Error('Cannot ship an SO with no line items.');
    }
    const missingSource = lines.filter(ln => ln.source_warehouse_id == null);
    if (missingSource.length > 0) {
      throw new Error(
        `Cannot ship: ${missingSource.length} line(s) have no source warehouse. ` +
        `Each line must specify where the goods come from. Edit the SO to set sources first.`
      );
    }

    // Stock availability check pass — fail fast if anything's short
    for (const line of lines) {
      const remaining = Number(line.quantity_ordered) - Number(line.quantity_shipped);
      if (remaining <= 0) continue;
      const { rows: [stock] } = await client.query(
        `SELECT quantity FROM inventory WHERE warehouse_id = $1 AND item_id = $2`,
        [line.source_warehouse_id, line.item_id]
      );
      const available = stock?.quantity ?? 0;
      if (Number(available) < remaining) {
        throw new Error(`Insufficient stock for item ${line.item_id} at source warehouse: available ${available}, needed ${remaining}.`);
      }
    }

    for (const line of lines) {
      const remaining = Number(line.quantity_ordered) - Number(line.quantity_shipped);
      if (remaining <= 0) continue;

      await client.query(
        `UPDATE sales_order_lines SET quantity_shipped = quantity_ordered WHERE id = $1`,
        [line.id]
      );

      await client.query(`
        INSERT INTO inventory_transactions
          (txn_type, item_id, warehouse_id, quantity, sales_order_id, created_by)
        VALUES ('SHIPMENT', $1, $2, $3, $4, $5)
      `, [line.item_id, line.source_warehouse_id, remaining, id, created_by]);

      await client.query(`
        UPDATE inventory SET quantity = quantity - $1, updated_at = now()
        WHERE warehouse_id = $2 AND item_id = $3
      `, [remaining, line.source_warehouse_id, line.item_id]);
    }

    await client.query(
      `UPDATE sales_orders SET status = 'SHIPPED', updated_at = now() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    return getSalesOrderById(client, id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ship goods against a SO line.
 * Updates quantity_shipped, auto-advances SO status, and triggers an inventory SHIPMENT.
 */
export async function shipSalesOrderLine(db, { so_id, line_id, quantity_shipped, warehouse_id, created_by = null }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check stock first
    const { rows: [stock] } = await client.query(`
      SELECT quantity FROM inventory
      WHERE warehouse_id = $1 AND item_id = (
        SELECT item_id FROM sales_order_lines WHERE id = $2
      )
    `, [warehouse_id, line_id]);

    const available = stock?.quantity ?? 0;
    if (available < quantity_shipped) {
      throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity_shipped}`);
    }

    // Update the line
    const { rows: [line] } = await client.query(`
      UPDATE sales_order_lines
      SET quantity_shipped = quantity_shipped + $1
      WHERE id = $2 AND so_id = $3
      RETURNING *
    `, [quantity_shipped, line_id, so_id]);

    if (!line) throw new Error(`SO line ${line_id} not found on SO ${so_id}`);

    // Record inventory shipment (deduct stock)
    await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, quantity, sales_order_id, created_by)
      VALUES ('SHIPMENT', $1, $2, $3, $4, $5)
    `, [line.item_id, warehouse_id, quantity_shipped, so_id, created_by]);

    await client.query(`
      UPDATE inventory SET quantity = quantity - $1, updated_at = now()
      WHERE warehouse_id = $2 AND item_id = $3
    `, [quantity_shipped, warehouse_id, line.item_id]);

    // Auto-update SO status
    const { rows: allLines } = await client.query(
      `SELECT quantity_ordered, quantity_shipped FROM sales_order_lines WHERE so_id = $1`,
      [so_id]
    );

    const allShipped = allLines.every(l => l.quantity_shipped >= l.quantity_ordered);
    const anyShipped = allLines.some(l => l.quantity_shipped > 0);
    const newStatus  = allShipped ? 'SHIPPED' : anyShipped ? 'PARTIALLY_SHIPPED' : 'CONFIRMED';

    await client.query(
      `UPDATE sales_orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, so_id]
    );

    await client.query('COMMIT');
    return { line, new_so_status: newStatus };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
