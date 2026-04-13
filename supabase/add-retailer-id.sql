-- Add retailer_id column (matches the Content ID in Meta catalog)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS retailer_id TEXT;

-- Populate retailer_id from image_url (e.g. .../chk-pepper-gravy.jpg → chk-pepper-gravy)
UPDATE menu_items
SET retailer_id = regexp_replace(
  regexp_replace(image_url, '^.*/menu-images/', ''),
  '\.[^.]+$', ''
)
WHERE image_url IS NOT NULL;

-- Verify
SELECT name, retailer_id FROM menu_items ORDER BY category, name;
