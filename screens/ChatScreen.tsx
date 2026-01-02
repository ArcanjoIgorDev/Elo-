import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MoreVertical, ShieldCheck, Thermometer, MapPin, Check, CheckCheck, Loader2, Navigation, Ban, AlertTriangle, Paperclip, Image as ImageIcon, Mic, Camera } from 'lucide-react';
import { Message, User, MessageType } from '../types';
import { fetchMessages, sendMessage, markMessagesAsRead, getUserProfile } from '../services/dataService';
import { analyzeConversationEmotion } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

interface ChatScreenProps {
  chatId: string;
  targetUser: User;
  initialMessage?: string; // Novo Prop
  onBack: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, targetUser, initialMessage, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState(initialMessage || ''); // Inicializa com o contexto se houver
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
  
  // AI State
  const [emotion, setEmotion] = useState({ tone: 'Conectando...', intensity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
        else setEmotion({ tone: 'Vazio', intensity: 0 });
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
    
    // Foca no input se houver mensagem inicial
    if (initialMessage && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 500);
    }
    
    const interval = setInterval(() => {
        fetchMessages(chatId).then(data => {
            setMessages(data);
            if(data.length > 0 && !isAnalyzing) runEmotionAnalysis(data);
        });
    }, 10000); 

    return () => clearInterval(interval);
  }, [chatId, user, targetUser.id]);

  useEffect(() => {
      if(toastMessage) {
          const t = setTimeout(() => setToastMessage(null), 3000);
          return () => clearTimeout(t);
      }
  }, [toastMessage]);

  const runEmotionAnalysis = async (msgs: Message[]) => {
      setIsAnalyzing(true);
      const result = await analyzeConversationEmotion(msgs);
      setEmotion(result);
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
    
    // Reset inputs
    if(type === 'text') setInputText('');
    setShowAttachments(false);

    // Optimistic Update
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
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

  const getIntensityColor = (intensity: number) => {
      if (intensity < 30) return 'text-zinc-400';
      if (intensity < 60) return 'text-brand-primary';
      return 'text-red-400';
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 relative">
      
      {toastMessage && (
          <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-2 rounded-full shadow-lg font-bold text-xs animate-fade-in flex items-center gap-2 ${
              toastMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-zinc-100 text-zinc-950'
          }`}>
              {toastMessage.type === 'error' ? <AlertTriangle size={14} /> : <Check size={14} />}
              {toastMessage.text}
          </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            {targetUser.is_deleted ? (
                <div className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                    <Ban size={18} className="text-zinc-500"/>
                </div>
            ) : (
                <img 
                    src={targetUser.avatar_url || `https://ui-avatars.com/api/?name=${targetUser.name}&background=random`} 
                    className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 object-cover" 
                    alt="Avatar" 
                />
            )}
            <div>
              <h2 className={`text-sm font-bold ${targetUser.is_deleted ? 'text-zinc-500 italic' : 'text-zinc-100'}`}>
                  {targetUser.is_deleted ? 'Usuário Excluído' : targetUser.name}
              </h2>
              {!targetUser.is_deleted && (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${emotion.intensity > 50 ? 'bg-brand-primary' : 'bg-zinc-500'} animate-pulse`}></span>
                    <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
                        {isAnalyzing ? 'Analisando...' : emotion.tone}
                    </span>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
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

        {messages.length > 5 && (
            <div className="flex justify-center my-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm animate-fade-in">
                    <Thermometer size={12} className={getIntensityColor(emotion.intensity)} />
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${getIntensityColor(emotion.intensity)}`}>
                        IA Contexto: {emotion.tone} ({emotion.intensity}%)
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
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                    className={`max-w-[80%] rounded-2xl text-sm leading-relaxed relative group shadow-sm overflow-hidden ${
                    isMe 
                        ? 'bg-zinc-100 text-zinc-950 rounded-br-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700'
                    } ${msg.type === 'image' ? 'p-1' : 'px-4 py-3'}`}
                >
                    {/* Render Content Based on Type */}
                    {msg.type === 'image' ? (
                        <div className="relative">
                            <img src={msg.content} alt="Foto" className="rounded-xl w-full max-w-[250px] object-cover" />
                        </div>
                    ) : msg.type === 'location' && msg.location ? (
                        <div className="flex flex-col gap-2 min-w-[180px]">
                            <div className="flex items-center gap-2 font-bold opacity-90 border-b border-black/5 pb-2 mb-1">
                                <Navigation size={14} className={isMe ? 'text-brand-primary' : 'text-zinc-400'} />
                                <span>Localização Atual</span>
                            </div>
                            
                            <div className={`h-24 rounded-lg flex items-center justify-center relative overflow-hidden ${isMe ? 'bg-zinc-200' : 'bg-zinc-900/50'}`}>
                                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-zinc-500 to-transparent"></div>
                                <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center animate-pulse z-10">
                                    <div className="w-3 h-3 bg-brand-primary rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                </div>
                                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
                            </div>

                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${msg.location.lat},${msg.location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`text-xs font-semibold py-2 text-center rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                    isMe 
                                    ? 'bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm border border-zinc-200' 
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

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-60 ${isMe ? 'text-zinc-700' : 'text-zinc-500'} ${msg.type === 'image' ? 'pr-2 pb-1 text-white drop-shadow-md' : ''}`}>
                        <span className="text-[9px]">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {isMe && (
                             msg.is_read ? <CheckCheck size={12} className={msg.type === 'image' ? 'text-white' : 'text-blue-600'} /> : <Check size={12} />
                        )}
                    </div>
                </div>
                </div>
            );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Desativada se Bloqueado ou Usuário Deletado */}
      {!isBlocked && !targetUser.is_deleted && (
          <div className="p-3 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 pb-safe shrink-0">
             
             {/* Attachments Menu */}
             {showAttachments && (
                 <div className="absolute bottom-20 left-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3 flex gap-4 animate-fade-in z-30">
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-brand-primary transition-colors">
                         <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                             <ImageIcon size={24} />
                         </div>
                         <span className="text-[10px]">Galeria</span>
                     </button>
                     <button onClick={handleShareLocation} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-brand-primary transition-colors">
                         <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                             <MapPin size={24} />
                         </div>
                         <span className="text-[10px]">Local</span>
                     </button>
                     <button onClick={() => { setToastMessage({type: 'success', text: 'Audio em breve!'}); setShowAttachments(false); }} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-brand-primary transition-colors opacity-50">
                         <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                             <Mic size={24} />
                         </div>
                         <span className="text-[10px]">Áudio</span>
                     </button>
                 </div>
             )}
             
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect}/>

            <div className="flex items-end gap-2">
                <button 
                    onClick={() => setShowAttachments(!showAttachments)}
                    className={`w-10 h-10 mb-1 rounded-full flex items-center justify-center transition-all ${
                        showAttachments ? 'bg-zinc-800 text-brand-primary' : 'text-zinc-500 hover:bg-zinc-900'
                    }`}
                >
                    <Paperclip size={20} className={showAttachments ? 'rotate-45' : ''} />
                </button>

                <div className="flex-1 min-h-[44px] bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 focus-within:border-zinc-600 transition-colors flex items-center gap-2">
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend('text')}
                        placeholder="Mensagem..."
                        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none max-h-24"
                    />
                </div>

                <button 
                    onClick={() => handleSend('text')}
                    className={`w-10 h-10 mb-1 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        inputText.trim() ? 'bg-brand-primary text-zinc-950 scale-100' : 'bg-zinc-800 text-zinc-500 scale-90'
                    }`}
                >
                    {inputText.trim() ? <Send size={18} /> : <Mic size={18} />}
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