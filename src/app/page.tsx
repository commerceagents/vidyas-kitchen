"use client";

import { motion } from "framer-motion";
import { FoodCarousel } from "@/components/ui/FoodCarousel";
import { ArrowRight, UtensilsCrossed, Clock, Star } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] bg-primary/10 rounded-full blur-[120px] -z-10" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-4xl"
        >
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-block px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-8"
          >
            Authentic Flavor • Home Delivered
          </motion.span>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] uppercase italic italic-none">
            Order. <span className="text-primary">Indulge.</span> <br />
            <span className="text-white/50">Repeat.</span>
          </h1>
          
          <p className="mt-8 text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
            Experience the finest local delicacies from <span className="text-white">Vidya&apos;s Kitchen</span>. 
            Crafted with passion, delivered with love.
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-6">
            <button className="px-10 py-5 bg-primary rounded-full text-black font-black uppercase text-sm flex items-center gap-3 hover:bg-white transition-all transform hover:scale-105">
              Explore Menu <ArrowRight size={18} />
            </button>
            <button className="px-10 py-5 bg-accent-muted rounded-full text-white font-bold uppercase text-sm border border-white/5 hover:bg-white/10 transition-all">
              Track Order
            </button>
          </div>
        </motion.div>

        {/* Floating Stats */}
        <div className="absolute bottom-12 flex gap-12 text-white/30 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><Clock size={12} className="text-primary" /> Ready in 30m</div>
            <div className="flex items-center gap-2"><UtensilsCrossed size={12} className="text-primary" /> 50+ Varieties</div>
            <div className="flex items-center gap-2"><Star size={12} className="text-primary" /> Top Rated</div>
        </div>
      </section>

      {/* Signature Carousel Section */}
      <section className="py-24">
        <div className="px-6 mb-12 text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter">Chef&apos;s Specials</h2>
            <div className="w-12 h-1 bg-primary mx-auto mt-4" />
        </div>
        <FoodCarousel />
      </section>

      {/* Categories / Grid Section */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <CategoryCard title="Breakfast" count="12 Items" color="bg-secondary" delay={0.1} />
            <CategoryCard title="Main Course" count="8 Items" color="bg-primary" delay={0.2} />
            <CategoryCard title="Gravies" count="15 Items" color="bg-orange-500" delay={0.3} />
        </div>
      </section>
    </main>
  );
}

function CategoryCard({ title, count, color, delay }: { title: string, count: string, color: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.8 }}
            className={`relative p-12 rounded-[40px] overflow-hidden group cursor-pointer h-80 flex flex-col justify-end bg-accent-muted border border-white/5`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${color} blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity`} />
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">{count}</span>
            <h3 className="text-4xl font-black mt-2 uppercase italic">{title}</h3>
            <div className="mt-6 flex items-center gap-2 text-primary font-bold text-xs uppercase group-hover:gap-4 transition-all">
                Browse <ArrowRight size={14} />
            </div>
        </motion.div>
    )
}
