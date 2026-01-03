
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MoreVertical, MapPin, Check, CheckCheck, Navigation, Ban, AlertTriangle, Paperclip, Image as ImageIcon, Video as VideoIcon, Mic, Sparkles, Hourglass, Plus, X, Lock, Clock, Unlock, Loader2 } from 'lucide-react';
import { Message, User, MessageType } from '../types';
import { fetchMessages, sendMessage, markMessagesAsRead, getUserProfile } from '../services/dataService';
import { analyzeConversationEmotion, EmotionType } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

interface ChatScreenProps {
  chatId: string;
  targetUser: User;
  initialMessage?: string; 
  onBack: () => void;
}

const CAPSULE_PREFIX = '::CAPSULE::';
interface CapsuleData { content: string; unlockAt: number; durationLabel: string; }

const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, targetUser, initialMessage, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState(initialMessage || ''); 
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [isBlocked, setIsBlocked] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showCapsuleModal, setShowCapsuleModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [partnerEmotion, setPartnerEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

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
    
    // Realtime subscription simplified for brevity
    const channel = supabase.channel(`chat_${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, 
        (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            scrollToBottom();
        }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user, targetUser.id]);

  const runEmotionAnalysis = async (msgs: Message[]) => {
      if (!user) return;
      setIsAnalyzing(true);
      const result = await analyzeConversationEmotion(msgs, user.id);
      setPartnerEmotion(result.partnerEmotion);
      setIsAnalyzing(false);
  };

  const scrollToBottom = () => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); }

  const handleSend = async (type: MessageType = 'text', content: string = inputText, location?: {lat: number, lng: number}, mediaFile?: File) => {
    if (isBlocked || !user) return;
    if (type === 'text' && !content.trim()) return;
    
    setIsSending(true);
    if(type === 'text') setInputText('');
    setShowAttachments(false);

    const savedMessage = await sendMessage(content, chatId, user.id, type, location, mediaFile);
    if (savedMessage) {
        setMessages(prev => [...prev, savedMessage]);
        scrollToBottom();
    }
    setIsSending(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          handleSend(type, '', undefined, file);
      }
  };

  const renderMessageContent = (msg: Message) => {
      if (msg.content && msg.content.startsWith(CAPSULE_PREFIX)) {
          // Logic for capsule (simplified)
          return <span className="text-xs italic text-zinc-400">Cápsula do tempo.</span>;
      }

      if (msg.type === 'image') return <img src={msg.media_url || msg.content} className="rounded-xl w-full max-w-[260px] object-cover" />;
      if (msg.type === 'video') return <VideoPlayer src={msg.media_url || msg.content} className="rounded-xl w-full max-w-[260px] aspect-video" />;
      if (msg.type === 'location' && msg.location) return <div className="flex items-center gap-2"><MapPin size={16}/> Localização compartilhada</div>;
      
      return <span className="whitespace-pre-wrap">{msg.content}</span>;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 relative overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <img src={targetUser.avatar_url} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
            <div>
              <h2 className="text-sm font-bold text-zinc-100">{targetUser.name}</h2>
              {partnerEmotion.tone !== 'Neutro' && <span className="text-[10px] text-brand-primary uppercase tracking-wider font-bold">{partnerEmotion.tone}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar z-10">
        {loading ? <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-zinc-500"/></div> : 
        messages.map((msg) => {
            const isMe = msg.sender_id === user?.id; 
            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] rounded-[1.2rem] text-sm leading-relaxed relative border transition-all ${
                    isMe ? 'bg-zinc-800 text-white border-transparent' : 'bg-zinc-900 text-zinc-200 border-zinc-800'
                    } ${msg.type === 'image' || msg.type === 'video' ? 'p-1' : 'px-4 py-2.5'}`}>
                    
                    {renderMessageContent(msg)}

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-60 ${isMe ? 'text-white' : 'text-zinc-500'} ${(msg.type === 'image' || msg.type === 'video') ? 'pr-2 pb-1 text-white drop-shadow-md' : ''}`}>
                        <span className="text-[9px]">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {isMe && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                    </div>
                </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isBlocked && (
          <div className="p-3 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 pb-safe shrink-0 flex flex-col gap-2 z-20">
             {showAttachments && (
                 <div className="absolute bottom-20 left-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-4 flex gap-6 animate-fade-in z-30">
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors"><ImageIcon size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Mídia</span></button>
                 </div>
             )}
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect}/>
            <div className="flex items-end gap-2">
                <button onClick={() => setShowAttachments(!showAttachments)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showAttachments ? 'bg-zinc-800 text-white rotate-45' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Plus size={24} /></button>
                <div className="flex-1 min-h-[48px] bg-zinc-900 border border-zinc-800 rounded-[24px] px-5 py-3 focus-within:border-zinc-700 transition-all flex items-center gap-2">
                    <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend('text')} placeholder="Mensagem..." className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none max-h-24"/>
                </div>
                <button disabled={isSending} onClick={() => handleSend('text')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${inputText.trim() ? 'bg-brand-primary text-zinc-950 scale-100' : 'bg-zinc-800 text-zinc-500 scale-95'}`}>
                    {isSending ? <Loader2 size={20} className="animate-spin"/> : inputText.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}
                </button>
            </div>
          </div>
      )}
    </div>
  );
};

export default ChatScreen;
