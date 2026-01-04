
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailable, checkPhoneAvailable } from '../services/dataService';
import { ArrowRight, Hexagon, Loader2, AlertTriangle, Phone, User, Lock, CheckCircle2, XCircle, Globe, Zap, Shield, Map, Activity, ChevronDown, Radio } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [scrolled, setScrolled] = useState(false);

  // Form State
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Detect scroll for Navbar styling
  useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 20);
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openAuth = (targetMode: 'login' | 'register') => {
      setMode(targetMode);
      setShowModal(true);
      setErrorMsg(null);
  };

  const validateFields = () => {
      const errors: { [key: string]: string } = {};
      if (!username.trim()) errors.username = "Obrigatório";
      if (!password.trim()) errors.password = "Obrigatório";
      if (mode === 'register') {
          if (!name.trim()) errors.name = "Obrigatório";
          if (!phone.trim()) errors.phone = "Obrigatório";
          if (password.length < 6) errors.password = "Mínimo 6 caracteres";
          if (username.length < 3) errors.username = "Mínimo 3 caracteres";
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
    <div className="min-h-screen w-full bg-[#050505] font-sans text-zinc-100 overflow-x-hidden selection:bg-brand-primary/30 flex flex-col relative">
      
      {/* --- NAVBAR --- */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 px-6 py-4 flex justify-between items-center ${scrolled ? 'bg-zinc-950/80 backdrop-blur-md border-b border-white/5 shadow-lg' : 'bg-transparent'}`}>
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform">
                  <Hexagon className="text-black fill-black rotate-90" size={20} strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-2xl tracking-tighter text-white">ELO</span>
          </div>

          <div className="flex items-center gap-4">
              <button 
                onClick={() => openAuth('login')} 
                className="text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-widest hidden md:block"
              >
                  Acessar
              </button>
              <button 
                onClick={() => openAuth('register')} 
                className="bg-zinc-100 text-black text-xs font-black px-6 py-3 rounded-full hover:scale-105 hover:bg-white transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] uppercase tracking-wide flex items-center gap-2"
              >
                  Iniciar <ArrowRight size={14}/>
              </button>
          </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 text-center overflow-hidden">
          {/* Background FX */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-[#050505] to-[#050505] opacity-80"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse-slow mix-blend-screen"></div>
          
          <div className="relative z-10 max-w-5xl mx-auto space-y-12 animate-slide-up flex flex-col items-center pt-20">
              
              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-zinc-900/60 border border-white/10 backdrop-blur-xl shadow-2xl hover:border-brand-primary/30 transition-colors cursor-default">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-zinc-300">Protocolo Neural v3.0</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter text-white leading-[0.85] select-none">
                  CONEXÃO <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-800 drop-shadow-2xl">CONTEXTO.</span>
              </h1>
              
              <p className="text-lg md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light tracking-wide">
                  A primeira rede social <span className="text-brand-primary font-bold">anti-algoritmo</span>. <br className="hidden md:block"/>
                  Recupere sua autonomia digital com privacidade radical.
              </p>

              <div className="flex flex-col sm:flex-row gap-5 w-full justify-center max-w-md mx-auto pt-8">
                  <button onClick={() => openAuth('register')} className="h-14 px-8 rounded-2xl bg-brand-primary text-black font-extrabold text-sm tracking-widest uppercase hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3">
                      Criar Identidade <ArrowRight size={18}/>
                  </button>
                  <button onClick={() => openAuth('login')} className="h-14 px-8 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-zinc-300 font-bold text-sm tracking-widest uppercase hover:bg-zinc-800 hover:text-white transition-all hover:border-zinc-600">
                      Sincronizar
                  </button>
              </div>
          </div>

          <div className="absolute bottom-10 inset-x-0 mx-auto w-fit animate-bounce text-zinc-800 opacity-50">
              <ChevronDown size={32} strokeWidth={1} />
          </div>
      </section>

      {/* --- GRID FEATURES --- */}
      <section className="py-32 px-6 bg-[#08080a] border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] opacity-20 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <FeatureCard 
                    icon={<Shield size={32} className="text-brand-primary"/>}
                    title="Criptografia Militar"
                    desc="Seus dados de localização e conversas são blindados ponto-a-ponto. Sem rastreadores, sem anúncios."
                  />
                  <FeatureCard 
                    icon={<Zap size={32} className="text-indigo-400"/>}
                    title="Vibes Efêmeras"
                    desc="Conteúdo que expira em 24h. Sem histórico eterno, sem pressão por perfeição. Apenas o agora."
                  />
                  <FeatureCard 
                    icon={<Radio size={32} className="text-pink-500"/>}
                    title="Satélite Neural"
                    desc="Visualize a distância física real dos seus nodos de conexão. O digital servindo ao encontro presencial."
                  />
              </div>
          </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-16 border-t border-white/5 bg-[#030303] text-center relative z-10">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-30">
              <Hexagon size={16} className="fill-white"/>
              <span className="font-bold tracking-widest text-sm">ELO SYSTEMS</span>
          </div>
          <p className="text-[10px] text-zinc-700 font-mono tracking-widest uppercase">© 2025 • SECURE CONNECTION ESTABLISHED</p>
      </footer>

      {/* --- AUTH MODAL --- */}
      {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-fade-in" onClick={() => setShowModal(false)}></div>
              
              {/* Modal Content */}
              <div className="relative w-full max-w-[420px] bg-[#09090b] border border-zinc-800/80 rounded-[32px] shadow-2xl overflow-hidden animate-slide-up ring-1 ring-white/10">
                  
                  {/* Decorative Header */}
                  <div className="h-32 bg-zinc-950 relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
                      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/10 blur-[80px]"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-[60px]"></div>
                      
                      <div className="z-10 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                              <Hexagon className="text-black fill-black rotate-90" size={24} strokeWidth={2} />
                          </div>
                          <h3 className="text-white font-black text-sm tracking-[0.3em] uppercase opacity-80">Acesso ao Sistema</h3>
                      </div>
                      <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-zinc-600 hover:text-white transition-colors p-2 bg-black/20 rounded-full hover:bg-black/50"><XCircle size={24}/></button>
                  </div>

                  <div className="p-8 bg-[#09090b] relative">
                      {/* Tabs */}
                      <div className="grid grid-cols-2 bg-zinc-900/50 rounded-2xl p-1.5 mb-8 border border-zinc-800">
                          <button onClick={() => setMode('login')} className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${mode === 'login' ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300'}`}>Entrar</button>
                          <button onClick={() => setMode('register')} className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${mode === 'register' ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300'}`}>Cadastrar</button>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                          {errorMsg && (
                              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs text-red-200 animate-slide-up font-medium">
                                  <AlertTriangle size={18} className="text-red-500" /> {errorMsg}
                              </div>
                          )}

                          {mode === 'register' && (
                              <div className="space-y-4 animate-fade-in">
                                  <InputGroup icon={<User size={18}/>} value={name} onChange={setName} placeholder="Nome completo" error={fieldErrors.name} />
                                  <InputGroup 
                                      icon={<Phone size={18}/>} 
                                      value={phone} 
                                      onChange={(val) => { setPhone(val); setPhoneAvailable(null); }} 
                                      onBlur={handlePhoneBlur}
                                      placeholder="WhatsApp (11 99999-9999)" 
                                      error={fieldErrors.phone}
                                      status={phoneAvailable}
                                  />
                              </div>
                          )}

                          <InputGroup 
                              icon={<Globe size={18}/>} 
                              value={username} 
                              onChange={(val) => { setUsername(val.toLowerCase()); setUsernameAvailable(null); }} 
                              onBlur={handleUsernameBlur}
                              placeholder="Usuário (@exemplo)" 
                              error={fieldErrors.username}
                              status={mode === 'register' ? usernameAvailable : null}
                          />
                          
                          <InputGroup icon={<Lock size={18}/>} type="password" value={password} onChange={setPassword} placeholder="Senha de acesso" error={fieldErrors.password} />

                          <button 
                              disabled={loading}
                              className="w-full bg-white text-black font-black h-14 rounded-2xl mt-8 hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-xs uppercase tracking-[0.15em] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                          >
                              {loading ? <Loader2 className="animate-spin" size={20}/> : (
                                  <>
                                      {mode === 'login' ? 'Autenticar' : 'Registrar ID'}
                                      <ArrowRight size={18} />
                                  </>
                              )}
                          </button>
                      </form>
                      
                      <p className="text-center text-[10px] text-zinc-700 mt-8 font-mono tracking-tight">
                          🔒 PROTECTED BY END-TO-END ENCRYPTION
                      </p>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: any) => (
    <div className="p-8 rounded-[32px] bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/60 transition-all duration-500 group hover:border-zinc-700/80">
        <div className="mb-6 w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 group-hover:border-zinc-700">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h3>
        <p className="text-zinc-500 text-sm leading-relaxed font-light">{desc}</p>
    </div>
);

const InputGroup = ({ icon, type="text", value, onChange, placeholder, error, status, onBlur }: any) => (
    <div className="relative group">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none z-10 ${error ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-white'}`}>
            {icon}
        </div>
        <input 
            type={type} 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`w-full bg-zinc-950/50 border ${error ? 'border-red-500/50' : 'border-zinc-800 focus:border-white/20'} rounded-2xl py-4 pl-12 pr-10 text-sm text-zinc-200 placeholder-zinc-700 outline-none transition-all shadow-inner`}
        />
        {status !== null && status !== undefined && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-fade-in">
                {status ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
            </div>
        )}
    </div>
);

export default LoginScreen;
