export default function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-12 font-sans text-slate-800 leading-relaxed">
      <h1 className="text-4xl font-black mb-8 text-slate-900 border-b pb-4">Refund & Cancellation Policy</h1>
      <p className="mb-6 font-medium text-slate-500 italic">Last Updated: March 23, 2026</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">1. Order Cancellation</h2>
        <p>As we prepare fresh home-cooked meals, cancellations are only permitted within 15 minutes of placing the order. Once food preparation has started, we cannot accept cancellations or offer refunds.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">2. Refund Eligibility</h2>
        <p>Refunds will only be considered in the following cases:</p>
        <ul className="list-disc ml-6 mt-2 space-y-2">
          <li>The delivered food is spoiled or unfit for consumption.</li>
          <li>The wrong items were delivered compared to the order confirmation.</li>
          <li>The order was not delivered due to an error on our part.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">3. Refund Process</h2>
        <p>To request a refund, please contact us on WhatsApp with photos of the issue within 1 hour of delivery. Approved refunds will be processed via Razorpay to the original payment method within 5-7 business days.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">4. Modifications</h2>
        <p>Minor variations in taste or presentation are inherent to home-cooked meals and do not qualify for a refund.</p>
      </section>

      <div className="mt-12 pt-8 border-t text-sm text-slate-500">
        © 2026 Vidya's Kitchen. All rights reserved.
      </div>
    </div>
  );
}
