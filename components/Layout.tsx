import React from 'react';
import { AppScreen } from '../types';
import { MessageSquare, User, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, onNavigate }) => {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main Content Area - Scroll suave e padding safe area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative w-full scroll-smooth pb-safe">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-900 pb-safe pt-2 px-6 flex justify-between items-center z-50 shrink-0 absolute bottom-0 w-full">
        <NavButton 
          isActive={activeScreen === AppScreen.HOME} 
          onClick={() => onNavigate(AppScreen.HOME)}
          icon={<MessageSquare size={24} />}
          label="Conversas"
        />
        <NavButton 
          isActive={false} // Ação de criar vibe é modal na Home agora
          onClick={() => onNavigate(AppScreen.HOME)} 
          icon={<Zap size={24} />}
          label="Vibe"
          highlight
        />
        <NavButton 
          isActive={activeScreen === AppScreen.PROFILE} 
          onClick={() => onNavigate(AppScreen.PROFILE)}
          icon={<User size={24} />}
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
  highlight?: boolean;
}> = ({ isActive, onClick, icon, label, highlight }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-300 active:scale-90 ${
        isActive ? 'text-zinc-100' : 'text-zinc-600'
      }`}
    >
      <div className={`p-2 rounded-2xl mb-1 transition-all ${
        isActive && !highlight ? 'bg-zinc-800' : ''
      } ${
        highlight ? 'bg-zinc-100 text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.15)] transform -translate-y-2' : ''
      }`}>
        {icon}
      </div>
      <span className={`text-[10px] font-medium tracking-wide ${highlight ? 'opacity-0' : ''}`}>
        {label}
      </span>
    </button>
  );
};

export default Layout;