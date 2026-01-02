
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.15),rgba(0,0,0,0)50%)] pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-sm px-8 relative z-10 flex flex-col items-center">
        
        {/* Brand */}
        <div className="mb-10 text-center animate-fade-in">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-[0_0_30px_rgba(16,185,129,0.1)] mb-4 mx-auto relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 <Hexagon className="text-zinc-100 fill-zinc-950 rotate-90 relative z-10" size={32} strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">ELO</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-1 font-medium">Sincronia Digital</p>
        </div>

        {/* Login/Register Card */}
        <div className="w-full bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-1 shadow-2xl relative overflow-hidden animate-fade-in delay-100">
            
            {/* Toggle Switch */}
            <div className="grid grid-cols-2 bg-zinc-950/50 rounded-[28px] p-1 mb-6 relative">
                 <button 
                    onClick={() => setMode('login')}
                    className={`py-3 rounded-[24px] text-xs font-bold transition-all z-10 ${mode === 'login' ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                     Entrar
                 </button>
                 <button 
                    onClick={() => setMode('register')}
                    className={`py-3 rounded-[24px] text-xs font-bold transition-all z-10 ${mode === 'register' ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                     Nova Identidade
                 </button>
                 <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-zinc-100 rounded-[24px] transition-all duration-300 ease-spring ${mode === 'login' ? 'left-1' : 'left-[calc(50%+4px)]'}`}></div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
                {errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-200">
                        <AlertTriangle size={14} /> {errorMsg}
                    </div>
                )}

                {/* Fields */}
                {mode === 'register' && (
                    <div className="space-y-4 animate-fade-in">
                        <InputGroup icon={<User size={16}/>} value={name} onChange={setName} placeholder="Nome real" error={fieldErrors.name} />
                        <InputGroup 
                            icon={<Phone size={16}/>} 
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
                    icon={<Globe size={16}/>} 
                    prefix="@"
                    value={username} 
                    onChange={(val) => { setUsername(val.toLowerCase()); setUsernameAvailable(null); }} 
                    onBlur={handleUsernameBlur}
                    placeholder="usuario" 
                    error={fieldErrors.username}
                    status={mode === 'register' ? usernameAvailable : null}
                />
                
                <InputGroup icon={<Lock size={16}/>} type="password" value={password} onChange={setPassword} placeholder="Senha" error={fieldErrors.password} />

                <button 
                    disabled={loading}
                    className="w-full bg-brand-primary text-zinc-950 font-bold h-12 rounded-xl mt-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : (
                        <>
                            {mode === 'login' ? 'Conectar' : 'Registrar'}
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </form>
        </div>
        
        <p className="mt-8 text-[10px] text-zinc-600 font-mono">
            ELO v2.0 • CONEXÕES REAIS
        </p>

      </div>
    </div>
  );
};

const InputGroup = ({ icon, type="text", value, onChange, placeholder, error, prefix, status, onBlur }: any) => (
    <div className="relative group">
        {/* Icon positioned absolute left */}
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${error ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-zinc-100'}`}>
            {icon}
        </div>
        
        {/* Prefix if exists (e.g. '@') */}
        {prefix && (
            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium border-r border-zinc-800 pr-2 leading-none pointer-events-none group-focus-within:text-zinc-300 transition-colors">
                {prefix}
            </span>
        )}

        <input 
            type={type} 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`w-full bg-zinc-950/40 border ${error ? 'border-red-500/50' : 'border-zinc-800 focus:border-brand-primary/50'} rounded-xl py-3.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all shadow-inner 
            ${prefix ? 'pl-[4.5rem]' : 'pl-11'} pr-10`}
        />
        
        {status !== null && status !== undefined && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status ? <CheckCircle2 size={16} className="text-brand-primary" /> : <XCircle size={16} className="text-red-500" />}
            </div>
        )}
    </div>
);

export default LoginScreen;
