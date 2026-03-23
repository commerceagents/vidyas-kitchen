export default function ContactUs() {
  return (
    <div className="max-w-3xl mx-auto p-12 font-sans text-slate-800 leading-relaxed">
      <h1 className="text-4xl font-black mb-8 text-slate-900 border-b pb-4">Contact Us</h1>
      <p className="mb-6 font-medium text-slate-500 italic">Last Updated: March 23, 2026</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Get in Touch</h2>
        <p className="mb-4">We are always happy to hear from you! For orders, feedback, or any assistance, please reach out via the following channels:</p>
        
        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">WhatsApp / Phone</h3>
            <p className="text-slate-700">+91 75500 28179</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Email</h3>
            <p className="text-slate-700">support@vidyaskitchenhome.com</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Kitchen Address</h3>
            <p className="text-slate-700">Sivakasi, Tamil Nadu, India</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Operating Hours</h2>
        <p>Monday - Sunday: 9:00 AM - 9:00 PM</p>
      </section>

      <div className="mt-12 pt-8 border-t text-sm text-slate-500">
        © 2026 Vidya's Kitchen. All rights reserved.
      </div>
    </div>
  );
}
