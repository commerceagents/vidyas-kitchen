export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-12 font-sans text-slate-800 leading-relaxed">
      <h1 className="text-4xl font-black mb-8 text-slate-900 border-b pb-4">Privacy Policy</h1>
      <p className="mb-6 font-medium text-slate-500 italic">Last Updated: March 23, 2026</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">1. Information We Collect</h2>
        <p>At Vidya's Kitchen, we value your privacy. We collect the following information:</p>
        <ul className="list-disc ml-6 mt-2 space-y-2">
          <li><strong>WhatsApp Details:</strong> Name and phone number provided when interacting with our bot.</li>
          <li><strong>Order Content:</strong> Items ordered, delivery preferences, and special instructions.</li>
          <li><strong>Payment Info:</strong> We use Razorpay for payment processing and do not store your credit card or bank details on our servers.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">2. How We Use Information</h2>
        <p>Your data is used solely to provide and improve our services, including processing orders, sending payment links, and responding to your queries on WhatsApp.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">3. Data Sharing</h2>
        <p>We do not sell or rent your personal information to third parties. We only share necessary data with our payment partner (Razorpay) to complete your transactions.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">4. Cookies</h2>
        <p>Our website uses minimal essential cookies to ensure basic functionality. We do not use tracking or advertising cookies.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">5. Your Rights</h2>
        <p>You have the right to request a copy of your data or ask for its deletion at any time by contacting us on WhatsApp.</p>
      </section>

      <div className="mt-12 pt-8 border-t text-sm text-slate-500">
        © 2026 Vidya's Kitchen. All rights reserved.
      </div>
    </div>
  );
}
