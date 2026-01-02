import React, { useEffect, useState, useRef } from 'react';
import { fetchPulses, createPulse, fetchUserChats, searchUsers, getChatId, sendFriendRequest, fetchNotifications, respondToFriendRequest, fetchDailyTopic, clearNotification } from '../services/dataService';
import { Pulse, AppScreen, ChatSummary, User, EmotionalState, Notification } from '../types';
import PulseCard from '../components/PulseCard';
import { Plus, Search, X, MessageCircle, Zap, Send, UserPlus, Loader2, Image as ImageIcon, Smile, Frown, Meh, Battery, BatteryCharging, Hash, Hexagon, User as UserIcon, Check, Bell, Flame, PenTool, ArrowRight, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onChatSelect?: (chatId: string, targetUser: User) => void;
  onViewProfile?: (userId: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onChatSelect, onViewProfile }) => {
  const { user } = useAuth();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    if (user) {
        refreshData();
        // Polling para notificações em tempo real (simulado)
        const interval = setInterval(() => {
            fetchNotifications(user.id).then(setNotifications);
        }, 10000);
        return () => clearInterval(interval);
    }
  }, [user]);

  // Foca no textarea quando abre o modal de criar pulse
  useEffect(() => {
      if (isCreatingPulse && textAreaRef.current) {
          setTimeout(() => textAreaRef.current?.focus(), 100);
      }
  }, [isCreatingPulse]);

  // Toast Timer
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
        fetchDailyTopic()
    ]).then(([pulsesData, chatsData, notifData, topicData]) => {
        setPulses(pulsesData);
        setChats(chatsData);
        setNotifications(notifData);
        if(topicData) setDailyTopic(topicData.title);
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
          // Otimistic update
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

  return (
    <div className="pb-24 h-full flex flex-col bg-zinc-950 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-zinc-100 text-zinc-950 px-6 py-2 rounded-full shadow-lg font-bold text-xs animate-fade-in flex items-center gap-2">
              <Check size={14} />
              {toastMessage}
          </div>
      )}

      {/* --- HEADER --- */}
      <header className="flex justify-between items-center px-6 pt-6 pb-2 shrink-0 bg-zinc-950 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-zinc-100 to-zinc-400 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <Hexagon className="text-zinc-950 fill-zinc-950 rotate-90" size={16} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 tracking-tight">ELO</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsNotificationsOpen(true)}
                className={`w-9 h-9 rounded-full bg-zinc-900 border flex items-center justify-center transition-colors relative ${notifications.length > 0 ? 'border-brand-primary/30 text-brand-primary bg-brand-primary/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
            >
                <Bell size={18} className={notifications.length > 0 ? 'animate-pulse' : ''} />
                {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-900"></span>
                )}
            </button>
             
             <button 
                onClick={() => setIsAddingFriend(true)}
                className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
                <UserPlus size={18} />
            </button>
            <button 
                onClick={() => onNavigate(AppScreen.PROFILE)}
                className="w-9 h-9 rounded-full overflow-hidden border border-zinc-800"
            >
                <img 
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name}&background=random`} 
                    className="w-full h-full object-cover" 
                    alt="Perfil" 
                />
            </button>
          </div>
      </header>

      {/* --- NOTIFICATIONS MODAL --- */}
      {isNotificationsOpen && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-sm flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                     <Bell size={20} className="text-brand-primary" /> Notificações
                 </h2>
                 <button onClick={() => setIsNotificationsOpen(false)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
                     <X size={20} />
                 </button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4">
                 {notifications.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-40 opacity-40">
                         <Bell size={40} className="mb-2" />
                         <p className="text-sm text-zinc-500 italic">Nada por aqui.</p>
                     </div>
                 ) : (
                     notifications.map(notif => (
                         <div key={notif.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden group">
                             {/* Indicador lateral */}
                             <div className={`absolute left-0 top-0 bottom-0 w-1 ${notif.type === 'FRIEND_REQUEST' ? 'bg-brand-primary' : notif.type === 'REQUEST_REJECTED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                             
                             <img src={notif.user.avatar_url} className="w-10 h-10 rounded-full bg-zinc-800" />
                             <div className="flex-1">
                                 <h4 className="text-zinc-100 font-medium text-sm">
                                     {notif.type === 'FRIEND_REQUEST' && <span><span className="font-bold">{notif.user.name}</span> quer conectar.</span>}
                                     {notif.type === 'REQUEST_ACCEPTED' && <span><span className="font-bold">{notif.user.name}</span> aceitou seu pedido!</span>}
                                     {notif.type === 'REQUEST_REJECTED' && <span><span className="font-bold">{notif.user.name}</span> recusou o pedido.</span>}
                                 </h4>
                                 <p className="text-[10px] text-zinc-500 mt-1">@{notif.user.username}</p>
                             </div>

                             {notif.type === 'FRIEND_REQUEST' ? (
                                 <div className="flex gap-2">
                                     <button onClick={() => handleRespondRequest(notif.id, false)} className="p-2 bg-zinc-800 rounded-full text-red-400 hover:bg-red-500/10"><X size={16}/></button>
                                     <button onClick={() => handleRespondRequest(notif.id, true)} className="p-2 bg-brand-primary text-zinc-950 rounded-full hover:scale-105 transition-transform"><Check size={16}/></button>
                                 </div>
                             ) : (
                                 <button onClick={() => handleClearNotification(notif)} className="p-2 text-zinc-600 hover:text-zinc-400">
                                     <X size={14} />
                                 </button>
                             )}
                         </div>
                     ))
                 )}
             </div>
          </div>
      )}

      {/* --- CREATE VIBE MODAL (FIXED) --- */}
      {isCreatingPulse && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-md flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6 shrink-0">
                 <h2 className="text-lg font-bold text-zinc-100">Nova Vibe</h2>
                 <button onClick={() => setIsCreatingPulse(false)} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
                     <X size={20} />
                 </button>
             </div>
             
             <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                 {pulseImage ? (
                     <div className="flex flex-col h-full">
                         <div className="relative w-full h-64 rounded-2xl overflow-hidden group shrink-0 mb-4 bg-zinc-900">
                             <img src={pulseImage} alt="Preview" className="w-full h-full object-contain" />
                             <button onClick={() => setPulseImage(null)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white backdrop-blur-md"><X size={16} /></button>
                         </div>
                         <textarea 
                            ref={textAreaRef}
                            value={newPulseContent}
                            onChange={(e) => setNewPulseContent(e.target.value)}
                            placeholder="Legenda da vibe..."
                            className="flex-1 bg-zinc-900/50 p-4 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none resize-none border border-zinc-800"
                            maxLength={100}
                        />
                     </div>
                 ) : (
                    <textarea 
                        ref={textAreaRef}
                        autoFocus
                        value={newPulseContent}
                        onChange={(e) => setNewPulseContent(e.target.value)}
                        placeholder="Compartilhe seu momento agora..."
                        className="flex-1 bg-transparent text-xl text-zinc-100 placeholder-zinc-600 outline-none resize-none leading-relaxed"
                        maxLength={200}
                    />
                 )}
             </div>
             
             <div className="space-y-4 shrink-0 mt-4">
                 <div>
                     <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Mood</p>
                     <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                         {emotions.map(emo => (
                             <button key={emo.key} onClick={() => setPulseEmotion(emo.key)} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium transition-all ${pulseEmotion === emo.key ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>{emo.icon}{emo.label}</button>
                         ))}
                     </div>
                 </div>
                 <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect}/>
                     <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-zinc-900 rounded-full text-zinc-400 hover:text-zinc-100"><ImageIcon size={20} /></button>
                     <button 
                        disabled={sendingPulse || (!newPulseContent.trim() && !pulseImage)} 
                        onClick={handleCreatePulse} 
                        className="bg-brand-primary text-zinc-950 font-bold px-6 py-3 rounded-full flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                     >
                         {sendingPulse ? 'Enviando...' : 'Publicar'}
                         <Send size={18} />
                     </button>
                 </div>
             </div>
          </div>
      )}

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
                    placeholder="Buscar pelo @username..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 pl-11 pr-4 py-3.5 rounded-2xl outline-none focus:border-brand-primary/50 transition-colors"
                 />
             </div>

             <div className="flex-1 overflow-y-auto space-y-3">
                 {isSearchingUsers ? (
                     <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-zinc-600" /></div>
                 ) : userSearchResults.length > 0 ? (
                     userSearchResults.map(result => (
                         <div key={result.user.id} className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:bg-zinc-900 transition-colors">
                             <img src={result.user.avatar_url} className="w-12 h-12 rounded-full bg-zinc-800 object-cover" />
                             <div className="flex-1 min-w-0">
                                 <h3 className="text-zinc-100 font-semibold truncate">{result.user.name}</h3>
                                 <p className="text-zinc-500 text-xs truncate">@{result.user.username}</p>
                             </div>
                             
                             {/* Botões de Ação baseados no Status */}
                             {result.friendshipStatus === 'accepted' ? (
                                 <button onClick={() => { if(onChatSelect) onChatSelect(getChatId(user!.id, result.user.id), result.user); setIsAddingFriend(false); }} className="p-2.5 bg-brand-primary text-zinc-950 rounded-full hover:scale-105 transition-transform"><MessageCircle size={20} /></button>
                             ) : result.friendshipStatus === 'pending' ? (
                                 <div className="flex items-center gap-1 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                                     <UserCheck size={14} className="text-zinc-400" />
                                     <span className="text-[10px] text-zinc-400 font-medium">Enviado</span>
                                 </div>
                             ) : (
                                 <button onClick={() => handleSendRequest(result.user.id)} className="p-2.5 bg-zinc-100 text-zinc-950 rounded-full hover:scale-105 transition-transform shadow-lg shadow-white/5"><UserPlus size={20} /></button>
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
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pt-4">
        
        {/* Daily Topic - Redesign */}
        <div className="px-6">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 p-5 rounded-3xl relative overflow-hidden group shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-500/20 p-2 rounded-full border border-orange-500/30">
                            <Flame size={16} className="text-orange-400" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-orange-400/80 font-bold">Tópico do Dia</span>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-zinc-100 leading-snug mb-4 pr-10 relative z-10">
                    "{dailyTopic}"
                </h3>

                <button 
                    onClick={handleReplyTopic}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-zinc-700"
                >
                    <PenTool size={14} />
                    Responder Agora
                </button>
            </div>
        </div>
            
        {/* Vibe Section - Scroll Melhorado */}
        <section className="">
            <div className="flex items-center justify-between mb-4 px-6">
                <h2 className="text-sm font-semibold text-zinc-200 tracking-tight flex items-center gap-2">
                    <Zap size={16} className="text-brand-primary" />
                    Vibe
                </h2>
            </div>
            
            <div className="flex overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory px-6 gap-4 scroll-pl-6 scroll-smooth">
                <div 
                    onClick={() => setIsCreatingPulse(true)}
                    className="min-w-[130px] w-[130px] h-[240px] border border-dashed border-zinc-800 bg-zinc-900/20 hover:border-zinc-600 transition-all rounded-3xl flex flex-col items-center justify-center shrink-0 cursor-pointer snap-start active:scale-95 touch-manipulation"
                >
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 shadow-lg group-hover:bg-zinc-700 transition-colors">
                        <Plus size={24} className="text-zinc-400" />
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">Nova Vibe</span>
                </div>

                {loading ? [1,2].map(i => <div key={i} className="min-w-[150px] h-[240px] bg-zinc-900/50 animate-pulse rounded-3xl snap-start"></div>) : 
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
                {/* Espaçador para o último item não colar na borda */}
                <div className="min-w-[10px] shrink-0"></div>
            </div>
        </section>

        {/* Chats Section */}
        <section className="px-6 pb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-200 tracking-tight flex items-center gap-2"><MessageCircle size={16} className="text-zinc-400" />Conversas</h2>
            </div>
            <div className="flex flex-col gap-3">
                 {chats.length === 0 ? (
                     <div className="text-center py-8 opacity-50"><p className="text-xs text-zinc-500">Sem conversas ativas.</p></div>
                 ) : (
                     chats.map(chat => (
                        <div key={chat.chatId} onClick={() => openExistingChat(chat)} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:border-zinc-700 group">
                            <div className="relative">
                                {/* Tratamento visual para usuário excluído */}
                                {chat.otherUser.is_deleted ? (
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700"><UserIcon size={20} className="text-zinc-600"/></div>
                                ) : (
                                    <img src={chat.otherUser.avatar_url} className="w-12 h-12 rounded-full object-cover border border-zinc-800" />
                                )}
                                {chat.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-primary rounded-full border-2 border-zinc-900"></span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className={`text-sm font-semibold truncate ${chat.otherUser.is_deleted ? 'text-zinc-500 italic' : 'text-zinc-200'}`}>{chat.otherUser.name}</h3>
                                    <span className="text-[10px] text-zinc-500 shrink-0">{new Date(chat.lastMessage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-xs text-zinc-400 truncate flex items-center gap-1 group-hover:text-zinc-300 transition-colors">{chat.lastMessage.sender_id === user?.id && <span className="text-zinc-500">Você: </span>}{chat.lastMessage.content}</p>
                            </div>
                            <ArrowRight size={16} className="text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity -ml-2" />
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