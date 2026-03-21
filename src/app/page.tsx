import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-shining-gradient flex flex-col items-center justify-start p-6 pb-24">
      {/* Header with Logo */}
      <header className="w-full flex justify-between items-center mb-8 animate-fade relative z-30 px-2">
        <div className="flex items-center gap-4">
          <div className="img-relative w-14 h-14 rounded-full border-2 border-primary/50 shadow-lg shadow-primary-glow flex-shrink-0 bg-surface">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={56}
              height={56}
              className="object-cover rounded-full"
              priority
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight leading-none text-white">Vidya's Kitchen</h1>
            <p className="text-[10px] text-muted font-medium uppercase tracking-[0.2em] mt-1">Sivakasi's Finest</p>
          </div>
        </div>
        <button className="glass p-3 rounded-2xl active:scale-90 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </header>

      {/* Hero Section */}
      <section className="w-full mb-10 animate-fade relative z-20" style={{ animationDelay: '0.1s' }}>
        <div className="img-relative w-full h-[460px] rounded-[40px] shadow-2xl group border border-white/5 bg-surface">
          <Image 
            src="/images/hero-spread.png" 
            alt="Traditional Feast" 
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-1000"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-8 pb-10">
            <h2 className="text-3xl font-bold mb-4 leading-[1.15] text-white">Bringing joy <br/> <span className="text-primary italic">through delicious</span> <br/> food.</h2>
            <p className="text-muted text-sm mb-8 max-w-[240px] leading-relaxed opacity-90">Freshly prepared home meals delivered straight to your doorstep.</p>
            <button className="btn-primary w-full py-5 text-lg shadow-2xl">See Today's Menu</button>
          </div>
        </div>
      </section>

      {/* Categories / Popular */}
      <section className="w-full mb-12 animate-fade relative z-10 px-1" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Popular Right Now</h3>
          <button className="text-primary text-sm font-medium">See All</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="card-ios group relative">
            <div className="img-relative aspect-square w-full bg-surface">
              <Image 
                src="/images/pepper-chicken.png" 
                alt="Pepper Chicken" 
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 glass p-2 rounded-full">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
            </div>
            <div className="p-4">
              <h4 className="font-semibold mb-1 truncate text-white">Pepper Chicken</h4>
              <div className="flex items-center justify-between">
                <span className="text-primary font-bold">₹240</span>
                <span className="text-[10px] text-muted uppercase tracking-tighter">Per Portion</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="card-ios group relative">
            <div className="img-relative aspect-square w-full bg-surface">
              <Image 
                src="/images/veg-combo.png" 
                alt="Veg Combo" 
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 glass p-2 rounded-full">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
            </div>
            <div className="p-4">
              <h4 className="font-semibold mb-1 truncate text-white">Traditional Combo</h4>
              <div className="flex items-center justify-between">
                <span className="text-primary font-bold">₹180</span>
                <span className="text-[10px] text-muted uppercase tracking-tighter">Meals</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-6 left-6 right-6 h-20 glass rounded-[30px] flex items-center justify-around px-4 z-50">
        <button className="text-primary flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        <button className="text-muted flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <button className="text-muted flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button className="text-muted flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      </nav>
    </main>
  );
}
