import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MoreVertical, ShieldCheck, Thermometer, MapPin, Check, CheckCheck, Loader2, Navigation, Ban } from 'lucide-react';
import { Message, User } from '../types';
import { fetchMessages, sendMessage, markMessagesAsRead, getUserProfile } from '../services/dataService';
import { analyzeConversationEmotion } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

interface ChatScreenProps {
  chatId: string;
  targetUser: User;
  onBack: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, targetUser, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Status da Conexão
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  
  // Location State
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  
  // AI State
  const [emotion, setEmotion] = useState({ tone: 'Conectando...', intensity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    
    // Intervalo de atualização
    const interval = setInterval(() => {
        fetchMessages(chatId).then(data => {
            setMessages(data);
            if(data.length > 0 && !isAnalyzing) runEmotionAnalysis(data);
        });
    }, 10000); 

    return () => clearInterval(interval);
  }, [chatId, user, targetUser.id]);

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

  const handleSend = async (location?: {lat: number, lng: number}) => {
    if (isBlocked || (!inputText.trim() && !location) || !user) return;
    
    const tempContent = location ? "📍 Localização Compartilhada" : inputText;
    if(!location) setInputText('');

    const optimisticMsg: Message = {
        id: 'temp-' + Date.now(),
        sender_id: user.id,
        content: tempContent,
        created_at: new Date().toISOString(),
        is_read: false,
        location: location
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const savedMessage = await sendMessage(tempContent, chatId, user.id, location);
    
    if (savedMessage) {
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? savedMessage : m));
        runEmotionAnalysis([...messages, savedMessage]);
    }
  };

  const handleShareLocation = () => {
    if (isBlocked) return;
    if (!navigator.geolocation) {
        console.error("Geolocalização não suportada.");
        return;
    }
    
    setIsSharingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            handleSend({ lat: latitude, lng: longitude });
            setIsSharingLocation(false);
        }, 
        (err) => {
            console.error("Erro GPS:", err);
            setIsSharingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getIntensityColor = (intensity: number) => {
      if (intensity < 30) return 'text-zinc-400';
      if (intensity < 60) return 'text-brand-primary';
      return 'text-red-400';
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950">
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
                    className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800" 
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
        {/* Aviso de Bloqueio */}
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
            // Se sender_id for null (usuário deletado) e não fui eu (user.id), renderiza à esquerda
            const isMe = msg.sender_id === user?.id; 
            
            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative group shadow-sm ${
                    isMe 
                        ? 'bg-zinc-100 text-zinc-950 rounded-br-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700'
                    }`}
                >
                    {/* Location Content */}
                    {msg.location ? (
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
                        msg.content
                    )}

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-60 ${isMe ? 'text-zinc-700' : 'text-zinc-500'}`}>
                        <span className="text-[9px]">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {isMe && (
                             msg.is_read ? <CheckCheck size={12} className="text-blue-600" /> : <Check size={12} />
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
          <div className="p-4 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 pb-safe shrink-0">
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleShareLocation}
                    disabled={isSharingLocation}
                    className={`w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center transition-all ${
                        isSharingLocation ? 'bg-zinc-800 text-brand-primary cursor-wait' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900'
                    }`}
                    title="Compartilhar Localização"
                >
                    {isSharingLocation ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                </button>
                <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-2 rounded-full pl-4 focus-within:border-zinc-600 transition-colors">
                    <ShieldCheck size={18} className="text-zinc-600" />
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escreva com consciência..."
                        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none"
                    />
                    <button 
                        onClick={() => handleSend()}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            inputText.trim() ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-500'
                        }`}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
          </div>
      )}
      
      {/* Aviso Footer se bloqueado */}
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