import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MoreVertical, MapPin, Check, CheckCheck, Navigation, Ban, AlertTriangle, Paperclip, Image as ImageIcon, Mic, Sparkles, Hourglass, Plus, X } from 'lucide-react';
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

const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, targetUser, initialMessage, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState(initialMessage || ''); 
  const [loading, setLoading] = useState(true);
  
  // Status da Conexão
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  
  // Media / Actions State
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  
  // AI State - Dual Emotion
  const [partnerEmotion, setPartnerEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });
  const [myEmotion, setMyEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Activity Indicators (Typing...)
  const [otherUserActivity, setOtherUserActivity] = useState<'typing' | 'image' | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(!user) return;
    
    // 1. Carregar Mensagens
    setLoading(true);
    fetchMessages(chatId).then(data => {
        setMessages(data);
        setLoading(false);
        scrollToBottom();
        markMessagesAsRead(chatId, user.id);
        if(data.length > 0) runEmotionAnalysis(data);
    });

    // 2. Verificar Status de Bloqueio
    getUserProfile(targetUser.id, user.id).then(result => {
        if (result && result.friendship && result.friendship.status === 'blocked') {
            setIsBlocked(true);
            if (result.friendship.blocked_by === user.id) {
                setBlockedByMe(true);
            }
        }
    });

    // 3. Supabase Realtime Broadcast for Typing Indicators
    const channel = supabase.channel(`chat_activity_${chatId}`, {
        config: {
            broadcast: { self: false },
        },
    });

    channel
        .on('broadcast', { event: 'activity' }, ({ payload }) => {
            if (payload.userId !== user.id) {
                setOtherUserActivity(payload.type);
                
                // Clear activity after a few seconds if no new events come in
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                    setOtherUserActivity(null);
                }, 3000);
            }
        })
        .subscribe();
    
    channelRef.current = channel;
    
    if (initialMessage && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 500);
    }
    
    // Polling fallback for messages (could be replaced by DB subscription too)
    const interval = setInterval(() => {
        fetchMessages(chatId).then(data => {
            setMessages(data);
            if(data.length > 0 && !isAnalyzing) runEmotionAnalysis(data);
        });
    }, 10000); 

    return () => {
        clearInterval(interval);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        supabase.removeChannel(channel);
    };
  }, [chatId, user, targetUser.id]);

  useEffect(() => {
      if(toastMessage) {
          const t = setTimeout(() => setToastMessage(null), 3000);
          return () => clearTimeout(t);
      }
  }, [toastMessage]);

  const broadcastActivity = (type: 'typing' | 'image') => {
      if (channelRef.current && user) {
          channelRef.current.send({
              type: 'broadcast',
              event: 'activity',
              payload: { userId: user.id, type }
          });
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

  const scrollToBottom = () => {
     setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      broadcastActivity('typing');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          broadcastActivity('image');
          const reader = new FileReader();
          reader.onloadend = () => {
              handleSend('image', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleShareLocation = () => {
    if (isBlocked) return;
    if (!navigator.geolocation) {
        setToastMessage({type: 'error', text: "Geolocalização não suportada."});
        return;
    }
    
    setIsSharingLocation(true);
    setShowAttachments(false);
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            handleSend('location', '📍 Localização Compartilhada', { lat: latitude, lng: longitude });
            setIsSharingLocation(false);
        }, 
        (err) => {
            let msg = "Erro ao obter localização.";
            if (err.code === 1) msg = "Permissão de localização negada.";
            setToastMessage({type: 'error', text: msg});
            setIsSharingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const getEmotionColor = (tone: EmotionType) => {
      switch(tone) {
          case 'Alegre': return 'text-yellow-400';
          case 'Tenso': return 'text-red-400';
          case 'Apaixonado': return 'text-pink-400';
          case 'Empático': return 'text-green-400';
          case 'Reflexivo': return 'text-blue-400';
          case 'Entusiasmado': return 'text-orange-400';
          default: return 'text-zinc-400';
      }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 relative overflow-hidden">
      
      {/* Background Cyberpunk Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950 pointer-events-none"></div>

      {toastMessage && (
          <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-2 rounded-full shadow-lg font-bold text-xs animate-fade-in flex items-center gap-2 ${
              toastMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-zinc-100 text-zinc-950'
          }`}>
              {toastMessage.type === 'error' ? <AlertTriangle size={14} /> : <Check size={14} />}
              {toastMessage.text}
          </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-zinc-950/70 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            {targetUser.is_deleted ? (
                <div className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                    <Ban size={18} className="text-zinc-500"/>
                </div>
            ) : (
                <div className="relative">
                    <img 
                        src={targetUser.avatar_url || `https://ui-avatars.com/api/?name=${targetUser.name}&background=random`} 
                        className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 object-cover" 
                        alt="Avatar" 
                    />
                    {/* Partner Emotion Badge */}
                    {!isAnalyzing && partnerEmotion.tone !== 'Neutro' && (
                        <div className={`absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 border border-zinc-800 ${getEmotionColor(partnerEmotion.tone)} animate-bounce`}>
                            <Sparkles size={8} className="fill-current" />
                        </div>
                    )}
                </div>
            )}
            <div>
              <h2 className={`text-sm font-bold ${targetUser.is_deleted ? 'text-zinc-500 italic' : 'text-zinc-100'}`}>
                  {targetUser.is_deleted ? 'Usuário Excluído' : targetUser.name}
              </h2>
              {!targetUser.is_deleted && (
                  <div className="flex items-center gap-1.5 transition-all">
                    <span className={`text-[10px] font-medium tracking-wide ${getEmotionColor(partnerEmotion.tone)}`}>
                        {isAnalyzing ? 'Interpretando...' : partnerEmotion.tone === 'Neutro' ? 'Neutro' : `Vibe: ${partnerEmotion.tone}`}
                    </span>
                    <div className="h-1 w-8 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${getEmotionColor(partnerEmotion.tone).replace('text-', 'bg-')}`} style={{width: `${partnerEmotion.intensity}%`}}></div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
        <button className="text-zinc-500">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar z-10">
        {isBlocked && (
            <div className="flex justify-center my-4 animate-fade-in">
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg flex items-center gap-2">
                    <Ban size={14} className="text-red-400" />
                    <span className="text-xs text-zinc-400">
                        {blockedByMe ? "Você bloqueou este contato." : "Você não pode responder a esta conversa."}
                    </span>
                </div>
            </div>
        )}

        {loading ? (
             <div className="flex justify-center mt-10">
                 <div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin"></div>
             </div>
        ) : messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center mt-20 opacity-50 space-y-2">
                 <p className="text-xs text-zinc-500">Inicie a conexão.</p>
             </div>
        ) : (
            messages.map((msg) => {
            const isMe = msg.sender_id === user?.id; 
            
            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div 
                    className={`max-w-[80%] rounded-2xl text-sm leading-relaxed relative group shadow-lg overflow-hidden border ${
                    isMe 
                        ? 'bg-gradient-to-br from-brand-primary to-emerald-600 text-white border-transparent rounded-tr-sm' 
                        : 'bg-zinc-800/80 backdrop-blur-md text-zinc-200 border-white/5 rounded-tl-sm'
                    } ${msg.type === 'image' ? 'p-1' : 'px-4 py-3'}`}
                >
                    {/* Render Content Based on Type */}
                    {msg.type === 'image' ? (
                        <div className="relative">
                            <img src={msg.content} alt="Foto" className="rounded-xl w-full max-w-[250px] object-cover" />
                        </div>
                    ) : msg.type === 'location' && msg.location ? (
                        <div className="flex flex-col gap-2 min-w-[180px]">
                            <div className={`flex items-center gap-2 font-bold opacity-90 border-b pb-2 mb-1 ${isMe ? 'border-white/20' : 'border-black/20'}`}>
                                <Navigation size={14} className="fill-current" />
                                <span>Localização Atual</span>
                            </div>
                            
                            <div className={`h-24 rounded-lg flex items-center justify-center relative overflow-hidden ${isMe ? 'bg-black/10' : 'bg-black/30'}`}>
                                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center animate-pulse z-10 ${isMe ? 'bg-white/30' : 'bg-brand-primary/20'}`}>
                                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isMe ? 'bg-white' : 'bg-brand-primary'}`} />
                                </div>
                                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
                            </div>

                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${msg.location.lat},${msg.location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`text-xs font-semibold py-2 text-center rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                    isMe 
                                    ? 'bg-white/20 hover:bg-white/30 text-white' 
                                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-950 border border-zinc-700'
                                }`}
                            >
                                <MapPin size={12} />
                                Abrir no Maps
                            </a>
                        </div>
                    ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-70 ${isMe ? 'text-white' : 'text-zinc-500'} ${msg.type === 'image' ? 'pr-2 pb-1 text-white drop-shadow-md' : ''}`}>
                        <span className="text-[9px]">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {isMe && (
                             msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />
                        )}
                    </div>
                </div>
                </div>
            );
            })
        )}
        
        {/* Activity Indicator Bubble */}
        {otherUserActivity && (
            <div className="flex justify-start animate-fade-in">
                <div className="bg-zinc-800/50 backdrop-blur-sm border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    {otherUserActivity === 'image' ? (
                        <>
                            <ImageIcon size={14} className="text-zinc-400 animate-pulse" />
                            <span className="text-xs text-zinc-400 italic">Enviando foto...</span>
                        </>
                    ) : (
                        <div className="flex gap-1 h-3 items-center">
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                        </div>
                    )}
                </div>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Desativada se Bloqueado ou Usuário Deletado */}
      {!isBlocked && !targetUser.is_deleted && (
          <div className="p-3 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 pb-safe shrink-0 flex flex-col gap-2 z-20">
             
             {/* My Emotion Indicator (Subtle) */}
             {myEmotion.tone !== 'Neutro' && (
                 <div className="flex justify-end px-2">
                     <span className={`text-[9px] font-medium tracking-wide flex items-center gap-1 ${getEmotionColor(myEmotion.tone)} opacity-60`}>
                         Você parece: {myEmotion.tone}
                     </span>
                 </div>
             )}

             {/* Attachments Menu */}
             {showAttachments && (
                 <div className="absolute bottom-20 left-4 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-4 flex gap-6 animate-fade-in z-30">
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-zinc-400 hover:text-brand-primary transition-colors group">
                         <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:scale-105 transition-transform group-hover:border-brand-primary/50">
                             <ImageIcon size={20} />
                         </div>
                         <span className="text-[10px] font-medium">Galeria</span>
                     </button>
                     <button onClick={handleShareLocation} className="flex flex-col items-center gap-2 text-zinc-400 hover:text-brand-primary transition-colors group">
                         <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:scale-105 transition-transform group-hover:border-brand-primary/50">
                             <MapPin size={20} />
                         </div>
                         <span className="text-[10px] font-medium">Local</span>
                     </button>
                     <button onClick={() => { setToastMessage({type: 'success', text: 'Cápsulas temporais em breve.'}); setShowAttachments(false); }} className="flex flex-col items-center gap-2 text-zinc-400 hover:text-indigo-400 transition-colors group">
                         <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:scale-105 transition-transform group-hover:border-indigo-500/50">
                             <Hourglass size={20} />
                         </div>
                         <span className="text-[10px] font-medium">Futuro</span>
                     </button>
                 </div>
             )}
             
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect}/>

            <div className="flex items-end gap-2">
                <button 
                    onClick={() => setShowAttachments(!showAttachments)}
                    className={`w-11 h-11 mb-0.5 rounded-full flex items-center justify-center transition-all ${
                        showAttachments ? 'bg-zinc-800 text-brand-primary rotate-45' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                    }`}
                >
                    <Plus size={22} />
                </button>

                <div className="flex-1 min-h-[48px] bg-zinc-900/50 border border-white/5 rounded-[20px] px-4 py-3 focus-within:border-brand-primary/30 focus-within:bg-zinc-900 transition-all flex items-center gap-2 shadow-inner">
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend('text')}
                        placeholder="Mensagem..."
                        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none max-h-24"
                    />
                </div>

                <button 
                    onClick={() => handleSend('text')}
                    className={`w-11 h-11 mb-0.5 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        inputText.trim() ? 'bg-brand-primary text-zinc-950 scale-100 rotate-0' : 'bg-zinc-800 text-zinc-500 scale-90'
                    }`}
                >
                    {inputText.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}
                </button>
            </div>
          </div>
      )}
      
      {(isBlocked || targetUser.is_deleted) && (
          <div className="p-4 bg-zinc-950 border-t border-zinc-900 pb-safe text-center">
              <p className="text-xs text-zinc-600 italic">
                  {targetUser.is_deleted ? "Esta conta não existe mais." : "Conversa indisponível."}
              </p>
          </div>
      )}
    </div>
  );
};

export default ChatScreen;