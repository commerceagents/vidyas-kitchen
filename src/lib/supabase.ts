import { createClient } from "@supabase/supabase-js";

const isDummy = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("dummy-supabase-project");

const mockOrders = [
  {
    id: "1001",
    order_number: 1,
    status: "paid",
    phone_number: "+919876543210",
    total_amount: 2415,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    delivery_slot: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    delivery_slot_kind: "lunch",
    order_items: [
      {
        quantity: 1,
        unit_price: 799,
        menu_item_id: "a12ff7e5-23c4-49a4-92db-6c3e03888c2f",
        menu_items: { name: "Black Pepper Chicken Gravy (1kg)", price: 799 },
      },
      {
        quantity: 1,
        unit_price: 699,
        menu_item_id: "fc3317ef-3ce5-48dc-abd6-1b43d13af6b3",
        menu_items: { name: "Mom's Recipe Chicken Gravy (1kg)", price: 699 },
      },
      {
        quantity: 1,
        unit_price: 449,
        menu_item_id: "fc3317ef-3ce5-48dc-abd6-1b43d13af6b3",
        menu_items: { name: "Mom's Recipe - Chicken Gravy (500gm)", price: 449 },
      },
      {
        quantity: 1,
        unit_price: 299,
        menu_item_id: "9e314bf8-6faa-4663-8d2d-d7246a0cc91b",
        menu_items: { name: "Egg Curry (1kg)", price: 299 },
      },
    ],
  },
  {
    id: "1002",
    order_number: 2,
    status: "paid",
    phone_number: "+918765432109",
    total_amount: 299,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    delivery_slot: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(),
    delivery_slot_kind: "dinner",
    order_items: [
      {
        quantity: 1,
        unit_price: 299,
        menu_item_id: "9e314bf8-6faa-4663-8d2d-d7246a0cc91b",
        menu_items: { name: "Egg Curry (1kg)", price: 299 },
      },
    ],
  },
  {
    id: "1003",
    status: "prepping",
    phone_number: "+917654321098",
    total_amount: 450,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    delivery_slot: "13:00 - 14:00",
    delivery_slot_kind: "lunch",
    order_items: [
      { quantity: 1, menu_items: { name: "Mutton Chukka" } },
      { quantity: 2, menu_items: { name: "Chapati" } }
    ]
  },
  {
    id: "1004",
    status: "out",
    phone_number: "+916543210987",
    total_amount: 250,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    delivery_slot: "13:00 - 14:00",
    delivery_slot_kind: "lunch",
    order_items: [
      { quantity: 1, menu_items: { name: "Chicken Fried Rice" } }
    ]
  },
  {
    id: "1005",
    status: "delivered",
    phone_number: "+915432109876",
    total_amount: 180,
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    delivery_slot: "13:00 - 14:00",
    delivery_slot_kind: "lunch",
    order_items: [
      { quantity: 1, menu_items: { name: "Egg Masala" } }
    ]
  }
];

// Mock Supabase Client to allow dashboard & testing without real database keys
const mockSupabase: any = {
  from: (table: string) => {
    const chain: any = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: () => chain,
      in: () => chain,
      upsert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      delete: () => chain,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => {
        if (table === "orders") {
          resolve({ data: mockOrders, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      }
    };
    return chain;
  },
  channel: () => ({
    on: () => ({
      subscribe: () => ({})
    })
  }),
  removeChannel: () => Promise.resolve()
};

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = isDummy
  ? mockSupabase
  : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
