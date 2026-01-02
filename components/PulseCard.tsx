import React, { useState, useEffect } from 'react';
import { Pulse, ReactionType } from '../types';
import { Trash2, Heart, Flame } from 'lucide-react';
import { deletePulse, getPulseReactions, togglePulseReaction } from '../services/dataService';

interface PulseCardProps {
  pulse: Pulse;
  currentUserId: string;
  onDelete: (id: string) => void;
  onClickProfile: (userId: string) => void;
}

const PulseCard: React.FC<PulseCardProps> = ({ pulse, currentUserId, onDelete, onClickProfile }) => {
  const dateObj = new Date(pulse.created_at);
  // Formato "24 OUT"
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
  
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
      if(window.confirm("Remover?")) {
          const success = await deletePulse(pulse.id);
          if(success) onDelete(pulse.id);
      }
  };

  const handleReaction = async (e: React.MouseEvent, type: ReactionType) => {
      e.stopPropagation();
      const oldReaction = myReaction;
      const oldCounts = {...reactions};

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
          setMyReaction(oldReaction);
          setReactions(oldCounts);
      }
  };

  return (
    <div 
        onClick={() => !isOwner && onClickProfile(pulse.user_id)}
        className="min-w-[140px] w-[140px] h-[240px] bg-zinc-900 rounded-[4px] relative group snap-start cursor-pointer overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all active:scale-[0.98]"
    >
      {/* Imagem ou Gradiente */}
      {pulse.content_type === 'image' ? (
        <img src={pulse.content} alt="Pulse" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
      ) : (
        <div className="absolute inset-0 bg-zinc-900 p-4 flex items-center justify-center bg-[linear-gradient(45deg,transparent_25%,rgba(68,68,68,.2)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[gradient_15s_ease_infinite]">
             <p className="text-zinc-300 text-[11px] font-mono leading-relaxed text-center line-clamp-6 mix-blend-screen">
                 {pulse.content}
             </p>
        </div>
      )}

      {/* Overlay Escuro */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90"></div>

      {/* Top Info (Data Vertical) */}
      <div className="absolute top-0 right-0 p-2 flex flex-col items-center">
          <div className="bg-black/50 backdrop-blur-md border border-white/5 px-1.5 py-2 rounded-sm flex flex-col items-center gap-0.5 shadow-lg">
               <span className="text-[10px] font-bold text-white leading-none">{day}</span>
               <span className="text-[8px] font-mono text-zinc-400 uppercase leading-none">{month}</span>
          </div>
      </div>

      {/* User Avatar Badge */}
      <div className="absolute top-2 left-2">
          <div className="w-8 h-8 rounded-sm p-[1px] bg-zinc-800 border border-zinc-700">
             <img src={pulse.user_avatar} className="w-full h-full object-cover rounded-sm grayscale group-hover:grayscale-0 transition-all" />
          </div>
      </div>

      {/* Bottom Actions */}
      <div className="absolute bottom-0 w-full p-2 flex flex-col gap-2">
          <p className="text-[10px] font-bold text-white truncate pl-1">{pulse.user_name}</p>
          
          <div className="flex items-center justify-between bg-zinc-900/80 backdrop-blur-md rounded-sm p-1 border border-white/5">
              <div className="flex gap-2">
                 <button onClick={(e) => handleReaction(e, 'heart')} className={`transition-transform hover:scale-110 ${myReaction === 'heart' ? 'text-pink-500' : 'text-zinc-500'}`}><Heart size={14} className={myReaction === 'heart' ? 'fill-current' : ''}/></button>
                 <button onClick={(e) => handleReaction(e, 'fire')} className={`transition-transform hover:scale-110 ${myReaction === 'fire' ? 'text-orange-500' : 'text-zinc-500'}`}><Flame size={14} className={myReaction === 'fire' ? 'fill-current' : ''}/></button>
              </div>
              {isOwner ? (
                  <button onClick={handleDelete} className="text-zinc-600 hover:text-red-500"><Trash2 size={12}/></button>
              ) : (reactions.heart + reactions.fire > 0) && (
                  <span className="text-[9px] text-zinc-400 font-mono pr-1">{reactions.heart + reactions.fire}</span>
              )}
          </div>
      </div>
    </div>
  );
};

export default PulseCard;