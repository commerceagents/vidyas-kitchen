-- Remove MY FAV CHICKEN (no photo available)
DELETE FROM menu_items WHERE name ILIKE '%MY FAV CHICKEN%';

-- Update image_url for all 17 dishes
-- Chicken
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-pepper-gravy.png'  WHERE name ILIKE '%BLACK PEPPER CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-chilly-gravy.png'  WHERE name ILIKE '%CHILLY CHICKEN GRAVY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-mom-gravy.png'     WHERE name ILIKE '%MOM%S RECIPE%' AND name ILIKE '%CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-sis-gravy.png'     WHERE name ILIKE '%SISTER%S RECIPE%' AND name ILIKE '%CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-idli-gravy.png'    WHERE name ILIKE '%IDLI SPECIAL%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-pepper-sil.png'    WHERE name ILIKE '%SISTER-IN-LAW%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-wings.png'         WHERE name ILIKE '%CHICKEN WINGS%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-chilly-dry.png'    WHERE name ILIKE '%CHILLY CHICKEN%DRY%';

-- Mutton
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-cream-curry.png'   WHERE name ILIKE '%FRESH CREAM MUTTON%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-grandma-keema.png' WHERE name ILIKE '%GRANDMA%KEEMA%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-keema-gravy.png'   WHERE name ILIKE '%MUTTON KEEMA GRAVY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-curry.png'         WHERE name ILIKE '%MUTTON CURRY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-stew.png'          WHERE name ILIKE '%MUTTON STEW%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-spicy-gravy.png'   WHERE name ILIKE '%SPICY MUTTON%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-chukka.png'        WHERE name ILIKE '%MUTTON CHUKKA%';

-- Egg
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/egg-chalna.png'        WHERE name ILIKE '%EGG CHALNA%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/egg-curry.png'         WHERE name ILIKE '%EGG CURRY%';
