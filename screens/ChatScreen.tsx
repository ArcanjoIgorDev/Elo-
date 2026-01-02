
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MoreVertical, MapPin, Check, CheckCheck, Navigation, Ban, AlertTriangle, Paperclip, Image as ImageIcon, Mic, Sparkles, Hourglass, Plus, X, Lock, Clock, Unlock } from 'lucide-react';
import { Message, User, MessageType } from '../types';
import { fetchMessages, sendMessage, markMessagesAsRead, getUserProfile } from '../services/dataService';
import { analyzeConversationEmotion, EmotionType } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface ChatScreenProps {
  chatId: string;
  targetUser: User;
  initialMessage?: string; 
  onBack: () => void;
}

const CAPSULE_PREFIX = '::CAPSULE::';
interface CapsuleData {
    content: string;
    unlockAt: number;
    durationLabel: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, targetUser, initialMessage, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState(initialMessage || ''); 
  const [loading, setLoading] = useState(true);
  
  // States
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showCapsuleModal, setShowCapsuleModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  
  // AI Emotional Intelligence
  const [partnerEmotion, setPartnerEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });
  const [myEmotion, setMyEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Realtime
  const [otherUserActivity, setOtherUserActivity] = useState<'typing' | 'image' | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
     const timer = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if(!user) return;
    setLoading(true);
    fetchMessages(chatId).then(data => {
        setMessages(data);
        setLoading(false);
        scrollToBottom();
        markMessagesAsRead(chatId, user.id);
        if(data.length > 0) runEmotionAnalysis(data);
    });

    getUserProfile(targetUser.id, user.id).then(result => {
        if (result && result.friendship && result.friendship.status === 'blocked') setIsBlocked(true);
    });

    const channel = supabase.channel(`chat_activity_${chatId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
            if (payload.userId !== user.id) {
                setOtherUserActivity(payload.type);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => { setOtherUserActivity(null); }, 3000);
            }
        }).subscribe();
    channelRef.current = channel;
    
    if (initialMessage && inputRef.current) setTimeout(() => inputRef.current?.focus(), 500);
    
    const interval = setInterval(() => {
        fetchMessages(chatId).then(data => {
            setMessages(data);
            if(data.length > 0 && !isAnalyzing) runEmotionAnalysis(data);
        });
    }, 8000); 

    return () => {
        clearInterval(interval);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        supabase.removeChannel(channel);
    };
  }, [chatId, user, targetUser.id]);

  useEffect(() => {
      if(toastMessage) { const t = setTimeout(() => setToastMessage(null), 3000); return () => clearTimeout(t); }
  }, [toastMessage]);

  const broadcastActivity = (type: 'typing' | 'image') => {
      if (channelRef.current && user) {
          channelRef.current.send({ type: 'broadcast', event: 'activity', payload: { userId: user.id, type } });
      }
  };

  const runEmotionAnalysis = async (msgs: Message[]) => {
      if (!user) return;
      setIsAnalyzing(true);
      const result = await analyzeConversationEmotion(msgs, user.id);
      setPartnerEmotion(result.partnerEmotion);
      setMyEmotion(result.myEmotion);
      setIsAnalyzing(false);
  };

  const scrollToBottom = () => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); }

  const handleSend = async (type: MessageType = 'text', content: string = inputText, location?: {lat: number, lng: number}) => {
    if (isBlocked || !user) return;
    if (type === 'text' && !content.trim()) return;
    if(type === 'text') setInputText('');
    setShowAttachments(false);

    const optimisticMsg: Message = {
        id: 'temp-' + Date.now(),
        sender_id: user.id,
        content: content,
        type: type,
        created_at: new Date().toISOString(),
        is_read: false,
        location: location
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
    const savedMessage = await sendMessage(content, chatId, user.id, type, location);
    if (savedMessage) {
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? savedMessage : m));
        runEmotionAnalysis([...messages, savedMessage]);
    }
  };

  const handleSendCapsule = (durationMinutes: number, label: string) => {
      if (!inputText.trim()) { setToastMessage({type: 'error', text: 'Escreva uma mensagem.'}); return; }
      const unlockTime = Date.now() + (durationMinutes * 60 * 1000);
      const payload = `${CAPSULE_PREFIX}${JSON.stringify({ content: inputText, unlockAt: unlockTime, durationLabel: label })}`;
      handleSend('text', payload);
      setShowCapsuleModal(false);
      setInputText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setInputText(e.target.value); broadcastActivity('typing'); };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          broadcastActivity('image');
          const reader = new FileReader();
          reader.onloadend = () => { handleSend('image', reader.result as string); };
          reader.readAsDataURL(file);
      }
  };

  const handleShareLocation = () => {
    if (isBlocked) return;
    setIsSharingLocation(true);
    setShowAttachments(false);
    navigator.geolocation.getCurrentPosition(
        (pos) => { handleSend('location', '📍 Localização', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setIsSharingLocation(false); }, 
        (err) => { setToastMessage({type: 'error', text: "Erro ao obter localização."}); setIsSharingLocation(false); }
    );
  };

  const getEmotionColors = (tone: EmotionType) => {
      switch(tone) {
          case 'Alegre': return { text: 'text-yellow-400', bg: 'bg-yellow-400', glow: 'shadow-yellow-400/20' };
          case 'Tenso': return { text: 'text-red-500', bg: 'bg-red-500', glow: 'shadow-red-500/20' };
          case 'Apaixonado': return { text: 'text-pink-500', bg: 'bg-pink-500', glow: 'shadow-pink-500/20' };
          case 'Empático': return { text: 'text-emerald-400', bg: 'bg-emerald-400', glow: 'shadow-emerald-400/20' };
          case 'Reflexivo': return { text: 'text-indigo-400', bg: 'bg-indigo-400', glow: 'shadow-indigo-400/20' };
          case 'Entusiasmado': return { text: 'text-orange-500', bg: 'bg-orange-500', glow: 'shadow-orange-500/20' };
          case 'Curioso': return { text: 'text-purple-400', bg: 'bg-purple-400', glow: 'shadow-purple-400/20' };
          case 'Ansioso': return { text: 'text-rose-400', bg: 'bg-rose-400', glow: 'shadow-rose-400/20' };
          case 'Grato': return { text: 'text-teal-400', bg: 'bg-teal-400', glow: 'shadow-teal-400/20' };
          default: return { text: 'text-zinc-400', bg: 'bg-zinc-400', glow: 'shadow-zinc-500/0' };
      }
  };

  const partnerColors = getEmotionColors(partnerEmotion.tone);

  const renderCapsule = (content: string, isMe: boolean) => {
      try {
          const jsonString = content.replace(CAPSULE_PREFIX, '');
          const data: CapsuleData = JSON.parse(jsonString);
          const isLocked = now < data.unlockAt;
          
          if (!isLocked) {
              return (
                  <div className="flex flex-col gap-1 min-w-[200px]">
                      <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1 border-b border-white/10 pb-1">
                          <Unlock size={12} className={isMe ? "text-zinc-300" : "text-brand-primary"} /> Aberto
                      </div>
                      <span className="whitespace-pre-wrap">{data.content}</span>
                  </div>
              );
          }
          const timeLeft = Math.max(0, data.unlockAt - now);
          const minutesLeft = Math.floor(timeLeft / 60000);
          const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

          return (
              <div className="flex flex-col items-center gap-2 min-w-[180px] py-2">
                  <div className={`p-3 rounded-full ${isMe ? 'bg-white/20' : 'bg-brand-primary/10 text-brand-primary'} animate-pulse`}><Lock size={20} /></div>
                  <div className="text-center">
                      <p className="text-[10px] opacity-70 mb-0.5">Disponível em</p>
                      <p className="text-xs font-bold font-mono">{minutesLeft}:{secondsLeft.toString().padStart(2, '0')}</p>
                  </div>
              </div>
          );
      } catch (e) { return <span>Erro.</span>; }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 relative overflow-hidden">
      
      {/* Dynamic Ambient Background based on Emotion */}
      <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b ${partnerColors.bg} to-transparent opacity-5 pointer-events-none transition-colors duration-1000`}></div>
      
      {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-zinc-900 border border-white/10 shadow-xl flex items-center gap-2 text-xs font-medium text-white animate-fade-in">
              {toastMessage.type === 'error' ? <AlertTriangle size={14} className="text-red-500" /> : <Check size={14} className="text-brand-primary" />}
              {toastMessage.text}
          </div>
      )}

      {/* Modern Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
                <img 
                    src={targetUser.avatar_url || `https://ui-avatars.com/api/?name=${targetUser.name}`} 
                    className={`w-10 h-10 rounded-full bg-zinc-800 object-cover ring-2 ring-offset-2 ring-offset-zinc-950 transition-all duration-1000 ${partnerColors.text.replace('text-', 'ring-')}`}
                />
                {!targetUser.is_deleted && partnerEmotion.tone !== 'Neutro' && (
                    <div className={`absolute -bottom-1 -right-1 bg-zinc-950 rounded-full p-1 border border-zinc-900 ${partnerColors.text}`}>
                        <Sparkles size={10} className="fill-current animate-pulse" />
                    </div>
                )}
            </div>
            
            <div>
              <h2 className="text-sm font-bold text-zinc-100 leading-tight">{targetUser.is_deleted ? 'Usuário Excluído' : targetUser.name}</h2>
              {!targetUser.is_deleted && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Emotion Pill */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-white/5 ${partnerColors.glow} shadow-[0_0_15px_-5px_currentColor] transition-all duration-700`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${partnerColors.bg} animate-pulse`}></div>
                         <span className={`text-[9px] font-bold uppercase tracking-wider ${partnerColors.text}`}>
                             {isAnalyzing ? 'LENDO...' : partnerEmotion.tone}
                         </span>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
        <button className="text-zinc-500 hover:text-white transition-colors p-2"><MoreVertical size={20} /></button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar z-10">
        {loading ? <div className="flex justify-center mt-10"><div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin"></div></div> : 
        messages.length === 0 ? <div className="text-center mt-20 text-zinc-600 text-xs">Inicie a conversa com {targetUser.name.split(' ')[0]}.</div> : (
            messages.map((msg) => {
            const isMe = msg.sender_id === user?.id; 
            const isCapsule = msg.content && msg.content.startsWith(CAPSULE_PREFIX);

            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                <div className={`max-w-[85%] rounded-[1.2rem] text-sm leading-relaxed relative shadow-sm overflow-hidden border transition-all ${
                    isMe 
                        ? 'bg-gradient-to-tr from-brand-primary/90 to-brand-secondary/90 text-white border-transparent rounded-tr-sm shadow-brand-primary/10' 
                        : 'bg-zinc-900 text-zinc-200 border-zinc-800 rounded-tl-sm'
                    } ${msg.type === 'image' ? 'p-1' : 'px-4 py-2.5'}`}>
                    
                    {isCapsule ? renderCapsule(msg.content, isMe) : 
                     msg.type === 'image' ? <img src={msg.content} className="rounded-xl w-full max-w-[260px] object-cover" /> : 
                     msg.type === 'location' && msg.location ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex items-center gap-2 font-bold opacity-80 border-b border-white/10 pb-2 mb-1 text-xs"><Navigation size={12}/> Localização</div>
                            <div className="h-28 bg-zinc-950/30 rounded-lg relative overflow-hidden flex items-center justify-center">
                                <div className="w-20 h-20 bg-brand-primary/20 rounded-full animate-ping absolute"></div>
                                <div className="w-3 h-3 bg-brand-primary rounded-full z-10 shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                            </div>
                        </div>
                    ) : <span className="whitespace-pre-wrap">{msg.content}</span>}

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-60 ${isMe ? 'text-white' : 'text-zinc-500'} ${msg.type === 'image' ? 'pr-2 pb-1 text-white drop-shadow-md' : ''}`}>
                        <span className="text-[9px]">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {isMe && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                    </div>
                </div>
                </div>
            );
            })
        )}
        
        {otherUserActivity && (
            <div className="flex justify-start animate-fade-in">
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    {otherUserActivity === 'image' ? <ImageIcon size={14} className="text-zinc-400 animate-pulse" /> : 
                    <div className="flex gap-1 h-3 items-center"><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span></div>}
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Capsule Modal */}
      {showCapsuleModal && (
          <div className="absolute bottom-24 left-4 right-4 z-40 bg-zinc-900/95 backdrop-blur-xl border border-brand-primary/30 rounded-[2rem] p-6 shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold flex items-center gap-2"><Hourglass size={18} className="text-brand-primary"/> Cápsula do Tempo</h3>
                  <button onClick={() => setShowCapsuleModal(false)}><X size={18} className="text-zinc-500"/></button>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">A mensagem ficará oculta e protegida até o momento escolhido. Uma surpresa para o futuro.</p>
              <div className="grid grid-cols-3 gap-3 mb-2">
                  {[1, 60, 1440].map((min, i) => (
                      <button key={min} onClick={() => handleSendCapsule(min, ['1 Min', '1 Hora', '24 Horas'][i])} className="bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all py-4 rounded-xl text-xs font-bold text-zinc-300 border border-zinc-700 flex flex-col items-center gap-1">
                          <Clock size={16} className="mb-1 opacity-50"/> {['1 Min', '1 Hora', '24 Horas'][i]}
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* Input Area */}
      {!isBlocked && !targetUser.is_deleted && (
          <div className="p-3 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 pb-safe shrink-0 flex flex-col gap-2 z-20">
             {showAttachments && (
                 <div className="absolute bottom-20 left-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-4 flex gap-6 animate-fade-in z-30">
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors"><ImageIcon size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Galeria</span></button>
                     <button onClick={handleShareLocation} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors"><MapPin size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Local</span></button>
                     <button onClick={() => { setShowCapsuleModal(true); setShowAttachments(false); }} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors"><Hourglass size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Cápsula</span></button>
                 </div>
             )}
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect}/>
            <div className="flex items-end gap-2">
                <button onClick={() => setShowAttachments(!showAttachments)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showAttachments ? 'bg-zinc-800 text-white rotate-45' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Plus size={24} /></button>
                <div className="flex-1 min-h-[48px] bg-zinc-900 border border-zinc-800 rounded-[24px] px-5 py-3 focus-within:border-zinc-700 transition-all flex items-center gap-2">
                    <input ref={inputRef} type="text" value={inputText} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSend('text')} placeholder="Mensagem..." className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none max-h-24"/>
                </div>
                <button onClick={() => handleSend('text')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${inputText.trim() ? 'bg-brand-primary text-zinc-950 scale-100' : 'bg-zinc-800 text-zinc-500 scale-95'}`}>{inputText.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}</button>
            </div>
          </div>
      )}
      {(isBlocked || targetUser.is_deleted) && <div className="p-6 bg-zinc-950 text-center"><p className="text-xs text-zinc-600">Comunicação indisponível.</p></div>}
    </div>
  );
};

export default ChatScreen;
