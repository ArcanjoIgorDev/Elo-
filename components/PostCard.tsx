
import React, { useState } from 'react';
import { Post, User } from '../types';
import { Heart, MessageCircle, MoreVertical, Send, Trash2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { togglePostLike, addPostComment, deletePost } from '../services/dataService';

interface PostCardProps {
    post: Post;
    currentUser: User;
    onDelete?: (postId: string) => void;
    onProfileClick: (userId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onDelete, onProfileClick }) => {
    const [liked, setLiked] = useState(post.liked_by_me);
    const [likesCount, setLikesCount] = useState(post.likes_count);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentsCount, setCommentsCount] = useState(post.comments_count);
    const [localComments, setLocalComments] = useState<any[]>([]); 
    
    const isOwner = post.user.id === currentUser.id;

    const handleLike = async () => {
        const oldState = liked;
        setLiked(!liked);
        setLikesCount(prev => !liked ? prev + 1 : prev - 1);
        
        const success = await togglePostLike(post.id, currentUser.id);
        if(!success) {
            setLiked(oldState);
            setLikesCount(prev => oldState ? prev + 1 : prev - 1);
        }
    };

    const handleComment = async () => {
        if(!newComment.trim()) return;
        const tempComment = {
            id: 'temp-' + Date.now(),
            user: currentUser,
            content: newComment,
            created_at: new Date().toISOString()
        };
        
        setLocalComments(prev => [...prev, tempComment]);
        setCommentsCount(prev => prev + 1);
        setNewComment('');

        await addPostComment(post.id, currentUser.id, newComment);
    };

    const handleDelete = async () => {
        if(confirm("Excluir esta publicação permanentemente?")) {
            const success = await deletePost(post.id);
            if(success && onDelete) onDelete(post.id);
        }
    };

    return (
        <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-[2rem] overflow-hidden mb-6 animate-fade-in shadow-xl hover:border-zinc-700 transition-colors">
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onProfileClick(post.user.id)}>
                    <img src={post.user.avatar_url} className="w-10 h-10 rounded-full border border-zinc-800 object-cover group-hover:border-brand-primary transition-colors" />
                    <div>
                        <h4 className="text-zinc-100 font-bold text-sm group-hover:text-brand-primary transition-colors">{post.user.name}</h4>
                        <p className="text-zinc-500 text-[10px]">@{post.user.username}</p>
                    </div>
                </div>
                {isOwner && (
                    <button onClick={handleDelete} className="text-zinc-600 hover:text-red-500 transition-colors p-2">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="px-5 pb-4">
                <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
            </div>

            {/* Media */}
            {post.media_url && (
                <div className="w-full bg-black border-y border-zinc-800">
                    {post.media_type === 'video' ? (
                        <VideoPlayer src={post.media_url} className="w-full aspect-video" />
                    ) : (
                        <img src={post.media_url} className="w-full h-auto object-cover max-h-[500px]" loading="lazy" />
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="px-5 py-3 flex items-center gap-6 border-t border-white/5 bg-white/5">
                <button onClick={handleLike} className="flex items-center gap-2 group">
                    <Heart size={20} className={`transition-all ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                    <span className={`text-xs font-bold ${liked ? 'text-red-500' : 'text-zinc-500'}`}>{likesCount}</span>
                </button>
                
                {post.allow_comments ? (
                    <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 group">
                        <MessageCircle size={20} className="text-zinc-400 group-hover:text-zinc-200" />
                        <span className="text-xs font-bold text-zinc-500">{commentsCount}</span>
                    </button>
                ) : (
                    <span className="text-[10px] text-zinc-600 italic">Comentários OFF</span>
                )}
            </div>

            {/* Comments Section */}
            {showComments && post.allow_comments && (
                <div className="px-5 pb-5 pt-3 bg-zinc-950/50">
                    {localComments.length > 0 && (
                        <div className="space-y-3 mb-4">
                            {localComments.map(c => (
                                <div key={c.id} className="flex gap-2">
                                    <span className="text-xs font-bold text-zinc-300">{c.user.username}</span>
                                    <span className="text-xs text-zinc-400">{c.content}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex gap-3 items-center mt-2">
                        <img src={currentUser.avatar_url} className="w-6 h-6 rounded-full" />
                        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 flex items-center shadow-inner">
                            <input 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Adicionar comentário..." 
                                className="bg-transparent text-xs text-zinc-200 w-full outline-none placeholder-zinc-600"
                                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                            />
                            <button onClick={handleComment} disabled={!newComment.trim()} className="text-brand-primary disabled:opacity-30 hover:scale-110 transition-transform">
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostCard;
