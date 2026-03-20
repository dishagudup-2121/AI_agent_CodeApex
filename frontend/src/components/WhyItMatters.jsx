import React from 'react';
import { AlertTriangle, Dna } from 'lucide-react';

const WhyItMatters = () => {
  return (
    <section className="py-24 border-t border-white/5 relative bg-gradient-to-b from-[#0D1117] to-black/50">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left Side text */}
        <div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 mb-6 leading-tight">
            9/10 compliance tools show data. <br/>
            <span className="text-white">We show decisions.</span>
          </h2>
          <p className="text-lg text-gray-400 mb-8 max-w-lg leading-relaxed">
            Stop digging through raw logs. LEX-GUARD AI synthesizes alerts into human-readable causal chains so your team can focus on action, not investigation.
          </p>
          
          <div className="flex gap-4">
             <button className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors">
               Read Case Study
             </button>
          </div>
        </div>

        {/* Right Side visual */}
        <div className="relative group perspective-1000">
          <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl relative z-10 transition-transform duration-500 hover:rotate-y-[-5deg] hover:rotate-x-[5deg]">
            
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <Dna className="w-5 h-5 text-[#8B5CF6]" />
              <span className="font-semibold text-gray-200">AI Summary Preview</span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-4 items-start">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-red-300 font-semibold text-sm mb-1">Transaction TXN-004 Flagged</h4>
                  <p className="text-xs text-red-200/70">Flagged due to high amount ($120,000) and risk score (0.92) triggering Policy R1.</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="h-2 w-1/3 bg-white/10 rounded-full mb-3" />
                <div className="h-2 w-2/3 bg-white/10 rounded-full mb-3" />
                <div className="h-2 w-1/2 bg-white/10 rounded-full" />
              </div>
            </div>

          </div>
          
          {/* subtle glow behind the card */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#8B5CF6]/30 to-[#00F5FF]/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </div>

      </div>
    </section>
  );
};

export default WhyItMatters;
