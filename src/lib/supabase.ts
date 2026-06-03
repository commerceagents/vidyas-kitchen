import { createClient } from "@supabase/supabase-js";

const isDummy = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("dummy-supabase-project");

const mockOrders = [
  {
    id: "1001",
    status: "confirmed",
    phone_number: "+919876543210",
    total_amount: 320,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    delivery_slot: "13:00 - 14:00",
    delivery_slot_kind: "lunch",
    order_items: [
      { quantity: 2, menu_items: { name: "Special Chicken Biryani" } },
      { quantity: 1, menu_items: { name: "Pepper Chicken Dry" } }
    ]
  },
  {
    id: "1002",
    status: "pending",
    phone_number: "+918765432109",
    total_amount: 150,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    delivery_slot: "20:00 - 21:00",
    delivery_slot_kind: "dinner",
    order_items: [
      { quantity: 1, menu_items: { name: "Egg Curry" } }
    ]
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
