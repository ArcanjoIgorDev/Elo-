
import React from 'react';

interface RichTextProps {
    content: string;
    onMentionClick?: (username: string) => void;
    className?: string;
}

const RichText: React.FC<RichTextProps> = React.memo(({ content, onMentionClick, className = "" }) => {
    // Regex para capturar @username (permite letras, numeros, underline)
    const parts = content.split(/(@[a-zA-Z0-9_]+)/g);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    const username = part.substring(1); // Remove @
                    return (
                        <span 
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onMentionClick) onMentionClick(username);
                            }}
                            className="font-bold text-brand-primary cursor-pointer hover:underline"
                        >
                            {part}
                        </span>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
});

export default RichText;
