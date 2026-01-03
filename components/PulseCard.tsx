
import React, { useState, useEffect } from 'react';
import { Pulse, ReactionType } from '../types';
import { Trash2, Heart, Flame, Play } from 'lucide-react';
import { deletePulse, getPulseReactions, togglePulseReaction } from '../services/dataService';
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
  
  // Cálculo de tempo relativo (Ex: "Há 2h")
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    getPulseReactions(pulse.id, currentUserId).then(data => {
        setReactions(data.counts);
        setMyReaction(data.userReaction);
    });

    const updateTime = () => {
        const diff = Date.now() - new Date(pulse.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) setTimeAgo(`Há ${mins}m`);
        else {
            const hours = Math.floor(mins / 60);
            setTimeAgo(`Há ${hours}h`);
        }
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, [pulse.id, currentUserId, pulse.created_at]);

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
        className="min-w-[140px] w-[140px] h-[240px] bg-zinc-900 rounded-[20px] relative group snap-start overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all select-none shadow-lg"
    >
      
      {/* Content Layer */}
      <div className="absolute inset-0 w-full h-full bg-black">
          {pulse.content_type === 'video' ? (
              <VideoPlayer src={pulse.content} className="w-full h-full object-cover" muted loop />
          ) : pulse.content_type === 'image' ? (
              <img src={pulse.content} alt="Pulse" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
             <div className="w-full h-full p-4 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                 <p className="text-zinc-300 text-xs font-medium text-center line-clamp-6">{pulse.content}</p>
             </div>
          )}
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none"></div>

      {/* Double Click Heart Animation */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${showHeartOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <Heart size={48} className="fill-white text-white drop-shadow-2xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden pointer-events-auto cursor-pointer shadow-lg hover:scale-110 transition-transform" onClick={(e) => { e.stopPropagation(); onClickProfile(pulse.user_id); }}>
              <img src={pulse.user_avatar} className="w-full h-full object-cover" />
          </div>
          <div className="bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-white border border-white/10">
              {timeAgo}
          </div>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 w-full p-2 flex flex-col gap-1 z-10 pointer-events-none">
          <p onClick={(e) => { e.stopPropagation(); onClickProfile(pulse.user_id); }} className="text-[10px] font-bold text-white truncate pl-1 pointer-events-auto cursor-pointer hover:underline">{pulse.user_name}</p>
          
          <div className="flex items-center justify-between bg-zinc-900/90 backdrop-blur-md rounded-xl p-1.5 border border-white/5 pointer-events-auto">
              <div className="flex gap-2">
                 <button onClick={(e) => handleReaction(e, 'heart')} className={`transition-transform hover:scale-110 ${myReaction === 'heart' ? 'text-pink-500' : 'text-zinc-500'}`}><Heart size={14} className={myReaction === 'heart' ? 'fill-current' : ''}/></button>
                 <button onClick={(e) => handleReaction(e, 'fire')} className={`transition-transform hover:scale-110 ${myReaction === 'fire' ? 'text-orange-500' : 'text-zinc-500'}`}><Flame size={14} className={myReaction === 'fire' ? 'fill-current' : ''}/></button>
              </div>
              {isOwner && (
                  <button onClick={handleDelete} className="text-zinc-600 hover:text-red-500"><Trash2 size={12}/></button>
              )}
          </div>
      </div>
    </div>
  );
};

export default PulseCard;
