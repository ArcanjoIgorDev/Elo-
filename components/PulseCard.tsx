import React, { useState, useEffect } from 'react';
import { Pulse, ReactionType } from '../types';
import { Eye, Clock, Trash2, User as UserIcon, Heart, Flame } from 'lucide-react';
import { deletePulse, getPulseReactions, togglePulseReaction } from '../services/dataService';

interface PulseCardProps {
  pulse: Pulse;
  currentUserId: string;
  onDelete: (id: string) => void;
  onClickProfile: (userId: string) => void;
}

const PulseCard: React.FC<PulseCardProps> = ({ pulse, currentUserId, onDelete, onClickProfile }) => {
  const timeString = new Date(pulse.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isOwner = pulse.user_id === currentUserId;

  const [reactions, setReactions] = useState<{heart: number, fire: number}>({heart: 0, fire: 0});
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);

  useEffect(() => {
    getPulseReactions(pulse.id, currentUserId).then(data => {
        setReactions(data.counts);
        setMyReaction(data.userReaction);
    });
  }, [pulse.id, currentUserId]);

  const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm("Remover este pulso?")) {
          const success = await deletePulse(pulse.id);
          if(success) onDelete(pulse.id);
      }
  };

  const handleCardClick = () => {
      if (!isOwner) {
          onClickProfile(pulse.user_id);
      }
  };

  const handleReaction = async (e: React.MouseEvent, type: ReactionType) => {
      e.stopPropagation();
      
      // Optimistic Update
      const oldReaction = myReaction;
      const oldCounts = {...reactions};

      if (myReaction === type) {
          // Remove
          setMyReaction(null);
          setReactions(prev => ({...prev, [type]: Math.max(0, prev[type] - 1)}));
      } else {
          // Add or Switch
          if (myReaction) {
              setReactions(prev => ({...prev, [myReaction]: Math.max(0, prev[myReaction] - 1)}));
          }
          setMyReaction(type);
          setReactions(prev => ({...prev, [type]: prev[type] + 1}));
      }

      const success = await togglePulseReaction(pulse.id, currentUserId, type);
      if (!success) {
          // Revert
          setMyReaction(oldReaction);
          setReactions(oldCounts);
      }
  };

  return (
    <div 
        onClick={handleCardClick}
        className="min-w-[150px] w-[150px] h-[240px] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shrink-0 snap-start mr-3 relative group transition-all duration-300 active:scale-95 cursor-pointer touch-manipulation"
    >
      
      {/* Background Logic */}
      {pulse.content_type === 'image' ? (
        <>
            <img 
            src={pulse.content} 
            alt="Pulso" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90"></div>
        </>
      ) : (
        <div className="absolute inset-0 bg-zinc-900 p-4 pb-12 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-zinc-950">
             <p className="text-zinc-300 text-xs font-serif italic text-center leading-relaxed line-clamp-6 opacity-90 select-none">
                 "{pulse.content}"
             </p>
        </div>
      )}

      {/* Delete Button (Owner Only) */}
      {isOwner && (
          <button 
            onClick={handleDelete}
            className="absolute top-2 right-2 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-zinc-400 hover:text-red-400 hover:bg-black/60 transition-all"
          >
              <Trash2 size={14} />
          </button>
      )}

      {/* Header Info */}
      <div className="absolute top-0 left-0 w-full p-3 pointer-events-none z-10">
          <div className="flex justify-between items-start">
             <div className="w-8 h-8 rounded-full border border-white/10 p-[2px] backdrop-blur-md bg-black/20 overflow-hidden">
                <img 
                    src={pulse.user_avatar || `https://ui-avatars.com/api/?name=${pulse.user_name}&background=random`} 
                    className="w-full h-full rounded-full object-cover" 
                    alt="User" 
                />
             </div>
             <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1">
                <Clock size={10} className="text-zinc-400" />
                <span className="text-[9px] text-zinc-300 font-medium">{timeString}</span>
             </div>
          </div>
      </div>

      {/* Content Bottom Layer */}
      <div className="absolute bottom-0 w-full p-3 flex flex-col justify-end pointer-events-none">
          
          {/* User Info & Desc */}
          <div className="space-y-1 mb-2">
             <p className="text-[12px] font-bold text-white truncate drop-shadow-md tracking-wide">
                 {pulse.user_name || 'Usuário'}
             </p>
             {pulse.content_type === 'image' && pulse.description && (
                 <p className="text-[10px] text-zinc-300 line-clamp-1 leading-tight opacity-90 drop-shadow-sm">
                     {pulse.description}
                 </p>
             )}
          </div>

          {/* REACTION BAR */}
          <div className="flex items-center gap-2 pointer-events-auto">
              <button 
                onClick={(e) => handleReaction(e, 'heart')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-full backdrop-blur-md transition-all ${
                    myReaction === 'heart' ? 'bg-pink-500/20 text-pink-500 border border-pink-500/30' : 'bg-black/40 text-zinc-400 border border-white/5 hover:bg-black/60'
                }`}
              >
                  <Heart size={12} className={myReaction === 'heart' ? 'fill-current' : ''} />
                  {reactions.heart > 0 && <span className="text-[9px] font-bold">{reactions.heart}</span>}
              </button>

              <button 
                onClick={(e) => handleReaction(e, 'fire')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-full backdrop-blur-md transition-all ${
                    myReaction === 'fire' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' : 'bg-black/40 text-zinc-400 border border-white/5 hover:bg-black/60'
                }`}
              >
                  <Flame size={12} className={myReaction === 'fire' ? 'fill-current' : ''} />
                  {reactions.fire > 0 && <span className="text-[9px] font-bold">{reactions.fire}</span>}
              </button>
          </div>
      </div>
    </div>
  );
};

export default PulseCard;