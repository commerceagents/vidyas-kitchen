-- Remove MY FAV CHICKEN (no photo available)
DELETE FROM menu_items WHERE name ILIKE '%MY FAV CHICKEN%';

-- Update image_url for all 17 dishes
-- Chicken
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-pepper-gravy.jpg'  WHERE name ILIKE '%BLACK PEPPER CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-chilly-gravy.jpg'  WHERE name ILIKE '%CHILLY CHICKEN GRAVY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-mom-gravy.jpg'     WHERE name ILIKE '%MOM%S RECIPE%' AND name ILIKE '%CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-sis-gravy.jpg'     WHERE name ILIKE '%SISTER%S RECIPE%' AND name ILIKE '%CHICKEN%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-idli-gravy.jpg'    WHERE name ILIKE '%IDLI SPECIAL%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-pepper-sil.jpg'    WHERE name ILIKE '%SISTER-IN-LAW%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-wings.jpg'         WHERE name ILIKE '%CHICKEN WINGS%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/chk-chilly-dry.jpg'    WHERE name ILIKE '%CHILLY CHICKEN%DRY%';

-- Mutton
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-cream-curry.jpg'   WHERE name ILIKE '%FRESH CREAM MUTTON%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-grandma-keema.jpg' WHERE name ILIKE '%GRANDMA%KEEMA%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-keema-gravy.jpg'   WHERE name ILIKE '%MUTTON KEEMA GRAVY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-curry.jpg'         WHERE name ILIKE '%MUTTON CURRY%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-stew.jpg'          WHERE name ILIKE '%MUTTON STEW%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-spicy-gravy.jpg'   WHERE name ILIKE '%SPICY MUTTON%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/mut-chukka.jpg'        WHERE name ILIKE '%MUTTON CHUKKA%';

-- Egg
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/egg-chalna.jpg'        WHERE name ILIKE '%EGG CHALNA%';
UPDATE menu_items SET image_url = 'https://vidyaskitchenhome.com/menu-images/egg-curry.jpg'         WHERE name ILIKE '%EGG CURRY%';
