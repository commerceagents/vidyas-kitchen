-- Wipes every order and its side effects, so testing can start from an empty
-- kitchen. Run in the Supabase SQL editor.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Only run this while the app is still in
-- testing — after launch it would delete real customers' order history.
--
-- Deliberately NOT touched, because they are configuration rather than test
-- residue: menu_items, users, drivers, festivals, dish_discount_settings,
-- ai_pricing_config, ai_pricing_decisions.

BEGIN;

-- Line items first: they reference orders(id). Most schemas set this up with
-- ON DELETE CASCADE, but deleting explicitly means this works either way.
DELETE FROM order_items;

DELETE FROM orders;

-- Cash-on-Delivery bars are earned by failing to pay for an order. With the
-- orders gone the block has nothing behind it, so clear it too — otherwise a
-- test number stays barred from COD with no visible reason why.
DELETE FROM cod_blocks;

COMMIT;

-- Restart the customer-facing counter so the first real order is #00001
-- rather than continuing from the test run. Safe to skip if you would rather
-- keep the numbering going.
ALTER SEQUENCE IF EXISTS orders_order_number_seq RESTART WITH 1;

-- Confirm the tables are empty.
SELECT
  (SELECT COUNT(*) FROM orders)      AS orders,
  (SELECT COUNT(*) FROM order_items) AS order_items,
  (SELECT COUNT(*) FROM cod_blocks)  AS cod_blocks;
