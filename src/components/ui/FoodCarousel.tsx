"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

interface Dish {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

const DUMMY_DISHES: Dish[] = [
  { id: "1", name: "Mutton Chukka", price: 800, image: "/placeholder-mutton.jpg", category: "Sides" },
  { id: "2", name: "Ghee Roast", price: 120, image: "/placeholder-dosa.jpg", category: "Breakfast" },
  { id: "3", name: "Pepper Chicken", price: 400, image: "/placeholder-chicken.jpg", category: "Sides" },
  { id: "4", name: "Idly Sambar", price: 60, image: "/placeholder-idly.jpg", category: "Breakfast" },
  { id: "5", name: "Noodles", price: 500, image: "/placeholder-noodles.jpg", category: "Lunch" },
];

export function FoodCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative h-[60vh] w-full overflow-hidden flex items-center justify-center bg-accent-muted/20">
      <div 
        ref={containerRef}
        className="flex gap-8 px-[30vw] py-20 overflow-x-auto no-scrollbar scroll-snap-x-mandatory"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {DUMMY_DISHES.map((dish, index) => (
          <CarouselItem key={dish.id} dish={dish} />
        ))}
      </div>
    </section>
  );
}

function CarouselItem({ dish }: { dish: Dish }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0.5 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ margin: "-20%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative min-w-[280px] md:min-w-[400px] aspect-[4/5] rounded-3xl overflow-hidden bg-accent-muted border border-white/5 scroll-snap-align-center"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
      
      {/* Placeholder for Dish Image */}
      <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center overflow-hidden">
        <div className="text-white/10 text-8xl font-black uppercase rotate-12 select-none">
          {dish.name}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 p-8 z-20 w-full">
        <motion.span 
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          className="text-primary font-medium uppercase tracking-widest text-xs"
        >
          {dish.category}
        </motion.span>
        <h3 className="text-3xl font-bold mt-2 leading-tight">{dish.name}</h3>
        <div className="flex justify-between items-center mt-6">
          <span className="text-2xl font-black text-secondary">₹{dish.price}</span>
          <button className="bg-primary hover:bg-white text-black px-6 py-3 rounded-full font-bold transition-colors">
            Order Now
          </button>
        </div>
      </div>
    </motion.div>
  );
}
