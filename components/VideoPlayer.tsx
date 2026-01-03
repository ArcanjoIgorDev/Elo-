
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface VideoPlayerProps {
    src: string;
    className?: string;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className = "", autoPlay = false, loop = false, muted = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(muted);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;

        const updateProgress = () => {
            if (vid.duration) {
                setProgress((vid.currentTime / vid.duration) * 100);
            }
        };

        const handleLoadedMetadata = () => setDuration(vid.duration);
        const handleEnded = () => {
            if(!loop) setIsPlaying(false);
        };

        vid.addEventListener('timeupdate', updateProgress);
        vid.addEventListener('loadedmetadata', handleLoadedMetadata);
        vid.addEventListener('ended', handleEnded);

        return () => {
            vid.removeEventListener('timeupdate', updateProgress);
            vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
            vid.removeEventListener('ended', handleEnded);
        };
    }, [loop]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen();
        }
    };

    return (
        <div className={`relative group overflow-hidden bg-black ${className}`}>
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover"
                loop={loop}
                autoPlay={autoPlay}
                muted={muted}
                playsInline
                onClick={togglePlay}
            />
            
            {/* Custom Controls Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3 transition-opacity duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                
                {/* Progress Bar */}
                <div className="w-full h-1 bg-zinc-700/50 rounded-full mb-3 overflow-hidden cursor-pointer" onClick={(e) => {
                     e.stopPropagation();
                     const rect = e.currentTarget.getBoundingClientRect();
                     const pos = (e.clientX - rect.left) / rect.width;
                     if(videoRef.current) videoRef.current.currentTime = pos * videoRef.current.duration;
                }}>
                    <div className="h-full bg-brand-primary shadow-[0_0_10px_#10b981]" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                        <button onClick={togglePlay} className="text-white hover:text-brand-primary transition-colors">
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button onClick={toggleMute} className="text-white hover:text-zinc-300 transition-colors">
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <span className="text-[10px] font-mono text-zinc-400">
                             {videoRef.current ? 
                                `${Math.floor(videoRef.current.currentTime / 60)}:${Math.floor(videoRef.current.currentTime % 60).toString().padStart(2,'0')} / ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2,'0')}` 
                                : "0:00"}
                         </span>
                         <button onClick={toggleFullscreen} className="text-white hover:text-brand-primary ml-2">
                             <Maximize2 size={16} />
                         </button>
                    </div>
                </div>
            </div>

            {/* Center Play Button (when paused) */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                        <Play size={20} className="text-white ml-1" fill="white" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
