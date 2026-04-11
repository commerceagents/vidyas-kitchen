-- One-off: fix PEPPAR → PEPPER if you already seeded the old PDF spelling.
UPDATE menu_items SET name = 'BLACK PEPPER CHICKEN GRAVY' WHERE name = 'BLACK PEPPAR CHICKEN GRAVY';
UPDATE menu_items SET name = 'PEPPER CHICKEN (SISTER-IN-LAW''S RECIPE)' WHERE name = 'PEPPAR CHICKEN (SISTER-IN-LAW''S RECIPE)';
