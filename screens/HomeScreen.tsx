import React, { useEffect, useState, useRef } from 'react';
import { fetchPulses, createPulse, fetchUserChats, searchUsers, getChatId, sendFriendRequest, fetchNotifications, respondToFriendRequest, fetchDailyTopic, clearNotification, getFriendsCount } from '../services/dataService';
import { Pulse, AppScreen, ChatSummary, User, EmotionalState, Notification } from '../types';
import PulseCard from '../components/PulseCard';
import { Plus, Search, X, MessageCircle, Zap, Send, UserPlus, Loader2, Image as ImageIcon, Smile, Frown, Meh, Battery, BatteryCharging, Hash, Hexagon, User as UserIcon, Check, Bell, Flame, PenTool, ArrowRight, UserCheck, UserX, Sparkles, Users, Filter, Ghost, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onChatSelect?: (chatId: string, targetUser: User) => void;
  onViewProfile?: (userId: string) => void;
  vibeTrigger?: number; // Prop para abrir modal
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onChatSelect, onViewProfile, vibeTrigger }) => {
  const { user } = useAuth();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);
  
  // INOVAÇÃO: Zen Mode (Filtra ruído)
  const [isZenMode, setIsZenMode] = useState(false);

  // Create Vibe State
  const [isCreatingPulse, setIsCreatingPulse] = useState(false);
  const [newPulseContent, setNewPulseContent] = useState('');
  const [newPulseDescription, setNewPulseDescription] = useState('');
  const [pulseEmotion, setPulseEmotion] = useState<EmotionalState>('neutro');
  const [pulseImage, setPulseImage] = useState<string | null>(null);
  const [sendingPulse, setSendingPulse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Friends & Notifications
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{user: User, friendshipStatus: string | null}[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Daily Topic
  const [dailyTopic, setDailyTopic] = useState("Carregando inspiração...");

  // Watch for Vibe Trigger from Layout
  useEffect(() => {
      if (vibeTrigger && vibeTrigger > 0) {
          setIsCreatingPulse(true);
      }
  }, [vibeTrigger]);

  useEffect(() => {
    if (user) {
        refreshData();
        const interval = setInterval(() => {
            fetchNotifications(user.id).then(setNotifications);
            fetchUserChats(user.id).then(setChats);
        }, 5000); 
        return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
      if (isCreatingPulse && textAreaRef.current) {
          setTimeout(() => textAreaRef.current?.focus(), 100);
      }
  }, [isCreatingPulse]);

  useEffect(() => {
      if(toastMessage) {
          const t = setTimeout(() => setToastMessage(null), 3000);
          return () => clearTimeout(t);
      }
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  const refreshData = () => {
    setLoading(true);
    Promise.all([
        fetchPulses(),
        fetchUserChats(user!.id),
        fetchNotifications(user!.id),
        fetchDailyTopic(),
        getFriendsCount(user!.id)
    ]).then(([pulsesData, chatsData, notifData, topicData, count]) => {
        setPulses(pulsesData);
        setChats(chatsData);
        setNotifications(notifData);
        if(topicData) setDailyTopic(topicData.title);
        setFriendCount(count);
        setLoading(false);
    });
  };

  const removePulseFromList = (pulseId: string) => {
      setPulses(prev => prev.filter(p => p.id !== pulseId));
  };

  // --- VIBE HANDLERS ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setPulseImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCreatePulse = async () => {
    if ((!newPulseContent.trim() && !pulseImage) || !user) return;
    setSendingPulse(true);
    
    const content = pulseImage || newPulseContent;
    const isImage = !!pulseImage;
    const description = isImage ? newPulseContent : '';

    await createPulse(
        content, 
        user.id, 
        user.name || 'Usuário', 
        user.avatar_url || '',
        pulseEmotion,
        isImage,
        description
    );
    
    setSendingPulse(false);
    setIsCreatingPulse(false);
    setNewPulseContent('');
    setNewPulseDescription('');
    setPulseImage(null);
    setPulseEmotion('neutro');
    showToast("Vibe compartilhada!");
    refreshData();
  };

  const handleReplyTopic = () => {
      const topicText = `Tópico do Dia: "${dailyTopic}"\n\nR: `;
      setNewPulseContent(topicText);
      setIsCreatingPulse(true);
  };

  // --- FRIENDS HANDLERS ---

  const handleUserSearch = async (query: string) => {
      setUserSearchQuery(query);
      if (query.length >= 3 && user) {
          setIsSearchingUsers(true);
          const results = await searchUsers(query, user.id);
          setUserSearchResults(results);
          setIsSearchingUsers(false);
      } else {
          setUserSearchResults([]);
      }
  };

  const handleSendRequest = async (targetId: string) => {
      if(!user) return;
      await sendFriendRequest(user.id, targetId);
      setUserSearchResults(prev => prev.map(item => 
          item.user.id === targetId ? {...item, friendshipStatus: 'pending'} : item
      ));
      showToast("Solicitação enviada!");
  };

  const handleRespondRequest = async (reqId: string, accept: boolean) => {
      const success = await respondToFriendRequest(reqId, accept);
      if (success) {
          setNotifications(prev => prev.filter(n => n.id !== reqId));
          showToast(accept ? "Conexão aceita!" : "Solicitação recusada.");
          if(accept) refreshData(); 
      }
  };

  const handleClearNotification = async (n: Notification) => {
      await clearNotification(n.id, n.type);
      setNotifications(prev => prev.filter(item => item.id !== n.id));
  };

  const openExistingChat = (summary: ChatSummary) => {
      if (onChatSelect) {
          const u: User = {
              id: summary.otherUser.id,
              name: summary.otherUser.name,
              username: summary.otherUser.username,
              avatar_url: summary.otherUser.avatar_url,
              email: ''
          };
          onChatSelect(summary.chatId, u);
      }
  };

  const emotions: {key: EmotionalState, icon: React.ReactNode, label: string}[] = [
      { key: 'neutro', icon: <Meh size={18} />, label: 'Neutro' },
      { key: 'feliz', icon: <Smile size={18} />, label: 'Feliz' },
      { key: 'triste', icon: <Frown size={18} />, label: 'Reflexivo' },
      { key: 'energizado', icon: <BatteryCharging size={18} />, label: 'Energia' },
      { key: 'cansado', icon: <Battery size={18} />, label: 'Baixa' },
      { key: 'focado', icon: <Zap size={18} />, label: 'Foco' },
  ];

  // Logic for Zen Mode Filtering
  const activeChats = chats.filter(c => !c.isNewConnection).filter(c => {
      if (!isZenMode) return true;
      // Zen Mode: Mostra apenas se tem mensagem não lida OU se a mensagem é recente (< 24h)
      if (c.unreadCount > 0) return true;
      if (c.lastMessage) {
          const msgDate = new Date(c.lastMessage.created_at);
          const now = new Date();
          const diffHours = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
          return diffHours < 24;
      }
      return false;
  });

  const newConnections = chats.filter(c => c.isNewConnection);

  return (
    <div className={`pb-24 h-full flex flex-col bg-zinc-950 relative transition-colors duration-700 ${isZenMode ? 'bg-[#0a0a0c]' : ''}`}>
      
      {/* Toast */}
      {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] bg-white text-zinc-950 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] font-bold text-xs animate-fade-in flex items-center gap-2 border border-white/50 backdrop-blur-md">
              <Check size={14} className="text-brand-primary" />
              {toastMessage}
          </div>
      )}

      {/* --- HEADER FUTURISTA --- */}
      <header className="flex justify-between items-center px-6 pt-6 pb-2 shrink-0 bg-transparent sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg ${isZenMode ? 'bg-indigo-500/20 shadow-indigo-500/20' : 'bg-gradient-to-br from-zinc-100 to-zinc-400 shadow-white/10'}`}>
                <Hexagon className={`transition-all duration-500 rotate-90 ${isZenMode ? 'text-indigo-400 fill-indigo-400/20' : 'text-zinc-950 fill-zinc-950'}`} size={20} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 tracking-tight">ELO</h1>
                {isZenMode && <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-bold animate-pulse">Zen Ativo</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
             
             {/* Zen Mode Toggle */}
             <button 
                onClick={() => setIsZenMode(!isZenMode)}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-500 ${isZenMode ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
             >
                <Filter size={18} />
             </button>

             <button 
                onClick={() => setIsNotificationsOpen(true)}
                className={`w-10 h-10 rounded-full bg-zinc-900 border flex items-center justify-center transition-colors relative ${notifications.length > 0 ? 'border-brand-primary/30 text-brand-primary bg-brand-primary/5' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
            >
                <Bell size={18} className={notifications.length > 0 ? 'animate-pulse' : ''} />
                {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-brand-primary rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                )}
            </button>
             
            <button 
                onClick={() => onNavigate(AppScreen.PROFILE)}
                className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 ring-2 ring-transparent hover:ring-zinc-700 transition-all"
            >
                <img 
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name}&background=random`} 
                    className="w-full h-full object-cover" 
                    alt="Perfil" 
                />
            </button>
          </div>
      </header>

      {/* --- NOTIFICATIONS HUD (HOLOGRAPHIC STYLE) --- */}
      {isNotificationsOpen && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                 <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3 tracking-wide">
                     <Bell size={24} className="text-brand-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                     CENTRAL
                 </h2>
                 <button onClick={() => setIsNotificationsOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-zinc-400 hover:text-white border border-white/5">
                     <X size={20} />
                 </button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4">
                 {notifications.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-60 opacity-30 border border-dashed border-zinc-700 rounded-3xl m-4">
                         <Bell size={48} className="mb-4 text-zinc-500" />
                         <p className="text-sm text-zinc-400 font-mono uppercase tracking-widest">Sem Sinais</p>
                     </div>
                 ) : (
                     notifications.map(notif => (
                         <div key={notif.id} className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group shadow-lg hover:border-brand-primary/30 transition-colors">
                             <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${notif.type === 'FRIEND_REQUEST' ? 'bg-brand-primary shadow-[0_0_10px_#10b981]' : notif.type === 'REQUEST_REJECTED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                             
                             <div className="relative">
                                 <img src={notif.user.avatar_url} className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10" />
                                 <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1">
                                     {notif.type === 'FRIEND_REQUEST' && <UserPlus size={10} className="text-brand-primary" />}
                                 </div>
                             </div>

                             <div className="flex-1">
                                 <h4 className="text-zinc-100 font-medium text-sm leading-tight mb-1">
                                     {notif.type === 'FRIEND_REQUEST' && <span><span className="font-bold text-white">{notif.user.name}</span> quer se conectar.</span>}
                                     {notif.type === 'REQUEST_ACCEPTED' && <span><span className="font-bold text-white">{notif.user.name}</span> está no seu círculo.</span>}
                                     {notif.type === 'REQUEST_REJECTED' && <span><span className="font-bold text-white">{notif.user.name}</span> recusou.</span>}
                                 </h4>
                                 <p className="text-[10px] text-zinc-500 font-mono">@{notif.user.username} • {new Date(notif.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                             </div>

                             {notif.type === 'FRIEND_REQUEST' ? (
                                 <div className="flex gap-3">
                                     <button onClick={() => handleRespondRequest(notif.id, false)} className="w-9 h-9 flex items-center justify-center bg-zinc-900 rounded-full text-red-400 border border-zinc-800 hover:border-red-500/50 transition-colors"><X size={16}/></button>
                                     <button onClick={() => handleRespondRequest(notif.id, true)} className="w-9 h-9 flex items-center justify-center bg-brand-primary text-zinc-950 rounded-full hover:scale-110 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.4)]"><Check size={16}/></button>
                                 </div>
                             ) : (
                                 <button onClick={() => handleClearNotification(notif)} className="text-zinc-600 hover:text-white">
                                     <X size={16} />
                                 </button>
                             )}
                         </div>
                     ))
                 )}
             </div>
          </div>
      )}

      {/* --- CREATE VIBE MODAL --- */}
      {isCreatingPulse && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-md flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6 shrink-0">
                 <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                     <Zap className="text-brand-primary" size={20} /> Nova Vibe
                 </h2>
                 <button onClick={() => setIsCreatingPulse(false)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
                     <X size={20} />
                 </button>
             </div>
             
             <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                 {pulseImage ? (
                     <div className="flex flex-col h-full">
                         <div className="relative w-full h-64 rounded-3xl overflow-hidden group shrink-0 mb-4 bg-zinc-900 border border-zinc-800">
                             <img src={pulseImage} alt="Preview" className="w-full h-full object-contain" />
                             <button onClick={() => setPulseImage(null)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white backdrop-blur-md hover:bg-red-500/20"><X size={16} /></button>
                         </div>
                         <textarea 
                            ref={textAreaRef}
                            value={newPulseContent}
                            onChange={(e) => setNewPulseContent(e.target.value)}
                            placeholder="Legenda da vibe..."
                            className="flex-1 bg-zinc-900/50 p-5 rounded-2xl text-sm text-zinc-100 placeholder-zinc-600 outline-none resize-none border border-zinc-800 focus:border-zinc-600 transition-colors"
                            maxLength={100}
                        />
                     </div>
                 ) : (
                    <textarea 
                        ref={textAreaRef}
                        autoFocus
                        value={newPulseContent}
                        onChange={(e) => setNewPulseContent(e.target.value)}
                        placeholder="O que está vibrando no seu mundo agora?"
                        className="flex-1 bg-transparent text-2xl font-light text-zinc-100 placeholder-zinc-700 outline-none resize-none leading-relaxed"
                        maxLength={200}
                    />
                 )}
             </div>
             
             <div className="space-y-4 shrink-0 mt-4">
                 <div>
                     <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">Sintonize o Mood</p>
                     <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                         {emotions.map(emo => (
                             <button key={emo.key} onClick={() => setPulseEmotion(emo.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium transition-all ${pulseEmotion === emo.key ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>{emo.icon}{emo.label}</button>
                         ))}
                     </div>
                 </div>
                 <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect}/>
                     <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-zinc-900 rounded-full text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-600 transition-all"><ImageIcon size={20} /></button>
                     <button 
                        disabled={sendingPulse || (!newPulseContent.trim() && !pulseImage)} 
                        onClick={handleCreatePulse} 
                        className="bg-brand-primary text-zinc-950 font-bold px-8 py-3.5 rounded-full flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                     >
                         {sendingPulse ? 'Transmitindo...' : 'Publicar'}
                         <Send size={18} />
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* ... (rest of the file remains similar but truncated for brevity) */}
      {/* ... (Search User Modal, Feed, etc.) */}
      
      {/* --- BUSCA DE USUÁRIOS MODAL --- */}
      {isAddingFriend && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-sm flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                     <UserPlus size={20} className="text-brand-secondary" /> Nova Conexão
                 </h2>
                 <button onClick={() => { setIsAddingFriend(false); setUserSearchQuery(''); setUserSearchResults([]) }} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
                     <X size={20} />
                 </button>
             </div>
             
             <div className="relative mb-6">
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                 <input 
                    autoFocus
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    placeholder="Buscar @username..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 pl-11 pr-4 py-4 rounded-2xl outline-none focus:border-brand-primary/50 transition-colors shadow-inner"
                 />
             </div>

             <div className="flex-1 overflow-y-auto space-y-3">
                 {isSearchingUsers ? (
                     <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-zinc-600" /></div>
                 ) : userSearchResults.length > 0 ? (
                     userSearchResults.map(result => (
                         <div key={result.user.id} className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 hover:bg-zinc-900 transition-colors">
                             <img src={result.user.avatar_url} className="w-12 h-12 rounded-full bg-zinc-800 object-cover" />
                             <div className="flex-1 min-w-0">
                                 <h3 className="text-zinc-100 font-semibold truncate">{result.user.name}</h3>
                                 <p className="text-zinc-500 text-xs truncate">@{result.user.username}</p>
                             </div>
                             {result.friendshipStatus === 'accepted' ? (
                                 <button onClick={() => { if(onChatSelect) onChatSelect(getChatId(user!.id, result.user.id), result.user); setIsAddingFriend(false); }} className="p-3 bg-brand-primary text-zinc-950 rounded-full hover:scale-105 transition-transform"><MessageCircle size={20} /></button>
                             ) : result.friendshipStatus === 'pending' ? (
                                 <div className="flex items-center gap-1 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                                     <UserCheck size={14} className="text-zinc-400" />
                                     <span className="text-[10px] text-zinc-400 font-medium">Enviado</span>
                                 </div>
                             ) : (
                                 <button onClick={() => handleSendRequest(result.user.id)} className="p-3 bg-zinc-100 text-zinc-950 rounded-full hover:scale-105 transition-transform shadow-lg shadow-white/5"><UserPlus size={20} /></button>
                             )}
                         </div>
                     ))
                 ) : (
                     <div className="flex flex-col items-center justify-center mt-20 opacity-30">
                         <UserIcon size={40} className="mb-2" />
                         <p className="text-center text-zinc-500 text-xs">Busque amigos pelo username</p>
                     </div>
                 )}
             </div>
          </div>
      )}

      {/* --- FEED --- */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pt-4">
        
        {/* Daily Topic */}
        <div className="px-6">
            <div className="glass-panel p-6 rounded-[24px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-500/10 p-1.5 rounded-full border border-orange-500/20">
                            <Flame size={14} className="text-orange-400" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-orange-400/90 font-bold">Tópico do Dia</span>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-zinc-100 leading-snug mb-5 pr-10 relative z-10 font-serif italic">
                    "{dailyTopic}"
                </h3>

                <button 
                    onClick={handleReplyTopic}
                    className="w-full bg-zinc-800/50 hover:bg-zinc-700/50 active:scale-[0.98] text-zinc-200 py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-white/5"
                >
                    <PenTool size={14} />
                    Responder Agora
                </button>
            </div>
        </div>
            
        {/* Vibe Section */}
        <section className="">
            <div className="flex items-center justify-between mb-5 px-6">
                <h2 className="text-sm font-bold text-zinc-200 tracking-wide flex items-center gap-2">
                    <Zap size={16} className="text-brand-primary" />
                    Vibe Check
                </h2>
            </div>
            
            <div className="flex overflow-x-auto no-scrollbar pb-6 snap-x snap-mandatory px-6 gap-4 scroll-pl-6 scroll-smooth">
                <div 
                    onClick={() => setIsCreatingPulse(true)}
                    className="min-w-[130px] w-[130px] h-[260px] border border-dashed border-zinc-800 bg-zinc-900/10 hover:border-zinc-600 transition-all rounded-[20px] flex flex-col items-center justify-center shrink-0 cursor-pointer snap-start active:scale-95 touch-manipulation group"
                >
                    <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center mb-4 shadow-lg group-hover:bg-zinc-800 transition-colors border border-zinc-800">
                        <Plus size={24} className="text-zinc-500 group-hover:text-zinc-200" />
                    </div>
                    <span className="text-xs text-zinc-500 font-medium group-hover:text-zinc-300">Criar Vibe</span>
                </div>

                {loading ? [1,2].map(i => <div key={i} className="min-w-[160px] h-[260px] bg-zinc-900/50 animate-pulse rounded-[20px] snap-start border border-zinc-800"></div>) : 
                    pulses.map(pulse => (
                        <PulseCard 
                            key={pulse.id} 
                            pulse={pulse} 
                            currentUserId={user?.id || ''} 
                            onDelete={removePulseFromList} 
                            onClickProfile={(uid) => {
                                if(onViewProfile) onViewProfile(uid);
                            }}
                        />
                    ))
                }
                <div className="min-w-[10px] shrink-0"></div>
            </div>
        </section>

        {/* Active Chats */}
        <section className="px-6 pb-6 min-h-[300px]">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-zinc-200 tracking-wide flex items-center gap-2">
                    <MessageCircle size={16} className={isZenMode ? "text-indigo-400" : "text-zinc-400"} />
                    {isZenMode ? 'Conversas em Foco' : 'Conexões Ativas'}
                </h2>
                {isZenMode && <span className="text-[9px] px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md font-mono">ZEN ON</span>}
            </div>
            
            {/* New Connections */}
            {!isZenMode && newConnections.length > 0 && (
                <div className="flex gap-4 overflow-x-auto no-scrollbar mb-6 pb-2">
                     {newConnections.map(chat => (
                        <div 
                            key={chat.chatId} 
                            onClick={() => openExistingChat(chat)}
                            className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group"
                        >
                            <div className="w-16 h-16 rounded-2xl p-[1px] bg-gradient-to-br from-brand-secondary to-transparent group-hover:from-white group-hover:to-zinc-500 transition-all relative">
                                <img 
                                    src={chat.otherUser.avatar_url} 
                                    className="w-full h-full rounded-2xl object-cover bg-zinc-900 border-2 border-zinc-950" 
                                    alt={chat.otherUser.name}
                                />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-950 rounded-full flex items-center justify-center">
                                    <div className="w-3 h-3 bg-brand-secondary rounded-full animate-pulse"></div>
                                </div>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-medium truncate w-full text-center group-hover:text-zinc-200">{chat.otherUser.name.split(' ')[0]}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3">
                 {activeChats.length === 0 ? (
                     <div className="text-center py-16 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10">
                         <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-600 border border-zinc-800">
                             {isZenMode ? <Ghost size={24} className="text-indigo-400" /> : <Users size={24} />}
                         </div>
                         <p className="text-xs text-zinc-500 mb-3">{isZenMode ? "Tudo calmo por aqui. Nenhum foco necessário." : "Sua lista de conversas está vazia."}</p>
                         {!isZenMode && (
                             <button onClick={() => setIsAddingFriend(true)} className="px-5 py-2 bg-zinc-100 text-zinc-950 rounded-full text-xs font-bold hover:scale-105 transition-transform">
                                 Adicionar Amigos
                             </button>
                         )}
                     </div>
                 ) : (
                     activeChats.map(chat => (
                        <div key={chat.chatId} onClick={() => openExistingChat(chat)} className={`bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:bg-zinc-900/80 hover:border-zinc-700 group ${isZenMode ? 'border-indigo-500/10' : ''}`}>
                            <div className="relative">
                                {chat.otherUser.is_deleted ? (
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700"><UserIcon size={20} className="text-zinc-600"/></div>
                                ) : (
                                    <img src={chat.otherUser.avatar_url} className={`w-12 h-12 rounded-full object-cover border ${isZenMode ? 'border-indigo-500/30' : 'border-zinc-800'}`} />
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className={`text-sm font-bold truncate ${chat.otherUser.is_deleted ? 'text-zinc-500 italic' : 'text-zinc-200'}`}>{chat.otherUser.name}</h3>
                                    <div className="flex flex-col items-end gap-1">
                                        {chat.lastMessage && (
                                            <span className={`text-[10px] font-medium shrink-0 ${chat.unreadCount > 0 ? 'text-brand-primary' : 'text-zinc-500'}`}>
                                                {new Date(chat.lastMessage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <p className={`text-xs truncate flex items-center gap-1 group-hover:text-zinc-300 transition-colors flex-1 ${chat.unreadCount > 0 ? 'text-zinc-100 font-medium' : 'text-zinc-400'}`}>
                                        {chat.lastMessage ? (
                                            <>
                                                {chat.lastMessage.sender_id === user?.id && <span className="text-zinc-600 font-normal">Você: </span>}
                                                {chat.lastMessage.type === 'image' ? (
                                                    <span className="flex items-center gap-1 italic text-zinc-300"><ImageIcon size={12}/> Foto</span>
                                                ) : chat.lastMessage.type === 'location' ? (
                                                     <span className="flex items-center gap-1 italic text-brand-primary"><MapPin size={12}/> Localização</span>
                                                ) : (
                                                    chat.lastMessage.content
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-zinc-600 italic">Toque para iniciar...</span>
                                        )}
                                    </p>
                                    
                                    {/* Unread Badge */}
                                    {chat.unreadCount > 0 && (
                                        <div className="ml-2 bg-brand-primary text-zinc-950 min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                                            <span className="text-[10px] font-bold leading-none">{chat.unreadCount}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                     ))
                 )}
            </div>
        </section>
      </div>
    </div>
  );
};

export default HomeScreen;