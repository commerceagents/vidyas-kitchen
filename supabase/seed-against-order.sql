-- Replace against-order menu rows (run after backup if `order_items` references old IDs).
-- Safe if `menu_items` has no dependent rows, or use a fresh project.

DELETE FROM menu_items WHERE category IN ('chicken', 'mutton', 'egg', 'breakfast', 'lunch', 'sides');

INSERT INTO menu_items (name, category, price, unit) VALUES
('BLACK PEPPER CHICKEN GRAVY', 'chicken', 799.00, 'order'),
('CHILLY CHICKEN GRAVY', 'chicken', 1199.00, 'order'),
('CHICKEN GRAVY (MOM''S RECIPE)', 'chicken', 699.00, 'order'),
('CHICKEN GRAVY SISTER''S RECIPE', 'chicken', 699.00, 'order'),
('IDLI SPECIAL CHICKEN GRAVY', 'chicken', 849.00, 'order'),
('PEPPER CHICKEN (SISTER-IN-LAW''S RECIPE)', 'chicken', 849.00, 'order'),
('CHICKEN WINGS', 'chicken', 749.00, 'order'),
('CHILLY CHICKEN (DRY)', 'chicken', 1199.00, 'order'),
('MY FAV CHICKEN', 'chicken', 649.00, 'order'),
('FRESH CREAM MUTTON CURRY', 'mutton', 2099.00, 'order'),
('GRANDMA MUTTON KEEMA', 'mutton', 1949.00, 'order'),
('MUTTON KEEMA GRAVY', 'mutton', 1999.00, 'order'),
('MUTTON CURRY', 'mutton', 1949.00, 'order'),
('MUTTON STEW', 'mutton', 2100.00, 'order'),
('SPICY MUTTON GRAVY', 'mutton', 1999.00, 'order'),
('MUTTON CHUKKA', 'mutton', 1950.00, 'order'),
('EGG CHALNA', 'egg', 349.00, 'order'),
('EGG CURRY', 'egg', 299.00, 'order');
