import React, { useState, useEffect } from 'react';
import { Pulse, ReactionType } from '../types';
import { Clock, Trash2, Heart, Flame, Calendar } from 'lucide-react';
import { deletePulse, getPulseReactions, togglePulseReaction } from '../services/dataService';

interface PulseCardProps {
  pulse: Pulse;
  currentUserId: string;
  onDelete: (id: string) => void;
  onClickProfile: (userId: string) => void;
}

const PulseCard: React.FC<PulseCardProps> = ({ pulse, currentUserId, onDelete, onClickProfile }) => {
  const dateObj = new Date(pulse.created_at);
  const dateString = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const timeString = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
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
          setMyReaction(null);
          setReactions(prev => ({...prev, [type]: Math.max(0, prev[type] - 1)}));
      } else {
          if (myReaction) {
              setReactions(prev => ({...prev, [myReaction]: Math.max(0, prev[myReaction] - 1)}));
          }
          setMyReaction(type);
          setReactions(prev => ({...prev, [type]: prev[type] + 1}));
      }

      const success = await togglePulseReaction(pulse.id, currentUserId, type);
      if (!success) {
          setMyReaction(oldReaction);
          setReactions(oldCounts);
      }
  };

  return (
    <div 
        onClick={handleCardClick}
        className="min-w-[160px] w-[160px] h-[260px] bg-zinc-900 rounded-[20px] overflow-hidden shrink-0 snap-start relative group transition-all duration-300 active:scale-[0.98] cursor-pointer touch-manipulation shadow-lg border border-white/5"
    >
      
      {/* Background Logic */}
      {pulse.content_type === 'image' ? (
        <>
            <img 
            src={pulse.content} 
            alt="Pulso" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>
        </>
      ) : (
        <div className="absolute inset-0 bg-zinc-900 p-5 pb-16 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-zinc-950">
             <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl"></div>
             <p className="text-zinc-200 text-sm font-medium italic text-center leading-relaxed line-clamp-6 opacity-90 select-none drop-shadow-sm">
                 "{pulse.content}"
             </p>
        </div>
      )}

      {/* Header Info (Data Exata) */}
      <div className="absolute top-0 left-0 w-full p-3 pointer-events-none z-10 flex justify-between items-start">
          <div className="flex justify-between items-start w-full">
             <div className="w-8 h-8 rounded-full border border-white/20 p-[2px] backdrop-blur-xl bg-white/5 overflow-hidden shadow-sm">
                <img 
                    src={pulse.user_avatar || `https://ui-avatars.com/api/?name=${pulse.user_name}&background=random`} 
                    className="w-full h-full rounded-full object-cover" 
                    alt="User" 
                />
             </div>
             
             {/* Data Badge */}
             <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg flex flex-col items-end border border-white/5 shadow-lg">
                <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1">
                    {dateString}
                </span>
                <span className="text-[8px] text-zinc-500 font-mono">
                    {timeString}
                </span>
             </div>
          </div>
      </div>

      {/* Content Bottom Layer */}
      <div className="absolute bottom-0 w-full p-3 z-20">
          
          {/* User Info */}
          <div className="mb-10 pointer-events-none">
             <p className="text-xs font-bold text-white truncate drop-shadow-md tracking-wide">
                 {pulse.user_name}
             </p>
          </div>

          {/* Glass Action Bar */}
          <div className="glass-panel absolute bottom-3 left-3 right-3 rounded-full h-10 flex items-center justify-between px-1 shadow-lg">
              {/* Reactions */}
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={(e) => handleReaction(e, 'heart')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        myReaction === 'heart' ? 'text-pink-500 bg-pink-500/10' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                      <Heart size={14} className={myReaction === 'heart' ? 'fill-current' : ''} />
                  </button>

                  <button 
                    onClick={(e) => handleReaction(e, 'fire')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        myReaction === 'fire' ? 'text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                      <Flame size={14} className={myReaction === 'fire' ? 'fill-current' : ''} />
                  </button>
              </div>

              {/* Counts or Delete */}
              {isOwner ? (
                  <button 
                    onClick={handleDelete}
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all"
                  >
                      <Trash2 size={14} />
                  </button>
              ) : (
                  <div className="pr-3 flex items-center gap-1">
                      {(reactions.heart + reactions.fire) > 0 && (
                          <span className="text-[10px] font-bold text-zinc-300">
                              {reactions.heart + reactions.fire}
                          </span>
                      )}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default PulseCard;