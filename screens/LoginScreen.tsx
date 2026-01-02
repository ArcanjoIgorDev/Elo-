
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailable, checkPhoneAvailable } from '../services/dataService';
import { ArrowRight, Hexagon, Loader2, AlertTriangle, Phone, User, Lock, Sparkles, CheckCircle2, XCircle, Globe, Zap } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const validateFields = () => {
      const errors: { [key: string]: string } = {};
      if (!username.trim()) errors.username = "Obrigatório";
      if (!password.trim()) errors.password = "Obrigatório";
      if (mode === 'register') {
          if (!name.trim()) errors.name = "Obrigatório";
          if (!phone.trim()) errors.phone = "Obrigatório";
          if (password.length < 6) errors.password = "Min. 6 chars";
          if (username.length < 3) errors.username = "Min. 3 chars";
      }
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validateFields()) return;

    setLoading(true);
    try {
        if (mode === 'login') {
            const { error } = await signIn(username, password); 
            if (error) throw error;
        } else {
             // Register flow
             if (usernameAvailable === false) throw new Error("Usuário em uso.");
             if (phoneAvailable === false) throw new Error("Telefone em uso.");
             
             const cleanPhone = phone.replace(/\D/g, '');
             const fullPhone = `+55${cleanPhone}`;
             
             const { error } = await signUp(username, password, name, fullPhone);
             if (error) throw error;
        }
    } catch (err: any) {
        setErrorMsg(err.message || "Erro de conexão.");
    } finally {
        setLoading(false);
    }
  };

  const handleUsernameBlur = async () => {
    if (mode === 'register' && username.length > 2) {
        const isFree = await checkUsernameAvailable(username);
        setUsernameAvailable(isFree);
    }
  };

  const handlePhoneBlur = async () => {
      if (mode === 'register' && phone.length > 8) {
          const cleanPhone = phone.replace(/\D/g, '');
          setPhoneAvailable(await checkPhoneAvailable(`+55${cleanPhone}`));
      }
  }

  return (
    <div className="h-[100dvh] w-full bg-[#050505] relative overflow-hidden flex items-center justify-center font-sans text-zinc-100">
      
      {/* Background FX */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),rgba(0,0,0,0)60%)] pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-sm px-8 relative z-10 flex flex-col items-center">
        
        {/* Brand */}
        <div className="mb-12 text-center animate-fade-in flex flex-col items-center">
            <div className="relative group cursor-default">
                <div className="absolute inset-0 bg-brand-primary/30 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
                <div className="w-24 h-24 bg-zinc-950/80 backdrop-blur-md rounded-[2rem] flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                    <Hexagon className="text-zinc-100 fill-zinc-950/50 rotate-90 relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" size={40} strokeWidth={1} />
                </div>
            </div>
            <h1 className="text-5xl font-bold tracking-tighter text-white mt-6 mb-1 drop-shadow-lg">ELO</h1>
            <div className="flex items-center gap-2">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-zinc-600"></div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-medium">Sincronia Digital</p>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-zinc-600"></div>
            </div>
        </div>

        {/* Login/Register Card */}
        <div className="w-full bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[32px] p-1 shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in delay-100">
            
            {/* Toggle Switch */}
            <div className="grid grid-cols-2 bg-black/40 rounded-[28px] p-1.5 mb-6 relative">
                 <button 
                    onClick={() => setMode('login')}
                    className={`py-3 rounded-[24px] text-xs font-bold transition-all z-10 ${mode === 'login' ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                     Conectar
                 </button>
                 <button 
                    onClick={() => setMode('register')}
                    className={`py-3 rounded-[24px] text-xs font-bold transition-all z-10 ${mode === 'register' ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                     Criar Elo
                 </button>
                 <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-zinc-100 rounded-[24px] shadow-[0_2px_10px_rgba(255,255,255,0.2)] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${mode === 'login' ? 'left-1.5' : 'left-[calc(50%+4.5px)]'}`}></div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
                {errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-200 animate-pulse">
                        <AlertTriangle size={14} /> {errorMsg}
                    </div>
                )}

                {/* Fields */}
                {mode === 'register' && (
                    <div className="space-y-4 animate-fade-in">
                        <InputGroup icon={<User size={18}/>} value={name} onChange={setName} placeholder="Nome real" error={fieldErrors.name} />
                        <InputGroup 
                            icon={<Phone size={18}/>} 
                            value={phone} 
                            onChange={(val) => { setPhone(val); setPhoneAvailable(null); }} 
                            onBlur={handlePhoneBlur}
                            placeholder="11 99999-9999" 
                            error={fieldErrors.phone}
                            status={phoneAvailable}
                        />
                    </div>
                )}

                <InputGroup 
                    icon={<Globe size={18}/>} 
                    // Prefix removed here
                    value={username} 
                    onChange={(val) => { setUsername(val.toLowerCase()); setUsernameAvailable(null); }} 
                    onBlur={handleUsernameBlur}
                    placeholder="Nome de usuário" 
                    error={fieldErrors.username}
                    status={mode === 'register' ? usernameAvailable : null}
                />
                
                <InputGroup icon={<Lock size={18}/>} type="password" value={password} onChange={setPassword} placeholder="Senha" error={fieldErrors.password} />

                <button 
                    disabled={loading}
                    className="w-full bg-white text-zinc-950 font-bold h-14 rounded-2xl mt-6 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none group"
                >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : (
                        <>
                            {mode === 'login' ? 'Entrar no Fluxo' : 'Iniciar Jornada'}
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>
        </div>
        
        <div className="mt-8 flex gap-4 text-[10px] text-zinc-600 font-mono tracking-widest opacity-60">
            <span>SECURE</span>
            <span>•</span>
            <span>PRIVATE</span>
            <span>•</span>
            <span>REAL</span>
        </div>

      </div>
    </div>
  );
};

const InputGroup = ({ icon, type="text", value, onChange, placeholder, error, prefix, status, onBlur }: any) => (
    <div className="relative group">
        {/* Icon positioned absolute left */}
        <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${error ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-zinc-100'}`}>
            {icon}
        </div>
        
        {/* Prefix if exists */}
        {prefix && (
            <span className="absolute left-12 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium border-r border-zinc-800 pr-2 leading-none pointer-events-none group-focus-within:text-zinc-300 transition-colors">
                {prefix}
            </span>
        )}

        <input 
            type={type} 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`w-full bg-zinc-950/50 border ${error ? 'border-red-500/50' : 'border-zinc-800 focus:border-zinc-600'} rounded-2xl py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all
            ${prefix ? 'pl-[5rem]' : 'pl-14'} pr-10`}
        />
        
        {status !== null && status !== undefined && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {status ? <CheckCircle2 size={16} className="text-brand-primary" /> : <XCircle size={16} className="text-red-500" />}
            </div>
        )}
    </div>
);

export default LoginScreen;
