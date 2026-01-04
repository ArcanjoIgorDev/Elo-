
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchPulses, createPulse, fetchUserChats, searchUsers, sendFriendRequest, fetchNotifications, respondToFriendRequest, fetchFeed, createPost, clearNotification, markAllNotificationsRead, formatDisplayName } from '../services/dataService';
import { Pulse, AppScreen, ChatSummary, User, EmotionalState, Notification, Post } from '../types';
import PulseCard from '../components/PulseCard';
import PostCard from '../components/PostCard';
import { Plus, Search, X, Zap, Send, UserPlus, Loader2, Image as ImageIcon, Smile, Bell, Hexagon, Check, Edit3, Share2, Mic, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onChatSelect?: (chatId: string, targetUser: User) => void;
  onViewProfile?: (userId: string) => void;
  vibeTrigger?: number;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onChatSelect, onViewProfile, vibeTrigger }) => {
  const { user } = useAuth();
  
  // Data
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [feed, setFeed] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'feed' | 'chats'>('feed');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Creation & Action Menu States
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isCreatingPulse, setIsCreatingPulse] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  
  // Input State
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [emotion, setEmotion] = useState<EmotionalState>('neutro');
  const [allowComments, setAllowComments] = useState(true);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Search State
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Pull to refresh logic
  const [touchStart, setTouchStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    if (vibeTrigger && vibeTrigger > 0) setIsActionMenuOpen(true);
  }, [vibeTrigger]);

  useEffect(() => {
    if (user) {
        refreshData();
        
        const notifChannel = supabase.channel('realtime_home')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, async (payload) => {
                const newNotifRaw = payload.new;
                const { data: actor } = await supabase.from('users_meta').select('*').eq('user_id', newNotifRaw.actor_id).single();
                
                const newNotif: Notification = {
                    id: newNotifRaw.id,
                    type: newNotifRaw.type,
                    user: actor ? { id: actor.user_id, name: actor.name, username: actor.username, avatar_url: actor.avatar_url, email: '' } : { id: 'unknown', email: '' },
                    timestamp: newNotifRaw.created_at,
                    read: false,
                    entity_id: newNotifRaw.entity_id
                };

                setNotifications(prev => [newNotif, ...prev]);
                setUnreadNotifCount(prev => prev + 1);
                showToast("Nova notificação!");
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=ilike.%${user.id}%` }, () => {
                 fetchUserChats(user.id).then(setChats);
            })
            .subscribe();

        return () => { supabase.removeChannel(notifChannel); };
    }
  }, [user]);

  useEffect(() => {
      if(toastMessage) { const t = setTimeout(() => setToastMessage(null), 3000); return () => clearTimeout(t); }
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  const refreshData = async () => {
    if(!user) return;
    setIsRefreshing(true);
    try {
        const [p, c, n, f] = await Promise.all([
            fetchPulses(),
            fetchUserChats(user.id),
            fetchNotifications(user.id),
            fetchFeed(user.id, true)
        ]);
        setPulses(p);
        setChats(c);
        setNotifications(n);
        setUnreadNotifCount(n.filter(notif => !notif.read).length);
        setFeed(f);
    } catch(e) { console.error(e); }
    setIsRefreshing(false);
    setPullDistance(0);
  };

  const handleOpenNotifications = async () => {
      setIsNotificationsOpen(true);
      if (unreadNotifCount > 0 && user) {
          await markAllNotificationsRead(user.id);
          setUnreadNotifCount(0);
          setNotifications(prev => prev.map(n => ({...n, read: true})));
      }
  };

  const handleClearNotification = async (id: string, type: any) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await clearNotification(id, type);
  };

  const handleMentionClick = useCallback(async (username: string) => {
      if (user) {
          const results = await searchUsers(username, user.id);
          if (results.length > 0) {
              const target = results[0].user;
              if (onViewProfile) onViewProfile(target.id);
          } else {
              showToast("Usuário não encontrado.");
          }
      }
  }, [user, onViewProfile]);

  const resetCreation = () => {
      setContent('');
      setMediaFile(null);
      setMediaPreview(null);
      setEmotion('neutro');
      setIsCreatingPulse(false);
      setIsCreatingPost(false);
      setIsUploading(false);
      setIsActionMenuOpen(false); 
      cancelRecording();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setMediaFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setMediaPreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  // --- AUDIO RECORDING FIXED ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      } catch (err) {
          alert("Permita o uso do microfone.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              setMediaFile(audioBlob);
              setMediaPreview("AUDIO_RECORDED"); 
              setIsRecording(false);
              cleanupRecording();
          };
          mediaRecorderRef.current.stop();
      }
  };

  const cancelRecording = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setRecordingTime(0);
      cleanupRecording();
  };

  const cleanupRecording = () => {
      if (timerRef.current) clearInterval(timerRef.current!);
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
      }
  };
  // -----------------------

  const handleSubmitPulse = async () => {
      if (!user || (!content.trim() && !mediaFile)) return;
      setIsUploading(true);
      const newP = await createPulse(content, user.id, user.name || 'User', user.avatar_url || '', emotion, 'text', '', mediaFile || undefined);
      showToast("Vibe lançada!");
      if(newP) setPulses(prev => [newP, ...prev]);
      resetCreation();
  };

  const handleSubmitPost = async () => {
      if (!user || (!content.trim() && !mediaFile)) return;
      setIsUploading(true);
      await createPost(user.id, content, mediaFile as File, allowComments);
      showToast("Publicado no Feed!");
      resetCreation();
      refreshData();
  };

  // --- TOUCH HANDLERS FOR REFRESH SMOOTHED ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (contentRef.current && contentRef.current.scrollTop <= 5) { // Threshold
          setTouchStart(e.targetTouches[0].clientY);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (touchStart > 0 && contentRef.current?.scrollTop <= 5) {
          const touchY = e.targetTouches[0].clientY;
          const diff = touchY - touchStart;
          if (diff > 0 && diff < 150) { // Limit drag distance
              setPullDistance(diff);
          }
      }
  };

  const handleTouchEnd = () => {
      if (pullDistance > 80) refreshData();
      else setPullDistance(0);
      setTouchStart(0);
  };
  // ----------------------------------

  return (
    <div className="pb-24 h-full flex flex-col bg-zinc-950 relative transition-colors duration-700">
      
      {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] bg-white text-zinc-950 px-6 py-3 rounded-full shadow-xl font-bold text-xs animate-fade-in flex items-center gap-2 border border-white/50 backdrop-blur-md">
              <Check size={14} className="text-brand-primary" /> {toastMessage}
          </div>
      )}

      {/* Modern Header */}
      <header className="flex justify-between items-center px-6 pt-safe pb-4 sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <Hexagon className="text-black fill-black rotate-90" size={18} strokeWidth={2} />
             </div>
             <h1 className="text-lg font-bold text-white tracking-tight">ELO</h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsAddingFriend(true)} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-all"><UserPlus size={18} strokeWidth={1.5} /></button>
             <button onClick={handleOpenNotifications} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-all relative">
                <Bell size={18} strokeWidth={1.5} />
                {unreadNotifCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full ring-2 ring-zinc-950"></span>}
            </button>
            <button onClick={() => onNavigate(AppScreen.PROFILE)} className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 hover:border-zinc-500 transition-colors"><img src={user?.avatar_url} className="w-full h-full object-cover" /></button>
          </div>
      </header>

      {/* Vibes Scroll Area */}
      <div className="relative w-full py-6 pl-6 overflow-hidden">
          <div className="flex overflow-x-auto no-scrollbar gap-4 snap-x snap-mandatory pr-6 items-center">
              <div className="sticky left-0 z-10 snap-start">
                   <div onClick={() => setIsCreatingPulse(true)} className="min-w-[100px] w-[100px] h-[160px] border border-dashed border-zinc-800 bg-zinc-900/80 backdrop-blur-md rounded-[24px] flex flex-col items-center justify-center shrink-0 cursor-pointer hover:border-brand-primary/50 hover:bg-zinc-900 transition-all shadow-xl group">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner"><Plus size={24} className="text-zinc-400 group-hover:text-white"/></div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300">Criar</span>
                  </div>
              </div>
              {pulses.map(p => (
                  <PulseCard key={p.id} pulse={{...p, user_name: formatDisplayName(p.user_name)}} currentUserId={user?.id || ''} onDelete={() => {}} onClickProfile={(uid) => onViewProfile && onViewProfile(uid)}/>
              ))}
          </div>
          <div className="absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none"></div>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-2 sticky top-[72px] z-20 bg-zinc-950/90 backdrop-blur-md pb-2 pt-2">
          <div className="p-1 bg-zinc-900/80 rounded-xl flex border border-zinc-800">
              <button onClick={() => setActiveTab('feed')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Feed Global</button>
              <button onClick={() => setActiveTab('chats')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'chats' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Conversas</button>
          </div>
      </div>

      {/* Pull to Refresh Indicator */}
      <div className="flex justify-center transition-all overflow-hidden" style={{ height: pullDistance > 0 ? pullDistance : 0, opacity: Math.min(1, pullDistance / 100) }}>
           <div className="flex items-center gap-2 text-zinc-500 text-xs py-2">
               <RefreshCw size={16} className={`transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''} ${pullDistance > 80 ? 'rotate-180 text-brand-primary' : ''}`} /> 
               {isRefreshing ? 'Atualizando...' : (pullDistance > 80 ? 'Solte' : 'Puxe')}
           </div>
      </div>

      {/* Content Area */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar pt-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
          {activeTab === 'feed' ? (
              <>
                <div onClick={() => setIsCreatingPost(true)} className="bg-zinc-900/50 border border-zinc-800 rounded-[24px] p-4 mb-8 flex items-center gap-4 cursor-pointer hover:bg-zinc-900 transition-colors group">
                    <img src={user?.avatar_url} className="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
                    <span className="text-zinc-500 text-sm font-medium">Compartilhe um pensamento ou áudio...</span>
                    <div className="ml-auto flex gap-3">
                         <Mic size={20} className="text-zinc-600 group-hover:text-brand-primary transition-colors"/>
                         <ImageIcon size={20} className="text-zinc-600 group-hover:text-zinc-400 transition-colors"/>
                    </div>
                </div>
                
                {feed.map(post => (
                    <PostCard 
                        key={post.id} 
                        post={post} 
                        currentUser={user!} 
                        onProfileClick={(uid) => onViewProfile && onViewProfile(uid)}
                        onMentionClick={handleMentionClick}
                        onDelete={(id) => setFeed(prev => prev.filter(p => p.id !== id))}
                    />
                ))}
                {feed.length === 0 && !isRefreshing && <div className="text-center py-20 text-zinc-600 text-xs">O feed está silencioso. Seja o primeiro a postar.</div>}
              </>
          ) : (
              <div className="space-y-2">
                  {chats.length === 0 ? <div className="text-center py-20 text-zinc-600 text-xs">Nenhuma conversa ativa.</div> : 
                  chats.map(chat => (
                      <div key={chat.chatId} onClick={() => onChatSelect && onChatSelect(chat.chatId, chat.otherUser)} className="bg-zinc-900/30 border border-zinc-800/50 p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-900 rounded-2xl transition-all group">
                           <div className="relative">
                                <img src={chat.otherUser.avatar_url} className="w-12 h-12 rounded-full object-cover bg-zinc-800 border border-zinc-800 group-hover:border-zinc-600 transition-colors" />
                                {chat.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-primary rounded-full border-2 border-zinc-950"></span>}
                           </div>
                           <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-center">
                                   <h3 className="font-bold text-zinc-200 text-sm">{formatDisplayName(chat.otherUser.name)}</h3>
                                   <span className="text-[10px] text-zinc-600">{new Date(chat.lastMessage?.created_at || '').toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                               </div>
                               <p className={`text-xs truncate mt-1 ${chat.unreadCount > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                                   {chat.lastMessage?.type === 'audio' ? '🎤 Áudio' : ''}
                                   {chat.lastMessage?.sender_id === user?.id ? 'Você: ' : ''}{chat.lastMessage?.content || '...'}
                               </p>
                           </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* ACTION MENU */}
      {isActionMenuOpen && (
          <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-end justify-center pb-24 animate-fade-in" onClick={() => setIsActionMenuOpen(false)}>
              <div className="w-full max-w-sm grid grid-cols-2 gap-4 px-6 mb-8" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setIsActionMenuOpen(false); setIsCreatingPulse(true); }} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-3 hover:scale-105 transition-transform hover:border-brand-primary/50 group">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors">
                          <Zap size={24} />
                      </div>
                      <span className="text-sm font-bold text-white">Nova Vibe</span>
                  </button>
                  <button onClick={() => { setIsActionMenuOpen(false); setIsCreatingPost(true); }} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-3 hover:scale-105 transition-transform hover:border-brand-primary/50 group">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
                          <Edit3 size={24} />
                      </div>
                      <span className="text-sm font-bold text-white">Postar Feed</span>
                  </button>
                  <button onClick={() => { setIsActionMenuOpen(false); if(onViewProfile && user) onViewProfile(user.id); }} className="col-span-2 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-transform hover:bg-zinc-800">
                      <Share2 size={18} className="text-zinc-400"/>
                      <span className="text-sm font-bold text-zinc-300">Meu ELO ID (QR)</span>
                  </button>
              </div>
          </div>
      )}

      {/* Creation Modal (Pulse/Post) */}
      {(isCreatingPulse || isCreatingPost) && (
          <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-white font-bold text-lg">{isCreatingPulse ? 'Nova Vibe (24h)' : 'Novo Post'}</h2>
                  <button onClick={resetCreation}><X className="text-zinc-500 hover:text-white"/></button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* AUDIO RECORDER UI */}
                  {isRecording ? (
                      <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                          <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-4 border-2 border-red-500">
                              <Mic size={40} className="text-red-500"/>
                          </div>
                          <p className="text-white font-mono text-xl">{new Date(recordingTime * 1000).toISOString().substr(14, 5)}</p>
                          <p className="text-zinc-500 text-xs mt-2">Gravando...</p>
                          <button onClick={stopRecording} className="mt-8 bg-white text-black px-6 py-2 rounded-full font-bold">Parar e Usar</button>
                          <button onClick={cancelRecording} className="mt-4 text-zinc-500 text-xs">Cancelar</button>
                      </div>
                  ) : (
                      <>
                        <textarea 
                            autoFocus
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={isCreatingPulse ? "Compartilhe um momento..." : "Escreva algo... (ou grave um áudio)"}
                            className="w-full bg-transparent text-xl text-white placeholder-zinc-700 outline-none resize-none mb-4 min-h-[100px]"
                        />
                        
                        {mediaPreview && (
                            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 mb-4 bg-zinc-900 self-start">
                                {mediaPreview === "AUDIO_RECORDED" ? (
                                    <div className="p-4 flex items-center gap-3 bg-brand-primary/10">
                                        <div className="w-10 h-10 bg-brand-primary text-black rounded-full flex items-center justify-center"><Mic size={20}/></div>
                                        <div>
                                            <p className="text-sm text-white font-bold">Áudio Gravado</p>
                                            <p className="text-xs text-brand-primary">Pronto para envio</p>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={mediaPreview} className="w-full h-auto max-h-[300px] object-contain" />
                                )}
                                <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white"><X size={16}/></button>
                            </div>
                        )}
                      </>
                  )}
              </div>

              {!isRecording && (
                <div className="pt-4 border-t border-zinc-800">
                    <div className="flex gap-4 mb-6">
                        <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-brand-primary flex flex-col items-center gap-1 text-[10px]">
                            <div className="p-3 bg-zinc-900 rounded-full"><ImageIcon size={20}/></div> Mídia
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
                        
                        <button onClick={startRecording} className="text-zinc-400 hover:text-red-500 flex flex-col items-center gap-1 text-[10px]">
                            <div className="p-3 bg-zinc-900 rounded-full"><Mic size={20}/></div> Áudio
                        </button>

                        {isCreatingPost && (
                            <button onClick={() => setAllowComments(!allowComments)} className={`flex flex-col items-center gap-1 text-[10px] ${allowComments ? 'text-brand-primary' : 'text-zinc-600'}`}>
                                <div className="p-3 bg-zinc-900 rounded-full"><div className="w-5 h-5 border-2 border-current rounded-full"></div></div> Comentários
                            </button>
                        )}

                        {isCreatingPulse && (
                            <div className="flex gap-2 ml-auto items-center">
                                {['feliz', 'energizado', 'focado'].map((e: any) => (
                                    <button key={e} onClick={() => setEmotion(e)} className={`p-2 rounded-full border ${emotion === e ? 'border-brand-primary text-brand-primary' : 'border-zinc-800 text-zinc-600'}`}>
                                        <Smile size={18}/>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button 
                        disabled={isUploading || (!content && !mediaFile)} 
                        onClick={isCreatingPulse ? handleSubmitPulse : handleSubmitPost}
                        className="w-full bg-brand-primary text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="animate-spin"/> : <Send size={18}/>}
                        {isUploading ? 'Enviando...' : 'Publicar'}
                    </button>
                </div>
              )}
          </div>
      )}

      {/* Notifications HUD */}
      {isNotificationsOpen && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2"><Bell className="text-brand-primary"/> Notificações</h2>
                 <button onClick={() => setIsNotificationsOpen(false)}><X className="text-zinc-400"/></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4">
                 {notifications.length === 0 && <p className="text-zinc-600 text-center mt-10">Tudo limpo.</p>}
                 {notifications.map(n => (
                     <div key={n.id} className="bg-zinc-900/80 p-4 rounded-2xl flex items-center gap-4 border border-zinc-800/50 animate-slide-up">
                         <img src={n.user.avatar_url} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
                         <div className="flex-1">
                             <p className="text-sm text-zinc-200">
                                 <span className="font-bold">{formatDisplayName(n.user.name)}</span>{' '}
                                 {n.type === 'FRIEND_REQUEST' && 'quer conectar.'}
                                 {n.type === 'REQUEST_ACCEPTED' && 'aceitou seu pedido.'}
                                 {n.type === 'POST_LIKE' && 'curtiu sua publicação.'}
                                 {n.type === 'COMMENT_LIKE' && 'curtiu seu comentário.'}
                                 {n.type === 'MENTION' && 'mencionou você.'}
                                 {n.type === 'COMMENT_REPLY' && 'comentou na sua publicação.'}
                             </p>
                         </div>
                         {n.type === 'FRIEND_REQUEST' ? (
                             <div className="flex gap-2">
                                 <button onClick={() => respondToFriendRequest(n.id, true)} className="bg-brand-primary text-black p-2 rounded-full"><Check size={16}/></button>
                                 <button onClick={() => respondToFriendRequest(n.id, false)} className="bg-zinc-800 text-white p-2 rounded-full"><X size={16}/></button>
                             </div>
                         ) : <button onClick={() => handleClearNotification(n.id, n.type)} className="p-2"><X size={16} className="text-zinc-600 hover:text-red-500"/></button>}
                     </div>
                 ))}
             </div>
          </div>
      )}

      {/* User Search Overlay */}
      {isAddingFriend && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 flex flex-col p-6 animate-fade-in">
              <div className="flex gap-2 mb-6">
                  <div className="flex-1 bg-zinc-900 rounded-xl flex items-center px-4 border border-zinc-800 focus-within:border-brand-primary/50 transition-colors">
                      <Search size={18} className="text-zinc-500 mr-2"/>
                      <input 
                        autoFocus
                        value={userSearchQuery}
                        onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            if(e.target.value.length >= 3 && user) searchUsers(e.target.value, user.id).then(setUserSearchResults);
                        }}
                        placeholder="Buscar usuário..."
                        className="bg-transparent w-full h-12 text-white outline-none"
                      />
                  </div>
                  <button onClick={() => setIsAddingFriend(false)} className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400"><X size={20}/></button>
              </div>
              
              <div className="space-y-2 flex-1">
                  {userSearchResults.map(res => (
                      <div key={res.user.id} onClick={() => onViewProfile && onViewProfile(res.user.id)} className="p-3 bg-zinc-900/50 rounded-xl flex items-center gap-3 cursor-pointer">
                          <img src={res.user.avatar_url} className="w-10 h-10 rounded-full" />
                          <div className="flex-1">
                              <h4 className="text-white font-bold">{formatDisplayName(res.user.name)}</h4>
                              <p className="text-zinc-500 text-xs">@{res.user.username}</p>
                          </div>
                          {res.friendshipStatus ? <span className="text-zinc-500 text-xs capitalize">{res.friendshipStatus}</span> : (
                              <button onClick={(e) => { e.stopPropagation(); sendFriendRequest(user!.id, res.user.id); showToast("Enviado"); }} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Conectar</button>
                          )}
                      </div>
                  ))}
              </div>

              <button onClick={() => { setIsAddingFriend(false); if(user && onViewProfile) onViewProfile(user.id); }} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-3 rounded-xl flex items-center justify-center gap-2 mt-4 hover:bg-zinc-800 transition-colors">
                  <Share2 size={18} />
                  Compartilhar meu Perfil (ELO ID)
              </button>
          </div>
      )}

    </div>
  );
};

export default HomeScreen;
