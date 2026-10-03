-- Read-only boards for Tableau. No phone, name, or address.
-- Run once in the Supabase SQL editor. Tableau connects with the database
-- password (the postgres user), never with the public website key.
--
-- These views stay empty until real orders exist. For the interview, open
-- tableau/demo-orders.csv and tableau/demo-items.csv first. Those rows are
-- made-up, so a demo never shows a real customer.

CREATE OR REPLACE VIEW tableau_orders
WITH (security_invoker = true) AS
SELECT
  o.order_number,
  (o.created_at AT TIME ZONE 'Asia/Kolkata')::date AS order_date,
  COALESCE(NULLIF(o.delivery_slot_kind, ''), 'unspecified') AS meal,
  CASE
    WHEN lower(COALESCE(o.payment_method, '')) = 'cod' THEN 'Cash'
    ELSE 'Online'
  END AS payment,
  o.status,
  ROUND(COALESCE(o.total_amount, 0)::numeric, 2) AS order_rupees,
  ROUND(COALESCE(o.discount_amount, 0)::numeric, 2) AS discount_rupees
FROM orders o;

CREATE OR REPLACE VIEW tableau_items
WITH (security_invoker = true) AS
SELECT
  o.order_number,
  (o.created_at AT TIME ZONE 'Asia/Kolkata')::date AS order_date,
  COALESCE(mi.name, 'Unknown dish') AS dish,
  COALESCE(mi.category, 'other') AS category,
  oi.quantity,
  ROUND(COALESCE(oi.unit_price, 0)::numeric, 2) AS unit_rupees,
  ROUND((COALESCE(oi.quantity, 0) * COALESCE(oi.unit_price, 0))::numeric, 2) AS item_rupees
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id;

REVOKE ALL ON tableau_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON tableau_items FROM PUBLIC, anon, authenticated;
