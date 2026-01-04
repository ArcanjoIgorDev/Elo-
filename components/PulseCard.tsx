
import React, { useState, useEffect, useRef } from 'react';
import { Pulse, ReactionType } from '../types';
import { Trash2, Heart, Flame, Play, Clock, Loader2, Eye } from 'lucide-react';
import { deletePulse, getPulseReactions, togglePulseReaction, registerView } from '../services/dataService';
import VideoPlayer from './VideoPlayer';

interface PulseCardProps {
  pulse: Pulse;
  currentUserId: string;
  onDelete: (id: string) => void;
  onClickProfile: (userId: string) => void;
}

const PulseCard: React.FC<PulseCardProps> = ({ pulse, currentUserId, onDelete, onClickProfile }) => {
  const isOwner = pulse.user_id === currentUserId;
  const [reactions, setReactions] = useState<{heart: number, fire: number}>({heart: 0, fire: 0});
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [timeAgo, setTimeAgo] = useState('');
  const viewRegistered = useRef(false);

  useEffect(() => {
    if (!viewRegistered.current) {
        registerView(pulse.id, 'pulse');
        viewRegistered.current = true;
    }

    getPulseReactions(pulse.id, currentUserId).then(data => {
        setReactions(data.counts);
        setMyReaction(data.userReaction);
    });

    const updateTime = () => {
        const diff = Date.now() - new Date(pulse.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) setTimeAgo(`${mins}m`);
        else {
            const hours = Math.floor(mins / 60);
            setTimeAgo(`${hours}h`);
        }
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, [pulse.id, currentUserId, pulse.created_at]);

  const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm("Apagar esta Vibe permanentemente?")) {
          setIsDeleting(true);
          const success = await deletePulse(pulse.id);
          if(success) {
              onDelete(pulse.id);
          } else {
              setIsDeleting(false);
              alert("Erro ao apagar. Tente novamente ou verifique sua conexão.");
          }
      }
  };

  const handleReaction = async (e: React.MouseEvent, type: ReactionType) => {
      e.stopPropagation();
      const oldReaction = myReaction;
      
      if (myReaction === type) {
          setMyReaction(null);
          setReactions(prev => ({...prev, [type]: Math.max(0, prev[type] - 1)}));
      } else {
          if (myReaction) setReactions(prev => ({...prev, [myReaction]: Math.max(0, prev[myReaction] - 1)}));
          setMyReaction(type);
          setReactions(prev => ({...prev, [type]: prev[type] + 1}));
      }

      const success = await togglePulseReaction(pulse.id, currentUserId, type);
      if (!success) {
          setMyReaction(oldReaction); // Rollback
      }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleReaction(e, 'heart');
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
  };

  return (
    <div 
        onDoubleClick={handleDoubleClick}
        className={`min-w-[140px] w-[140px] h-[240px] bg-zinc-900 rounded-[24px] relative group snap-start overflow-hidden border border-zinc-800 transition-all select-none shadow-xl hover:shadow-brand-primary/10 hover:border-zinc-700 ${isDeleting ? 'opacity-50 grayscale pointer-events-none' : ''}`}
    >
      
      {/* Content Layer */}
      <div className="absolute inset-0 w-full h-full bg-black">
          {pulse.content_type === 'video' ? (
              <VideoPlayer src={pulse.content} className="w-full h-full object-cover" muted loop />
          ) : pulse.content_type === 'image' ? (
              <img src={pulse.content} alt="Pulse" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
             <div className="w-full h-full p-5 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                 <p className="text-zinc-200 text-sm font-medium text-center line-clamp-6 leading-relaxed italic">"{pulse.content}"</p>
             </div>
          )}
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none"></div>

      {/* Double Click Heart Animation */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${showHeartOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <Heart size={48} className="fill-brand-primary text-brand-primary drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce" />
      </div>

      {/* Header */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none z-20">
          <div className="w-8 h-8 rounded-full border border-white/20 p-[1px] overflow-hidden pointer-events-auto cursor-pointer shadow-lg hover:scale-105 transition-transform bg-black" onClick={(e) => { e.stopPropagation(); onClickProfile(pulse.user_id); }}>
              <img src={pulse.user_avatar} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="flex gap-2 items-start">
              <span className="flex items-center gap-1 text-[8px] text-white bg-black/40 backdrop-blur px-1.5 py-0.5 rounded font-mono">
                  <Eye size={8} /> {pulse.views_count || 0}
              </span>
              {isOwner && (
                 <button onClick={handleDelete} className="bg-black/50 backdrop-blur-md p-1.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/20 border border-white/10 pointer-events-auto transition-colors">
                     {isDeleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                 </button>
              )}
          </div>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 w-full p-3 flex flex-col gap-2 z-20 pointer-events-none">
          <div className="flex items-center justify-between">
             <p onClick={(e) => { e.stopPropagation(); onClickProfile(pulse.user_id); }} className="text-xs font-bold text-white truncate pointer-events-auto cursor-pointer hover:underline shadow-black drop-shadow-md">{pulse.user_name}</p>
             <span className="text-[9px] text-zinc-400 font-mono flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/5"><Clock size={8}/>{timeAgo}</span>
          </div>
          
          <div className="flex items-center gap-1 pointer-events-auto">
             <button onClick={(e) => handleReaction(e, 'heart')} className={`flex-1 h-8 rounded-xl flex items-center justify-center gap-1 bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all ${myReaction === 'heart' ? 'text-brand-primary border-brand-primary/50 bg-brand-primary/10' : 'text-zinc-300'}`}>
                 <Heart size={14} className={myReaction === 'heart' ? 'fill-current' : ''}/>
             </button>
             <button onClick={(e) => handleReaction(e, 'fire')} className={`flex-1 h-8 rounded-xl flex items-center justify-center gap-1 bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all ${myReaction === 'fire' ? 'text-orange-500 border-orange-500/50 bg-orange-500/10' : 'text-zinc-300'}`}>
                 <Flame size={14} className={myReaction === 'fire' ? 'fill-current' : ''}/>
             </button>
          </div>
      </div>
    </div>
  );
};

export default PulseCard;
