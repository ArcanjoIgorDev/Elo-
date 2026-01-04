
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MapPin, Check, CheckCheck, Plus, ImageIcon, Loader2, Mic, X, Play, Pause, Clock, FileText, Download, Maximize2 } from 'lucide-react';
import { Message, User, MessageType } from '../types';
import { fetchMessages, sendMessage, markMessagesAsRead, getUserProfile, formatDisplayName } from '../services/dataService';
import { analyzeConversationEmotion, EmotionType } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';
import ImageViewer from '../components/ImageViewer';

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
  const [isSending, setIsSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // Attachments & Modes
  const [showAttachments, setShowAttachments] = useState(false);
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [partnerEmotion, setPartnerEmotion] = useState<{ tone: EmotionType, intensity: number }>({ tone: 'Neutro', intensity: 0 });

  // Avatar Fallback logic
  const avatarSrc = targetUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetUser.name || 'User')}&background=random`;

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
    
    const channel = supabase.channel(`chat_${chatId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `chat_id=eq.${chatId}` 
        }, 
        (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            scrollToBottom();
            if (newMsg.sender_id !== user.id) {
                markMessagesAsRead(chatId, user.id);
            }
        }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user, targetUser.id]);

  const runEmotionAnalysis = async (msgs: Message[]) => {
      if (!user) return;
      const result = await analyzeConversationEmotion(msgs, user.id);
      setPartnerEmotion(result.partnerEmotion);
  };

  const scrollToBottom = () => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); }

  // --- AUDIO LOGIC ---
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
          setRecordingDuration(0);
          
          timerRef.current = setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Erro ao acessar microfone:", err);
          alert("Permita o acesso ao microfone para gravar.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              handleSend('audio', '', undefined, audioBlob);
              setIsRecording(false);
              setRecordingDuration(0);
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
      setRecordingDuration(0);
      cleanupRecording();
  };

  const cleanupRecording = () => {
      if (timerRef.current) clearInterval(timerRef.current!);
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
      }
  };

  // --- SEND LOGIC ---
  const handleSend = async (type: MessageType = 'text', content: string = inputText, location?: {lat: number, lng: number}, mediaFile?: File | Blob) => {
    if (isBlocked || !user || isSending) return;
    
    const safeContent = content || '';
    if (type === 'text' && !safeContent.trim()) return;

    setIsSending(true);
    
    if(type === 'text') setInputText('');
    setShowAttachments(false);

    // Optimistic
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
        id: tempId,
        chat_id: chatId,
        sender_id: user.id,
        content: type === 'audio' ? 'Áudio' : safeContent,
        type: type,
        created_at: new Date().toISOString(),
        is_read: false,
        location: location,
        is_ephemeral: isEphemeralMode,
        media_url: mediaFile ? URL.createObjectURL(mediaFile) : undefined
    };

    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
        const savedMessage = await sendMessage(safeContent, chatId, user.id, type, location, mediaFile, isEphemeralMode);
        if (savedMessage) {
            setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
        } else {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            if(type === 'text') setInputText(safeContent);
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
        setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : 'file';
          handleSend(type, file.name, undefined, file);
      }
  };

  const renderMessageContent = (msg: Message) => {
      if (msg.type === 'image') return <img src={msg.media_url || msg.content} onLoad={scrollToBottom} onClick={() => setFullScreenImage(msg.media_url || msg.content)} className="rounded-xl w-full max-w-[260px] object-cover cursor-pointer hover:opacity-90 transition-opacity" />;
      if (msg.type === 'video') return <VideoPlayer src={msg.media_url || msg.content} className="rounded-xl w-full max-w-[260px] aspect-video" />;
      if (msg.type === 'location' && msg.location) return <div className="flex items-center gap-2"><MapPin size={16}/> Localização compartilhada</div>;
      
      if (msg.type === 'audio') {
          return <AudioPlayer src={msg.media_url || ''} className="min-w-[180px]" dark={true} />;
      }

      if (msg.type === 'file') {
          return (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors no-underline">
                  <div className="p-2 bg-zinc-800 rounded-lg"><FileText size={20} className="text-zinc-300"/></div>
                  <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate font-medium max-w-[150px]">{msg.content || 'Arquivo'}</p>
                      <p className="text-[9px] text-zinc-500">Toque para baixar</p>
                  </div>
                  <Download size={16} className="text-brand-primary"/>
              </a>
          );
      }
      
      return <span className="whitespace-pre-wrap">{msg.content}</span>;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col h-[100dvh]">
      
      {fullScreenImage && <ImageViewer src={fullScreenImage} onClose={() => setFullScreenImage(null)} />}

      {/* Background Decor (Lower z-index) */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-secondary/5 rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-brand-primary/5 rounded-full blur-[80px] pointer-events-none z-0"></div>

      {/* Header - Solid Background & High Z-Index */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800 shrink-0 relative z-50 shadow-sm h-16">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
                <img src={avatarSrc} className="w-10 h-10 rounded-full bg-zinc-800 object-cover border border-zinc-700" />
                {isEphemeralMode && <div className="absolute -bottom-1 -right-1 bg-black rounded-full border border-brand-primary p-0.5"><Clock size={10} className="text-brand-primary"/></div>}
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">{formatDisplayName(targetUser.name)}</h2>
              {partnerEmotion.tone !== 'Neutro' && (
                  <div className="flex items-center gap-1.5 animate-fade-in">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">{partnerEmotion.tone}</span>
                  </div>
              )}
            </div>
          </div>
        </div>
        <button 
            onClick={() => setIsEphemeralMode(!isEphemeralMode)} 
            className={`p-2 rounded-full transition-colors ${isEphemeralMode ? 'text-brand-primary bg-brand-primary/10' : 'text-zinc-500 hover:text-white'}`}
        >
            <Clock size={20} />
        </button>
      </header>

      {/* Messages Area - Flex Grow & Scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 bg-zinc-950/50">
        {loading ? <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-zinc-500"/></div> : 
        messages.map((msg) => {
            const isMe = msg.sender_id === user?.id; 
            const isOptimistic = msg.id.startsWith('temp-');
            
            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up group`}>
                    <div className={`max-w-[80%] rounded-2xl text-sm leading-relaxed relative border shadow-sm backdrop-blur-sm transition-all
                        ${isMe 
                            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 text-white border-white/5 rounded-br-none' 
                            : 'bg-zinc-900/80 text-zinc-200 border-white/5 rounded-bl-none'
                        } 
                        ${(msg.type === 'image' || msg.type === 'video') ? 'p-1' : 'px-4 py-3'}
                        ${isOptimistic ? 'opacity-70' : 'opacity-100'}
                        ${msg.is_ephemeral ? 'border-brand-primary/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : ''}
                    `}>
                        {msg.is_ephemeral && !isMe && (
                             <div className="absolute -top-2 -left-2 bg-brand-primary text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full z-10 flex items-center gap-1"><Clock size={8}/> 24h</div>
                        )}

                        {renderMessageContent(msg)}

                        <div className={`flex items-center justify-end gap-1 mt-1 opacity-50 ${isMe ? 'text-zinc-300' : 'text-zinc-500'} ${(msg.type === 'image' || msg.type === 'video') ? 'pr-2 pb-1 text-white drop-shadow-md' : ''}`}>
                            <span className="text-[9px] font-mono">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            {isMe && (msg.is_read ? <CheckCheck size={12} className="text-brand-primary"/> : <Check size={12} />)}
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} className="h-2"/>
      </div>

      {/* Audio Recording UI Overlay */}
      {isRecording && (
          <div className="absolute bottom-0 left-0 w-full p-4 bg-zinc-950 border-t border-brand-primary/50 z-50 flex items-center gap-4 animate-slide-up h-[80px]">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 animate-pulse">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1 h-8">
                       {/* Fake Waveform Animation */}
                       {[...Array(12)].map((_, i) => (
                           <div key={i} className="w-1 bg-brand-primary rounded-full animate-pulse" style={{ height: `${Math.random() * 20 + 10}px`, animationDelay: `${i * 0.1}s` }}></div>
                       ))}
                  </div>
                  <span className="text-xs font-mono text-brand-primary mt-1">{new Date(recordingDuration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <button onClick={cancelRecording} className="text-zinc-500 hover:text-white text-xs font-bold mr-2">CANCELAR</button>
              <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-black hover:scale-110 transition-transform">
                  <Send size={18} className="ml-0.5"/>
              </button>
          </div>
      )}

      {/* Input Area */}
      {!isBlocked && !isRecording && (
          <div className="p-3 bg-zinc-950 border-t border-zinc-800 pb-safe shrink-0 flex flex-col gap-2 z-40">
             {showAttachments && (
                 <div className="absolute bottom-20 left-4 bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl p-4 flex gap-6 animate-fade-in z-50">
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors"><ImageIcon size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Galeria/Arq</span></button>
                     <button onClick={() => { handleSend('location', '', {lat: user.latitude || 0, lng: user.longitude || 0}); setShowAttachments(false); }} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors"><MapPin size={20} /></div><span className="text-[9px] font-bold text-zinc-400">Local</span></button>
                 </div>
             )}
             <input type="file" ref={fileInputRef} className="hidden" accept="*/*" onChange={handleFileSelect}/>
            
            <div className="flex items-end gap-2">
                <button onClick={() => setShowAttachments(!showAttachments)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showAttachments ? 'bg-zinc-800 text-white rotate-45' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Plus size={24} /></button>
                <div className={`flex-1 min-h-[48px] bg-zinc-900/50 border ${isEphemeralMode ? 'border-brand-primary/30' : 'border-zinc-800'} rounded-[24px] px-5 py-3 focus-within:border-brand-primary/50 transition-all flex items-center gap-2`}>
                    {isEphemeralMode && <Clock size={16} className="text-brand-primary animate-pulse"/>}
                    <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend('text')} placeholder={isEphemeralMode ? "Mensagem temporária..." : "Mensagem..."} className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none max-h-24"/>
                </div>
                
                {inputText.trim() ? (
                    <button disabled={isSending} onClick={() => handleSend('text')} className="w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg bg-brand-primary text-zinc-950 scale-100 hover:scale-105">
                       {isSending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} className="ml-0.5" />}
                    </button>
                ) : (
                    <button onClick={startRecording} className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-zinc-800 text-white hover:bg-zinc-700">
                        <Mic size={20} />
                    </button>
                )}
            </div>
          </div>
      )}
    </div>
  );
};

export default ChatScreen;
