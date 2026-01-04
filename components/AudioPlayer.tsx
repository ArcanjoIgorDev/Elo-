
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
    src: string;
    className?: string;
    dark?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className = "", dark = false }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        const handleMetadata = () => {
            if(audio.duration !== Infinity) setDuration(audio.duration);
        };

        const handleEnded = () => setPlaying(false);

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', handleMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', handleMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) return;
        if (playing) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setPlaying(!playing);
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-3 p-2 rounded-xl transition-all select-none ${dark ? 'bg-zinc-800' : 'bg-brand-primary/10 border border-brand-primary/20'} ${className}`}>
            <button 
                onClick={togglePlay} 
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${dark ? 'bg-zinc-700 text-white' : 'bg-brand-primary text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}
            >
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
            </button>
            
            <div className="flex-1 flex flex-col justify-center h-10 gap-1 min-w-[120px]">
                 {/* Visual Waveform Simulation */}
                 <div className="flex items-center gap-0.5 h-5 overflow-hidden mask-gradient-r">
                     {[...Array(24)].map((_, i) => (
                         <div 
                            key={i} 
                            className={`w-1 rounded-full transition-all duration-300 ${playing ? 'animate-pulse' : ''} ${dark ? 'bg-zinc-500' : 'bg-brand-primary'}`} 
                            style={{ 
                                height: `${Math.max(20, Math.random() * 100)}%`, 
                                opacity: (i / 24) * 100 < progress ? 1 : 0.3,
                                animationDelay: `${i * 0.05}s`
                            }}
                        ></div>
                     ))}
                 </div>
                 <div className="flex justify-between w-full">
                     <span className={`text-[9px] font-mono ${dark ? 'text-zinc-400' : 'text-brand-primary/80'}`}>{formatTime(audioRef.current?.currentTime || 0)}</span>
                     <span className={`text-[9px] font-mono ${dark ? 'text-zinc-500' : 'text-brand-primary/60'}`}>{formatTime(duration)}</span>
                 </div>
            </div>
            
            <audio ref={audioRef} src={src} preload="metadata" />
        </div>
    );
};

export default AudioPlayer;
