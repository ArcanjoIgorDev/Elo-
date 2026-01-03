
import React from 'react';
import { AppScreen } from '../types';
import { MessageSquare, User, Zap, Map } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onTriggerVibe?: () => void; 
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, onNavigate, onTriggerVibe }) => {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main Content Area - Scroll suave e padding safe area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative w-full scroll-smooth pb-safe">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 pb-safe pt-2 px-6 flex justify-between items-center z-50 shrink-0 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        
        {/* Chat Tab */}
        <NavButton 
          isActive={activeScreen === AppScreen.HOME} 
          onClick={() => onNavigate(AppScreen.HOME)}
          icon={<MessageSquare size={22} />}
          label="Chat"
        />

        {/* Map Tab */}
        <NavButton 
          isActive={activeScreen === AppScreen.MAP} 
          onClick={() => onNavigate(AppScreen.MAP)}
          icon={<Map size={22} />}
          label="Grid"
        />

        {/* Center Action Button (FLOATING ZAP) */}
        <div className="relative -top-8 mx-4 group">
            <button 
                onClick={() => {
                    onNavigate(AppScreen.HOME);
                    if(onTriggerVibe) onTriggerVibe();
                }}
                className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all border-2 border-brand-primary relative z-10"
            >
                <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center">
                     <Zap size={24} className="fill-black text-black" />
                </div>
            </button>
            {/* Pulsing Rings */}
            <div className="absolute inset-0 rounded-full border border-brand-primary/30 animate-ping opacity-20"></div>
            <div className="absolute inset-2 rounded-full border border-brand-primary/50 animate-pulse opacity-40"></div>
        </div>

        {/* Eco/Stats Tab */}
         <NavButton 
          isActive={activeScreen === AppScreen.ECO} 
          onClick={() => onNavigate(AppScreen.ECO)}
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 12l4-4m-4 4l-4 4"/></svg>} 
          label="Eco"
        />

        {/* Profile Tab */}
        <NavButton 
          isActive={activeScreen === AppScreen.PROFILE} 
          onClick={() => onNavigate(AppScreen.PROFILE)}
          icon={<User size={22} />}
          label="Perfil"
        />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ 
  isActive: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}> = ({ isActive, onClick, icon, label }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-300 active:scale-95 gap-1 ${
        isActive ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      <div className={`p-1.5 rounded-xl transition-all ${
        isActive ? 'bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : ''
      }`}>
        {icon}
      </div>
      <span className={`text-[9px] font-bold tracking-wider uppercase transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
        {label}
      </span>
    </button>
  );
};

export default Layout;
