export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy - Vidya's Kitchen</h1>
      <p className="mb-4">Last Updated: March 21, 2026</p>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Data We Collect</h2>
        <p>We only collect your WhatsApp phone number and name when you message our automated bot. We also store your order history to provide a personalized experience.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Data</h2>
        <p>Your data is used exclusively to process your food orders, send you payment links, and improve our menu recommendations. We do not sell your data to third parties.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Data Security</h2>
        <p>Your information is stored securely in our private database (Supabase) and is only accessible by the owner of Vidya's Kitchen for operational purposes.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Contact Us</h2>
        <p>If you have any questions about your data, please contact us directly on WhatsApp.</p>
      </section>

      <div className="text-sm text-slate-500 border-t pt-4">
        © 2026 Vidya's Kitchen, Sivakasi. All rights reserved.
      </div>
    </div>
  );
}
