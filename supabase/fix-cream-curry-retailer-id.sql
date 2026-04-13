-- Fix mis-mapped retailer_id for FRESH CREAM MUTTON CURRY
UPDATE menu_items
SET retailer_id = 'mut-cream-curry'
WHERE name ILIKE '%cream%mutton%' OR name ILIKE '%fresh cream%';

-- Verify no duplicates
SELECT retailer_id, COUNT(*) FROM menu_items GROUP BY retailer_id HAVING COUNT(*) > 1;
