CREATE SCHEMA IF NOT EXISTS scm;

CREATE TYPE so_status AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE sales_orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INT NOT NULL REFERENCES customers(id),
    status          so_status NOT NULL DEFAULT 'DRAFT',
    shipping_address TEXT,
    expected_date   DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sales_order_lines (
    id              SERIAL PRIMARY KEY,
    so_id           INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    item_id         INT NOT NULL REFERENCES items(id),
    quantity_ordered    NUMERIC(12, 4) NOT NULL,
    quantity_shipped    NUMERIC(12, 4) NOT NULL DEFAULT 0,
    unit_price          NUMERIC(12, 2) NOT NULL,
    source_warehouse_id INT REFERENCES warehouses(id)
);
