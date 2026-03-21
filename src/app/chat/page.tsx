"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/lib/ai/agent";
import { Send, User, Bot, Loader2, List, CreditCard } from "lucide-react";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm Vidya from Vidya's Kitchen. I'm so happy to have you here! Looking for a delicious home-cooked meal in Sivakasi? 🥘" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: messages }),
      });
      
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      
      // If we have menu items or buttons, we could render them here too
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I hit a snag. Let's try that again!" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
            VK
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">Vidya's Kitchen</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-slate-500 font-medium tracking-wide">AI Assistant Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-2xl mx-auto w-full scroll-smooth"
      >
        {messages.map((ms, i) => (
          <div key={i} className={`flex ${ms.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex gap-3 max-w-[85%] ${ms.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                ms.role === "user" ? "bg-slate-200" : "bg-blue-600 shadow-blue-100"
              }`}>
                {ms.role === "user" ? <User size={16} className="text-slate-600" /> : <Bot size={16} className="text-white" />}
              </div>
              
              <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                ms.role === "user" 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
              }`}>
                {ms.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" />
              Vidya is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about today's menu..."
            className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
