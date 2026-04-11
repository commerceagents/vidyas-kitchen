-- VIDYA'S KITCHEN: SUPABASE SQL SCHEMA
-- Run in Supabase SQL Editor (or use as migration baseline).
-- Requires uuid-ossp for uuid_generate_v4().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (Customers, Drivers, Owner)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'customer', -- 'customer', 'driver', 'owner'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MENU ITEMS TABLE
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- against-order: 'chicken', 'mutton', 'egg'
    price DECIMAL(10, 2) NOT NULL,
    unit TEXT DEFAULT 'pc', -- 'pc', 'kg', 'pkt'
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ORDERS TABLE
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id),
    driver_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'prepping', 'out', 'delivered'
    total_amount DECIMAL(10, 2),
    delivery_address TEXT,
    delivery_slot TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDER ITEMS (The specific dishes in an order)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2)
);

-- 5. INVENTORY SLOTS (Capacity management)
CREATE TABLE inventory_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_date DATE NOT NULL,
    slot_type TEXT NOT NULL, -- 'breakfast', 'lunch'
    max_capacity INTEGER DEFAULT 20,
    current_count INTEGER DEFAULT 0,
    UNIQUE(slot_date, slot_type)
);

-- Against-order menu (client pricing 2026; subscription not in scope)
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
