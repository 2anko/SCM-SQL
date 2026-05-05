-- FKs that couldn't be declared inline due to forward references

ALTER TABLE inventory_transactions
    ADD CONSTRAINT fk_txn_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    ADD CONSTRAINT fk_txn_sales_order    FOREIGN KEY (sales_order_id)    REFERENCES sales_orders(id),
    ADD CONSTRAINT fk_txn_created_by     FOREIGN KEY (created_by)        REFERENCES users(id);
