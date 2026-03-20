import React from 'react';
import NavigationBar from './components/NavigationBar';
import Hero from './components/Hero';
import BentoGrid from './components/BentoGrid';
import WhyItMatters from './components/WhyItMatters';

function App() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-white selection:bg-purple-500/30 font-sans overflow-x-hidden">
      <NavigationBar />
      <main>
        <Hero />
        <BentoGrid />
        <WhyItMatters />
      </main>
      
      {/* Footer / Connects to Dashboard */}
      <footer className="py-12 border-t border-white/5 text-center bg-black/40">
        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
          Powered by LEX-GUARD AI Engine
        </p>
      </footer>
    </div>
  );
}

export default App;
