
import React, { useState } from 'react';
import { ArrowLeft, User, Bell, Lock, Moon, Sun, Trash2, LogOut, Shield, Database, ChevronRight, Smartphone, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigateProfile: () => void;
  onLogout: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onNavigateProfile, onLogout }) => {
  const { user } = useAuth();
  
  // Local Settings State (Simulated Persistence)
  const [zenMode, setZenMode] = useState(() => localStorage.getItem('zenMode') === 'true');
  const [notifications, setNotifications] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);

  const toggleZen = () => {
      const newVal = !zenMode;
      setZenMode(newVal);
      localStorage.setItem('zenMode', String(newVal));
  };

  const handleClearCache = () => {
      if(window.confirm("Limpar dados locais pode resolver problemas de carregamento. Continuar?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  return (
    <div className="h-full bg-zinc-950 flex flex-col overflow-hidden animate-fade-in relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Header */}
        <div className="p-4 flex items-center gap-4 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-20">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-zinc-100">Configurações</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            
            {/* Account Section */}
            <section>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1">Conta</h2>
                <div onClick={onNavigateProfile} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-900 transition-colors cursor-pointer group">
                    <img src={user?.avatar_url} className="w-14 h-14 rounded-xl object-cover bg-zinc-800" />
                    <div className="flex-1">
                        <h3 className="text-zinc-100 font-bold">{user?.name}</h3>
                        <p className="text-zinc-500 text-xs">@{user?.username}</p>
                    </div>
                    <ChevronRight size={20} className="text-zinc-600 group-hover:text-brand-primary transition-colors"/>
                </div>
            </section>

            {/* Interface Section */}
            <section>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1">Interface & Foco</h2>
                <div className="space-y-3">
                    <ToggleItem 
                        icon={<Moon size={18} />} 
                        label="Modo Zen (Padrão)" 
                        description="Inicia o app filtrando ruído visual."
                        active={zenMode} 
                        onToggle={toggleZen} 
                    />
                    <ToggleItem 
                        icon={<Bell size={18} />} 
                        label="Notificações" 
                        description="Push para novas vibes e chats."
                        active={notifications} 
                        onToggle={() => setNotifications(!notifications)} 
                    />
                </div>
            </section>

            {/* Privacy Section */}
            <section>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1">Privacidade</h2>
                <div className="space-y-3">
                    <ToggleItem 
                        icon={<EyeOff size={18} />} 
                        label="Modo Fantasma" 
                        description="Oculte seu status online (Simulado)."
                        active={ghostMode} 
                        onToggle={() => setGhostMode(!ghostMode)} 
                    />
                     <ToggleItem 
                        icon={<Check size={18} />} 
                        label="Recibos de Leitura" 
                        description="Permitir que vejam quando você leu."
                        active={readReceipts} 
                        onToggle={() => setReadReceipts(!readReceipts)} 
                    />
                </div>
            </section>

            {/* Data & System */}
            <section>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1">Sistema</h2>
                <div className="space-y-3">
                    <button onClick={handleClearCache} className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all">
                        <Database size={18} />
                        <span className="flex-1 text-left text-sm font-medium">Limpar Cache Local</span>
                    </button>
                    
                    <button onClick={onLogout} className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all">
                        <LogOut size={18} />
                        <span className="flex-1 text-left text-sm font-medium">Sair da Conta</span>
                    </button>
                </div>
            </section>

            <div className="text-center pt-8 pb-4">
                <p className="text-[10px] text-zinc-600 font-mono">ELO BUILD 2.4.0 • SECURE CONNECTION</p>
            </div>
        </div>
    </div>
  );
};

// Toggle Component
const ToggleItem = ({ icon, label, description, active, onToggle }: any) => (
    <div onClick={onToggle} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all hover:bg-zinc-900/50">
        <div className={`p-2 rounded-lg ${active ? 'bg-brand-primary/20 text-brand-primary' : 'bg-zinc-800 text-zinc-500'}`}>
            {icon}
        </div>
        <div className="flex-1">
            <h4 className={`text-sm font-medium ${active ? 'text-zinc-100' : 'text-zinc-400'}`}>{label}</h4>
            <p className="text-[10px] text-zinc-500">{description}</p>
        </div>
        <div className={`w-10 h-6 rounded-full relative transition-colors ${active ? 'bg-brand-primary' : 'bg-zinc-700'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-5' : 'left-1'}`}></div>
        </div>
    </div>
);

import { Check } from 'lucide-react'; // Import missing icon

export default SettingsScreen;
