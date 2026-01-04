
import React from 'react';
import { X } from 'lucide-react';

interface ImageViewerProps {
    src: string;
    onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-zinc-800/50 rounded-full text-white z-50">
                <X size={24} />
            </button>
            <img 
                src={src} 
                className="max-w-full max-h-screen object-contain transition-transform duration-300"
                onClick={(e) => e.stopPropagation()} 
                alt="Full screen"
            />
        </div>
    );
};

export default ImageViewer;
