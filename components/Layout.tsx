import React from 'react';
import { AppScreen } from '../types';
import { MessageSquare, User, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onTriggerVibe?: () => void; // Nova prop para ação do botão central
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, onNavigate, onTriggerVibe }) => {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main Content Area - Scroll suave e padding safe area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative w-full scroll-smooth pb-safe">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 pb-safe pt-2 px-8 flex justify-between items-center z-50 shrink-0 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        
        {/* Chat Tab */}
        <NavButton 
          isActive={activeScreen === AppScreen.HOME} 
          onClick={() => onNavigate(AppScreen.HOME)}
          icon={<MessageSquare size={22} />}
          label="Chat"
        />

        {/* Center Action Button (VIBE) */}
        <div className="relative -top-5">
            <button 
                onClick={() => {
                    onNavigate(AppScreen.HOME);
                    if(onTriggerVibe) onTriggerVibe();
                }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-emerald-600 flex items-center justify-center text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all border-4 border-zinc-950 group"
            >
                <Zap size={28} className="fill-zinc-950 group-hover:animate-pulse" />
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-brand-primary blur-xl opacity-40 -z-10"></div>
            </button>
        </div>

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
      className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-300 active:scale-95 gap-1 ${
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