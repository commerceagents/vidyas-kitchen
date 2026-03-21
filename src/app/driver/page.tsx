"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  MapPin, 
  Phone, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  ShoppingBag,
  Navigation,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Order {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  delivery_slot: string;
  created_at: string;
  users: {
    full_name: string;
    phone_number: string;
  };
}

export default function DriverDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    // Subscribe to changes
    const channel = supabase
      .channel("driver-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    try {
      // Get orders for today/tomorrow that are confirmed, prepping, or out
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          users:customer_id (
            full_name,
            phone_number
          )
        `)
        .in("status", ["confirmed", "prepping", "out"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data as any[] || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsDelivered(orderId: string) {
    setUpdating(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", orderId);

      if (error) throw error;
      // Optimistic update
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setUpdating(null);
    }
  }

  const handleNavigate = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
            Driver Hub
          </h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Active</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white/90">Today's Deliveries</h2>
          <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-xs font-bold ring-1 ring-red-500/20">
            {orders.length} PENDING
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <p className="text-white/40 text-sm">Loading your route...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white/20" />
            </div>
            <div>
              <p className="text-white/60 font-medium">All caught up!</p>
              <p className="text-white/40 text-sm">No pending deliveries for now.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 hover:border-red-500/30 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                        {order.users?.full_name || "Guest Customer"}
                      </h3>
                      <p className="text-xs text-white/40 font-mono mt-0.5 uppercase tracking-tighter">
                        Order #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      order.status === 'out' ? "bg-orange-500/20 text-orange-400 border border-orange-500/20" : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                    )}>
                      {order.status}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1.5 bg-white/5 rounded-lg border border-white/10">
                        <MapPin className="w-4 h-4 text-red-500" />
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed italic">
                         "{order.delivery_address || "Address not provided"}"
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">
                        <Clock className="w-4 h-4 text-blue-400" />
                      </div>
                      <p className="text-sm text-white/70 font-medium">
                        Expected: {new Date(order.delivery_slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleNavigate(order.delivery_address)}
                      className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
                    >
                      <Navigation className="w-4 h-4" />
                      Navigate
                    </button>
                    <button
                      onClick={() => handleCall(order.users?.phone_number)}
                      className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </button>
                    <button
                      onClick={() => markAsDelivered(order.id)}
                      disabled={updating === order.id}
                      className="col-span-2 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-xl py-4 text-sm font-bold shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {updating === order.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Mark as Delivered
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Bottom Nav Mockup */}
      <nav className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto flex justify-center">
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-8">
                <button className="text-red-500 flex flex-col items-center">
                    <ShoppingBag className="w-6 h-6" />
                    <span className="text-[10px] mt-1 font-bold">Orders</span>
                </button>
                <div className="w-px h-6 bg-white/10" />
                <button className="text-white/40 flex flex-col items-center">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-[10px] mt-1 font-bold text-white/20">History</span>
                </button>
            </div>
        </div>
      </nav>
    </div>
  );
}
