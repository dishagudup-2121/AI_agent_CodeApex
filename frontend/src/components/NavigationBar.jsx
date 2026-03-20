import React from 'react';
import { Shield } from 'lucide-react';

const NavigationBar = () => {
  return (
    <header className="fixed top-0 w-full z-50 glass-panel border-b border-white/5 bg-[#0D1117]/60">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00F5FF]/20 to-[#8B5CF6]/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(0,245,255,0.15)]">
            <Shield className="w-5 h-5 text-[#00F5FF]" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            LEX-GUARD <span className="text-[#00F5FF]">AI</span>
          </span>
        </div>

        {/* Menu */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
          <a href="#docs" className="hover:text-white transition-colors">Docs</a>
          <a href="#api" className="hover:text-white transition-colors">API</a>
        </nav>

        {/* CTA */}
        <div>
          <a 
            href="/dashboard.html" 
            className="glow-btn px-6 py-2.5 rounded-full text-sm font-semibold tracking-wide"
          >
            Launch Agent
          </a>
        </div>

      </div>
    </header>
  );
};

export default NavigationBar;
