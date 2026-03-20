import React from 'react';
import { Play, FileText, Activity } from 'lucide-react';
import Scene3D from './Scene3D';
import { motion } from 'framer-motion';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 -left-64 w-96 h-96 bg-[#8B5CF6]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-[#00F5FF]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Left Side: Product Identity */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00F5FF]/30 bg-[#00F5FF]/5 text-[#00F5FF] text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5" />
            <span>Enterprise Compliance Engine</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
            AI-Powered <br/> Compliance. <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] to-[#8B5CF6]">Zero Friction.</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
            Convert complex policy documents into automated rules, detect violations instantly, and understand every decision with full explainability.
          </p>

          <ul className="space-y-3">
            {[
              "⚡ Real-time transaction validation",
              "🧠 AI-driven rule extraction",
              "🔍 Full audit traceability"
            ].map((item, i) => (
              <li key={i} className="flex items-center text-gray-300 font-medium text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] mr-3 shadow-[0_0_8px_#00F5FF]"></span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <a href="/dashboard" className="glow-btn px-8 py-3.5 rounded-full font-semibold flex items-center gap-2 shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_25px_rgba(0,245,255,0.4)] transition-all">
              <Play className="w-4 h-4" fill="currentColor" />
              Start Audit
            </a>
            <a href="/dashboard" className="px-8 py-3.5 rounded-full font-semibold text-white border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2">
              <FileText className="w-4 h-4" />
              View Demo
            </a>
          </div>
        </motion.div>

        {/* Right Side: 3D Canvas */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="h-[600px] w-full relative"
        >
          {/* We will drop the React Three Fiber Canvas here */}
          <Scene3D />
          
          {/* Subtle Decorative Elements */}
          <div className="absolute inset-0 border border-white/5 rounded-3xl pointer-events-none mix-blend-overlay"></div>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
