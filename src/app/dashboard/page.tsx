"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ShoppingBag, 
  Users, 
  IndianRupee, 
  Clock, 
  Package, 
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    readyForDelivery: 0
  });

  useEffect(() => {
    fetchOrders();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, users(full_name)')
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data);
      calculateStats(data);
    }
  }

  function calculateStats(data: any[]) {
    const totalRevenue = data
      .filter(o => o.status === 'paid' || o.status === 'completed')
      .reduce((acc, o) => acc + (o.total_amount || 0), 0);
    
    const pendingPayments = data.filter(o => o.status === 'pending_payment').length;
    const readyForDelivery = data.filter(o => o.status === 'preparing').length;

    setStats({
      totalOrders: data.length,
      totalRevenue,
      pendingPayments,
      readyForDelivery
    });
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);
    
    if (!error) fetchOrders();
  }

  return (
    <div className="min-h-screen bg-shining-gradient p-4 md:p-10">
      {/* Header */}
      <div className="mb-10 animate-fade flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Vidya's Kitchen</h1>
          <p className="text-muted font-medium uppercase tracking-[0.2em] mt-2 text-sm">Owner Operations Hub</p>
        </div>
        <div className="glass px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Live Sync Alpha</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 animate-fade" style={{ animationDelay: '0.1s' }}>
        <StatCard 
          icon={<ShoppingBag className="w-6 h-6" />}
          label="Total Orders"
          value={stats.totalOrders}
          color="text-blue-400"
        />
        <StatCard 
          icon={<IndianRupee className="w-6 h-6" />}
          label="Revenue"
          value={`₹${stats.totalRevenue}`}
          color="text-primary"
        />
        <StatCard 
          icon={<AlertCircle className="w-6 h-6" />}
          label="Pending Pay"
          value={stats.pendingPayments}
          color="text-orange-400"
        />
        <StatCard 
          icon={<Package className="w-6 h-6" />}
          label="Preparing"
          value={stats.readyForDelivery}
          color="text-purple-400"
        />
      </div>

      {/* Order List */}
      <div className="card-ios border-white/5 animate-fade" style={{ animationDelay: '0.2s' }}>
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <h2 className="font-bold text-xl text-white">Live Orders</h2>
          <button className="text-xs text-muted uppercase tracking-widest hover:text-white transition-colors">Refresh Feed</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-[0.2em] bg-white/5">
                <th className="p-6 font-semibold">Customer</th>
                <th className="p-6 font-semibold">Amount</th>
                <th className="p-6 font-semibold">Status</th>
                <th className="p-6 font-semibold">Time</th>
                <th className="p-6 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-6">
                    <div className="font-bold text-white group-hover:text-primary transition-colors">{order.users?.full_name || "Guest User"}</div>
                    <div className="text-xs text-muted mt-1">{order.phone_number}</div>
                  </td>
                  <td className="p-6 font-bold text-white">₹{order.total_amount}</td>
                  <td className="p-6">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-6 text-muted text-sm">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      {order.status === 'pending_payment' && (
                        <button 
                          onClick={() => updateStatus(order.id, 'paid')}
                          className="text-[10px] uppercase tracking-widest bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-primary-glow hover:scale-105 active:scale-95 transition-all"
                        >
                          Confirm Pay
                        </button>
                      )}
                      {order.status === 'paid' && (
                        <button 
                          onClick={() => updateStatus(order.id, 'preparing')}
                          className="text-[10px] uppercase tracking-widest bg-white text-black px-4 py-2 rounded-xl font-bold hover:bg-muted transition-all active:scale-95"
                        >
                          Start Prep
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-muted italic">
                    Waiting for new orders...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
  return (
    <div className="card-ios p-8 border-white/5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        {icon}
      </div>
      <div className="relative z-10">
        <div className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mb-3">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    pending_payment: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    preparing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${styles[status] || "bg-white/10 text-muted border-white/10"}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
