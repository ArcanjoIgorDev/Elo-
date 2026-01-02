import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailable, checkPhoneAvailable } from '../services/dataService';
import { ArrowRight, Hexagon, Loader2, AlertCircle, Phone, User, Lock, Sparkles, CheckCircle2, XCircle, Check, AlertTriangle } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Fields
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  
  // Validation States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

  // Field Errors
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const validateFields = () => {
      const errors: { [key: string]: string } = {};
      
      if (!username.trim()) errors.username = "Digite seu usuário.";
      if (!password.trim()) errors.password = "Digite sua senha.";
      
      if (mode === 'register') {
          if (!name.trim()) errors.name = "Nome é obrigatório.";
          if (!phone.trim()) errors.phone = "Celular é obrigatório.";
          if (password.length < 6) errors.password = "Mínimo 6 caracteres.";
          if (username.length < 3) errors.username = "Mínimo 3 letras.";
      }

      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const handleUsernameBlur = async () => {
    if (mode === 'register' && username.length > 2) {
        const isFree = await checkUsernameAvailable(username);
        setUsernameAvailable(isFree);
    }
  };

  const handlePhoneBlur = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = `+55${cleanPhone}`;
    if (mode === 'register' && cleanPhone.length >= 10) {
        const isFree = await checkPhoneAvailable(fullPhone);
        setPhoneAvailable(isFree);
    }
  };

  const translateError = (message: string) => {
      const msg = message.toLowerCase();
      // Erros de Configuração do Supabase
      if (msg.includes("email logins are disabled") || msg.includes("email provider is disabled")) {
          return "CONFIGURAÇÃO: Vá no painel do Supabase > Authentication > Providers e ative 'Email'.";
      }
      if (msg.includes("database error")) {
          return "Erro no sistema. Tente um nome de usuário diferente.";
      }
      
      // Erros de Usuário
      if (msg.includes("user already registered") || msg.includes("unique constraint")) return "Este nome de usuário já está em uso.";
      if (msg.includes("invalid login credentials")) return "Credenciais inválidas. Verifique seus dados.";
      if (msg.includes("password should be at least")) return "A senha é muito curta (mínimo 6 caracteres).";
      if (msg.includes("signups not allowed")) return "O cadastro de novos usuários está desativado no servidor.";
      if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco.";
      
      return message || "Ocorreu um erro desconhecido. Tente novamente.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    if (!validateFields()) return;

    setLoading(true);

    try {
        if (mode === 'login') {
            const { error } = await signIn(username, password); 
            if (error) throw error;
        } else {
            // Validações extras
            if (usernameAvailable === false) throw new Error("Este usuário já está em uso.");
            if (phoneAvailable === false) throw new Error("Este telefone já está cadastrado.");
            
            const cleanPhone = phone.replace(/\D/g, '');
            const fullPhone = `+55${cleanPhone}`;
            
            const { data, error } = await signUp(username, password, name, fullPhone);
            
            if (error) throw error;
            
            // Check de Sucesso
            if (data.user && !data.session) {
                setErrorMsg("Sua conta foi criada, mas o Supabase pede confirmação de email. Desative 'Confirm Email' no painel para entrar direto.");
                setLoading(false);
                return;
            }

            setSuccessMsg("Identidade Sincronizada.");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (err: any) {
        setErrorMsg(translateError(err.message || ""));
    } finally {
        if (!successMsg) setLoading(false);
    }
  };

  const toggleMode = () => {
      setMode(mode === 'login' ? 'register' : 'login');
      setErrorMsg(null);
      setFieldErrors({});
      setSuccessMsg(null);
      setPassword('');
      setName('');
      setPhone('');
  };

  // TELA DE SUCESSO
  if (successMsg) {
      return (
          <div className="h-[100dvh] w-full bg-zinc-950 flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-primary/20 via-zinc-950/80 to-zinc-950 pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center mb-8 ring-1 ring-brand-primary/30 animate-pulse">
                    <Check size={48} className="text-brand-primary" />
                </div>
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 mb-3 tracking-tight">Bem-vindo ao ELO.</h2>
                <p className="text-zinc-400 text-sm font-medium tracking-wide">{successMsg}</p>
              </div>
          </div>
      );
  }

  return (
    <div className="h-[100dvh] w-full bg-zinc-950 relative overflow-hidden flex items-center justify-center p-6">
      
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/30 via-zinc-950/80 to-zinc-950 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Glass Card */}
      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-zinc-100 to-zinc-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)] mb-4">
                <Hexagon className="text-zinc-950 fill-zinc-950 rotate-90" size={28} />
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 tracking-tight">ELO</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mt-1">Sincronia Real</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 p-6 rounded-3xl shadow-2xl space-y-4 relative overflow-hidden">
          
           {/* Subtle Shine effect on card */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent opacity-50"></div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-red-200 font-medium leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* NAME FIELD (Register Only) */}
          {mode === 'register' && (
            <div className="space-y-1.5 animate-in slide-in-from-left-4 fade-in duration-300">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1 flex justify-between">
                    Nome Real
                    {fieldErrors.name && <span className="text-red-400 normal-case tracking-normal">{fieldErrors.name}</span>}
                </label>
                <div className="relative group">
                    <User size={16} className={`absolute left-3.5 top-3.5 transition-colors ${fieldErrors.name ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-brand-primary'}`}/>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como quer ser chamado"
                        className={`w-full bg-zinc-950/50 border text-zinc-100 pl-10 pr-4 py-3 rounded-xl outline-none transition-all placeholder-zinc-700 text-sm ${
                            fieldErrors.name ? 'border-red-500/50 focus:border-red-500 bg-red-500/5' : 'border-zinc-800 focus:border-brand-primary/50 focus:bg-zinc-900/80'
                        }`}
                    />
                </div>
            </div>
          )}

          {/* USERNAME FIELD */}
          <div className="space-y-1.5">
             <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1 flex justify-between">
                 {mode === 'login' ? 'Usuário' : 'Criar @Usuário'}
                 {fieldErrors.username && <span className="text-red-400 normal-case tracking-normal">{fieldErrors.username}</span>}
             </label>
             <div className="relative group">
                 <div className={`absolute left-3.5 top-3.5 font-bold text-sm transition-colors ${fieldErrors.username ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-brand-primary'}`}>@</div>
                 <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                        setUsername(e.target.value.toLowerCase().replace(/\s/g,'').replace(/[^a-z0-9_.]/g, ''));
                        if(mode === 'register') setUsernameAvailable(null);
                    }}
                    onBlur={handleUsernameBlur}
                    autoCapitalize="none"
                    placeholder="usuario.elo"
                    className={`w-full bg-zinc-950/50 border text-zinc-100 pl-9 pr-10 py-3 rounded-xl outline-none transition-all placeholder-zinc-700 text-sm ${
                        fieldErrors.username ? 'border-red-500/50 focus:border-red-500 bg-red-500/5' :
                        (mode === 'register' && usernameAvailable === false 
                        ? 'border-red-500/50 focus:border-red-500 bg-red-500/5' 
                        : (mode === 'register' && usernameAvailable === true ? 'border-brand-primary/50 focus:border-brand-primary' : 'border-zinc-800 focus:border-brand-primary/50 focus:bg-zinc-900/80'))
                    }`}
                 />
                 {mode === 'register' && username.length > 0 && !fieldErrors.username && (
                     <div className="absolute right-3.5 top-3.5">
                         {usernameAvailable === null ? <Loader2 size={16} className="animate-spin text-zinc-600"/> : usernameAvailable ? (
                             <CheckCircle2 size={16} className="text-brand-primary" />
                         ) : (
                             <XCircle size={16} className="text-red-500" />
                         )}
                     </div>
                 )}
             </div>
             {mode === 'register' && usernameAvailable === false && !fieldErrors.username && (
                 <p className="text-[10px] text-red-400 ml-1">Usuário indisponível</p>
             )}
          </div>

          {/* PHONE FIELD (Register Only) */}
          {mode === 'register' && (
            <div className="space-y-1.5 animate-in slide-in-from-left-4 fade-in duration-300 delay-75">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1 flex justify-between">
                    Celular
                    {fieldErrors.phone && <span className="text-red-400 normal-case tracking-normal">{fieldErrors.phone}</span>}
                </label>
                <div className="relative group">
                    <Phone size={16} className={`absolute left-3.5 top-3.5 transition-colors ${fieldErrors.phone ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-brand-primary'}`}/>
                    <span className="absolute left-9 top-3.5 text-zinc-600 text-sm font-medium border-r border-zinc-800 pr-2 h-5 flex items-center">+55</span>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value);
                            setPhoneAvailable(null);
                        }}
                        onBlur={handlePhoneBlur}
                        placeholder="11 99999-9999"
                        className={`w-full bg-zinc-950/50 border text-zinc-100 pl-20 pr-10 py-3 rounded-xl outline-none transition-all placeholder-zinc-700 text-sm ${
                            fieldErrors.phone ? 'border-red-500/50 focus:border-red-500 bg-red-500/5' :
                            (phoneAvailable === false ? 'border-red-500/50' : 'border-zinc-800 focus:border-brand-primary/50 focus:bg-zinc-900/80')
                        }`}
                    />
                     {phone.length > 8 && !fieldErrors.phone && (
                     <div className="absolute right-3.5 top-3.5">
                         {phoneAvailable === null ? null : phoneAvailable ? (
                             <CheckCircle2 size={16} className="text-brand-primary" />
                         ) : (
                             <XCircle size={16} className="text-red-500" />
                         )}
                     </div>
                 )}
                </div>
                 {phoneAvailable === false && !fieldErrors.phone && (
                 <p className="text-[10px] text-red-400 ml-1">Telefone já cadastrado</p>
             )}
            </div>
          )}

          {/* PASSWORD FIELD */}
          <div className="space-y-1.5">
             <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1 flex justify-between">
                 Senha
                 {fieldErrors.password && <span className="text-red-400 normal-case tracking-normal">{fieldErrors.password}</span>}
             </label>
             <div className="relative group">
                 <Lock size={16} className={`absolute left-3.5 top-3.5 transition-colors ${fieldErrors.password ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-brand-primary'}`}/>
                 <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-zinc-950/50 border text-zinc-100 pl-10 pr-4 py-3 rounded-xl outline-none transition-all placeholder-zinc-700 text-sm ${
                        fieldErrors.password ? 'border-red-500/50 focus:border-red-500 bg-red-500/5' : 'border-zinc-800 focus:border-brand-primary/50 focus:bg-zinc-900/80'
                    }`}
                 />
             </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || (mode === 'register' && (!usernameAvailable || !phoneAvailable))}
            className="w-full bg-zinc-100 text-zinc-950 font-bold tracking-wide p-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/50 mt-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? <Loader2 className="animate-spin" size={18}/> : (
                <>
                    {mode === 'login' ? 'Acessar minha conta' : 'Criar Identidade'}
                    {mode === 'register' && <Sparkles size={16} className="text-zinc-600" />}
                    {mode === 'login' && <ArrowRight size={18} />}
                </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={toggleMode}
                className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors py-2 px-4 rounded-full hover:bg-zinc-900/50"
            >
                {mode === 'login' ? (
                    <span>Ainda não tem um ELO? <strong className="text-zinc-300">Criar agora</strong></span>
                ) : (
                    <span>Já possui identidade? <strong className="text-zinc-300">Entrar</strong></span>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default LoginScreen;