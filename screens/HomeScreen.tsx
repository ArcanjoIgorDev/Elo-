
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchPulses, createPulse, fetchUserChats, searchUsers, getChatId, sendFriendRequest, fetchNotifications, respondToFriendRequest, fetchFeed, createPost, clearNotification, markAllNotificationsRead, getUserProfile } from '../services/dataService';
import { Pulse, AppScreen, ChatSummary, User, EmotionalState, Notification, Post } from '../types';
import PulseCard from '../components/PulseCard';
import PostCard from '../components/PostCard';
import { Plus, Search, X, MessageCircle, Zap, Send, UserPlus, Loader2, Image as ImageIcon, Video as VideoIcon, Smile, Bell, Ghost, Users, Hexagon, Check, UserIcon, Edit3, Share2, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'feed' | 'chats'>('feed');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Creation & Action Menu States
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isCreatingPulse, setIsCreatingPulse] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isSharingProfile, setIsSharingProfile] = useState(false);
  
  // Input State (Shared logic roughly)
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [emotion, setEmotion] = useState<EmotionalState>('neutro');
  const [allowComments, setAllowComments] = useState(true);

  // Search State
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vibeTrigger && vibeTrigger > 0) setIsActionMenuOpen(true);
  }, [vibeTrigger]);

  useEffect(() => {
    if (user) {
        refreshData();
        const interval = setInterval(() => refreshData(), 15000);
        return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
      if(toastMessage) { const t = setTimeout(() => setToastMessage(null), 3000); return () => clearTimeout(t); }
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  const refreshData = async () => {
    if(!user) return;
    const [p, c, n, f] = await Promise.all([
        fetchPulses(),
        fetchUserChats(user.id),
        fetchNotifications(user.id),
        fetchFeed(user.id)
    ]);
    setPulses(p);
    setChats(c);
    setNotifications(n);
    setUnreadNotifCount(n.filter(notif => !notif.read).length);
    setFeed(f);
    setLoading(false);
  };

  const handleOpenNotifications = async () => {
      setIsNotificationsOpen(true);
      // Mark as read immediately on open
      if (unreadNotifCount > 0 && user) {
          await markAllNotificationsRead(user.id);
          setUnreadNotifCount(0);
          // Otimistic local update
          setNotifications(prev => prev.map(n => ({...n, read: true})));
      }
  };

  const handleMentionClick = useCallback(async (username: string) => {
      // Find user by username
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
      setIsActionMenuOpen(false); // Fecha menu de ação ao terminar
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

  const handleSubmitPulse = async () => {
      if (!user || (!content.trim() && !mediaFile)) return;
      setIsUploading(true);
      await createPulse(content, user.id, user.name || 'User', user.avatar_url || '', emotion, 'text', '', mediaFile || undefined);
      showToast("Vibe lançada (24h)!");
      resetCreation();
      refreshData();
  };

  const handleSubmitPost = async () => {
      if (!user || (!content.trim() && !mediaFile)) return;
      setIsUploading(true);
      await createPost(user.id, content, mediaFile || undefined, allowComments);
      showToast("Publicado no Feed!");
      resetCreation();
      refreshData();
  };

  return (
    <div className="pb-24 h-full flex flex-col bg-zinc-950 relative transition-colors duration-700">
      
      {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] bg-white text-zinc-950 px-6 py-3 rounded-full shadow-xl font-bold text-xs animate-fade-in flex items-center gap-2 border border-white/50 backdrop-blur-md">
              <Check size={14} className="text-brand-primary" /> {toastMessage}
          </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center px-6 pt-6 pb-2 shrink-0 bg-transparent sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-400 flex items-center justify-center shadow-lg">
                <Hexagon className="text-zinc-950 fill-zinc-950 rotate-90" size={20} />
             </div>
             <h1 className="text-xl font-bold text-white tracking-tight">ELO</h1>
          </div>
          <div className="flex items-center gap-3">
             {/* Filter button removed from here */}
             <button onClick={() => setIsAddingFriend(true)} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"><UserPlus size={18} /></button>
             <button onClick={handleOpenNotifications} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white relative">
                <Bell size={18} />
                {unreadNotifCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-brand-primary rounded-full"></span>}
            </button>
            <button onClick={() => onNavigate(AppScreen.PROFILE)} className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800"><img src={user?.avatar_url} className="w-full h-full object-cover" /></button>
          </div>
      </header>

      {/* Vibes Scroll */}
      <div className="px-6 py-4">
          <div className="flex overflow-x-auto no-scrollbar gap-4 snap-x snap-mandatory pb-4">
              <div onClick={() => setIsCreatingPulse(true)} className="min-w-[100px] w-[100px] h-[160px] border border-dashed border-zinc-800 bg-zinc-900/30 rounded-2xl flex flex-col items-center justify-center shrink-0 cursor-pointer hover:border-zinc-600 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-2"><Plus size={20} className="text-zinc-400"/></div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Criar Vibe</span>
              </div>
              {pulses.map(p => (
                  <PulseCard key={p.id} pulse={p} currentUserId={user?.id || ''} onDelete={() => {}} onClickProfile={(uid) => onViewProfile && onViewProfile(uid)}/>
              ))}
          </div>
      </div>

      {/* Main Tabs */}
      <div className="px-6 mb-4 flex gap-4 border-b border-zinc-800 pb-2">
          <button onClick={() => setActiveTab('feed')} className={`text-sm font-bold pb-2 transition-colors ${activeTab === 'feed' ? 'text-white border-b-2 border-brand-primary' : 'text-zinc-500'}`}>Feed Global</button>
          <button onClick={() => setActiveTab('chats')} className={`text-sm font-bold pb-2 transition-colors ${activeTab === 'chats' ? 'text-white border-b-2 border-brand-primary' : 'text-zinc-500'}`}>Conversas</button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar">
          {activeTab === 'feed' ? (
              <>
                <div onClick={() => setIsCreatingPost(true)} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 flex items-center gap-4 cursor-pointer hover:bg-zinc-900 transition-colors">
                    <img src={user?.avatar_url} className="w-10 h-10 rounded-full" />
                    <span className="text-zinc-500 text-sm">O que está acontecendo?</span>
                    <ImageIcon size={18} className="text-zinc-600 ml-auto"/>
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
                {feed.length === 0 && <div className="text-center py-20 text-zinc-600 text-xs">O feed está silencioso. Seja o primeiro a postar.</div>}
              </>
          ) : (
              <div className="space-y-3">
                  {chats.length === 0 ? <div className="text-center py-20 text-zinc-600 text-xs">Nenhuma conversa ativa.</div> : 
                  chats.map(chat => (
                      <div key={chat.chatId} onClick={() => onChatSelect && onChatSelect(chat.chatId, chat.otherUser)} className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-900">
                           <img src={chat.otherUser.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                           <div className="flex-1 min-w-0">
                               <div className="flex justify-between">
                                   <h3 className="font-bold text-zinc-200 text-sm">{chat.otherUser.name}</h3>
                                   {chat.unreadCount > 0 && <span className="bg-brand-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unreadCount}</span>}
                               </div>
                               <p className="text-zinc-500 text-xs truncate mt-1">{chat.lastMessage?.content || '...'}</p>
                           </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* ACTION MENU (TRIGGERED BY CENTER BUTTON) */}
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
                  <button onClick={() => { setIsActionMenuOpen(false); setIsSharingProfile(true); }} className="col-span-2 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-transform hover:bg-zinc-800">
                      <Share2 size={18} className="text-zinc-400"/>
                      <span className="text-sm font-bold text-zinc-300">Compartilhar meu Perfil</span>
                  </button>
              </div>
          </div>
      )}

      {/* Creation Modal (Shared for Pulse and Post) */}
      {(isCreatingPulse || isCreatingPost) && (
          <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-white font-bold text-lg">{isCreatingPulse ? 'Nova Vibe (24h)' : 'Novo Post'}</h2>
                  <button onClick={resetCreation}><X className="text-zinc-500 hover:text-white"/></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                  <textarea 
                    autoFocus
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={isCreatingPulse ? "Compartilhe um momento..." : "Escreva algo permanente (use @ para marcar)..."}
                    className="w-full bg-transparent text-xl text-white placeholder-zinc-700 outline-none resize-none mb-4"
                  />
                  
                  {mediaPreview && (
                      <div className="relative rounded-2xl overflow-hidden border border-zinc-800 mb-4 bg-zinc-900">
                          {mediaFile?.type.startsWith('video') ? (
                              <video src={mediaPreview} controls className="w-full max-h-60" />
                          ) : (
                              <img src={mediaPreview} className="w-full h-auto" />
                          )}
                          <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white"><X size={16}/></button>
                      </div>
                  )}
              </div>

              <div className="pt-4 border-t border-zinc-800">
                  <div className="flex gap-4 mb-6">
                      <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-brand-primary flex flex-col items-center gap-1 text-[10px]">
                          <div className="p-3 bg-zinc-900 rounded-full"><ImageIcon size={20}/></div> Mídia
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
                      
                      {isCreatingPost && (
                          <button onClick={() => setAllowComments(!allowComments)} className={`flex flex-col items-center gap-1 text-[10px] ${allowComments ? 'text-brand-primary' : 'text-zinc-600'}`}>
                              <div className="p-3 bg-zinc-900 rounded-full"><MessageCircle size={20}/></div> Comentários
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
          </div>
      )}

      {/* Share Profile Modal */}
      {isSharingProfile && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-fade-in" onClick={() => setIsSharingProfile(false)}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-zinc-800 overflow-hidden">
                      <img src={user?.avatar_url} className="w-full h-full object-cover"/>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{user?.name}</h3>
                  <p className="text-zinc-500 mb-6">@{user?.username}</p>
                  
                  <div className="bg-white p-4 rounded-xl mb-6">
                      <div className="w-full aspect-square bg-zinc-100 flex items-center justify-center text-black font-mono text-xs break-all p-2">
                          {/* Simulated QR Code Area */}
                          ELO://USER/{user?.username}
                      </div>
                  </div>

                  <button onClick={() => { navigator.clipboard.writeText(`elo.app/${user?.username}`); showToast("Link copiado!"); setIsSharingProfile(false); }} className="w-full bg-brand-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                      <Copy size={18} /> Copiar Link
                  </button>
              </div>
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
                     <div key={n.id} className="bg-zinc-900/80 p-4 rounded-2xl flex items-center gap-4 border border-zinc-800/50">
                         <img src={n.user.avatar_url} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
                         <div className="flex-1">
                             <p className="text-sm text-zinc-200">
                                 <span className="font-bold">{n.user.name}</span>{' '}
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
                         ) : <button onClick={() => clearNotification(n.id, n.type)}><X size={16} className="text-zinc-600"/></button>}
                     </div>
                 ))}
             </div>
          </div>
      )}

      {/* User Search Overlay */}
      {isAddingFriend && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/95 flex flex-col p-6 animate-fade-in">
              <div className="flex gap-2 mb-6">
                  <div className="flex-1 bg-zinc-900 rounded-xl flex items-center px-4">
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
                              <h4 className="text-white font-bold">{res.user.name}</h4>
                              <p className="text-zinc-500 text-xs">@{res.user.username}</p>
                          </div>
                          {res.friendshipStatus ? <span className="text-zinc-500 text-xs capitalize">{res.friendshipStatus}</span> : (
                              <button onClick={(e) => { e.stopPropagation(); sendFriendRequest(user!.id, res.user.id); showToast("Enviado"); }} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Conectar</button>
                          )}
                      </div>
                  ))}
              </div>

              {/* Share Profile Button Inside Search */}
              <button onClick={() => setIsSharingProfile(true)} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-3 rounded-xl flex items-center justify-center gap-2 mt-4 hover:bg-zinc-800 transition-colors">
                  <Share2 size={18} />
                  Compartilhar meu Perfil
              </button>
          </div>
      )}

    </div>
  );
};

export default HomeScreen;
