import React from 'react';
import { FileText, Cpu, Network } from 'lucide-react';
import { motion } from 'framer-motion';

const BentoGrid = () => {
  const modules = [
    {
      title: "AI Rule Extraction",
      text: "Extract enforceable rules from complex policy documents using hybrid AI parsing and NLP.",
      icon: <FileText className="w-8 h-8 text-[#00F5FF]" />,
      colSpan: "col-span-1 md:col-span-2 lg:col-span-1",
      glow: "hover:shadow-[0_0_30px_rgba(0,245,255,0.15)]"
    },
    {
      title: "Real-Time Validation",
      text: "Evaluate transactions instantly with our optimized rule engine and automated conflict detection logic.",
      icon: <Cpu className="w-8 h-8 text-white" />,
      colSpan: "col-span-1 md:col-span-2 lg:col-span-1",
      glow: "hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
    },
    {
      title: "Explainability Engine",
      text: "Trace every decision with generated causal reasoning, audit logs, and actionable risk insights.",
      icon: <Network className="w-8 h-8 text-[#8B5CF6]" />,
      colSpan: "col-span-1 md:col-span-2 lg:col-span-1",
      glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    }
  ];

  return (
    <section className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">Intelligent System Overview</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">A unified framework that bridges the gap between regulatory text and execution logic.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
              className={`glass-panel p-8 rounded-3xl flex flex-col items-start gap-6 transition-all duration-300 ${mod.colSpan} border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent ${mod.glow}`}
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                {mod.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{mod.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {mod.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
