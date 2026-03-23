export default function ShippingPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-12 font-sans text-slate-800 leading-relaxed">
      <h1 className="text-4xl font-black mb-8 text-slate-900 border-b pb-4">Shipping & Delivery Policy</h1>
      <p className="mb-6 font-medium text-slate-500 italic">Last Updated: March 23, 2026</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">1. Delivery Coverage</h2>
        <p>Vidya's Kitchen currently delivers within a 15km radius of Sivakasi, Tamil Nadu. Delivery availability will be confirmed at the time of order placement via our WhatsApp bot.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">2. Delivery Timelines</h2>
        <p>Orders are usually delivered within 45-90 minutes depending on the preparation time and distance. Pre-orders for specific time slots will be prioritized accordingly.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">3. Shipping Charges</h2>
        <p>Delivery charges may apply based on the distance from our kitchen. Any applicable charges will be transparently displayed during the checkout process on WhatsApp.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">4. Delivery Failures</h2>
        <p>If a delivery cannot be completed due to an incorrect address or the customer being unreachable, the order will be marked as delivered and no refund will be issued.</p>
      </section>

      <div className="mt-12 pt-8 border-t text-sm text-slate-500">
        © 2026 Vidya's Kitchen. All rights reserved.
      </div>
    </div>
  );
}
