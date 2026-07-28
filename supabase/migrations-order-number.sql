-- Add auto-incrementing order_number to orders table
-- Displays as #00001, #00002, etc. in the dashboard

CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 1;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE DEFAULT nextval('orders_order_number_seq');

-- Backfill existing rows in created_at order so old orders get sensible numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders
SET order_number = numbered.rn
FROM numbered
WHERE orders.id = numbered.id;

-- Reset sequence to continue after the highest existing number
SELECT setval('orders_order_number_seq', COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1, false);
