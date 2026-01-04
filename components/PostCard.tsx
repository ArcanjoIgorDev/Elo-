
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Post, User, PostComment } from '../types';
import { Heart, MessageCircle, Send, Trash2, MoreVertical, Loader2, Maximize2, Eye } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import ImageViewer from './ImageViewer';
import { togglePostLike, addPostComment, deletePost, fetchPostComments, deletePostComment, toggleCommentLike, searchUsers, formatDisplayName, registerView } from '../services/dataService';
import RichText from './RichText';

interface PostCardProps {
    post: Post;
    currentUser: User;
    onDelete?: (postId: string) => void;
    onProfileClick: (userId: string) => void;
    onMentionClick: (username: string) => void; 
}

const PostCard: React.FC<PostCardProps> = React.memo(({ post, currentUser, onDelete, onProfileClick, onMentionClick }) => {
    const [liked, setLiked] = useState(post.liked_by_me);
    const [likesCount, setLikesCount] = useState(post.likes_count);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentsCount, setCommentsCount] = useState(post.comments_count);
    const [loadingComments, setLoadingComments] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [animateLike, setAnimateLike] = useState(false);
    
    // View Tracking
    const viewRegistered = useRef(false);

    // Mention Suggestion State
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);

    const isOwner = post.user_id === currentUser.id || post.user.id === currentUser.id;

    useEffect(() => {
        if (!viewRegistered.current) {
            registerView(post.id, 'post');
            viewRegistered.current = true;
        }
    }, [post.id]);

    useEffect(() => {
        if (showComments && comments.length === 0) {
            setLoadingComments(true);
            fetchPostComments(post.id, currentUser.id).then(data => {
                setComments(data);
                setLoadingComments(false);
            });
        }
    }, [showComments, post.id, currentUser.id]);

    const handleLike = useCallback(async () => {
        const oldState = liked;
        setLiked(!liked);
        setLikesCount(prev => !liked ? prev + 1 : prev - 1);
        if (!liked) {
            setAnimateLike(true);
            setTimeout(() => setAnimateLike(false), 500);
        }
        
        const success = await togglePostLike(post.id, currentUser.id);
        if(!success) {
            setLiked(oldState);
            setLikesCount(prev => oldState ? prev + 1 : prev - 1);
        }
    }, [liked, post.id, currentUser.id]);

    const handleComment = async () => {
        if(!newComment.trim()) return;
        
        const tempId = 'temp-' + Date.now();
        const optimisticComment: PostComment = {
            id: tempId, post_id: post.id, user: currentUser, user_id: currentUser.id, content: newComment, created_at: new Date().toISOString(), likes_count: 0, liked_by_me: false
        };
        
        setComments(prev => [...prev, optimisticComment]);
        setCommentsCount(prev => prev + 1);
        setNewComment('');
        setMentionSuggestions([]);

        const realComment = await addPostComment(post.id, currentUser.id, optimisticComment.content);
        if (realComment) setComments(prev => prev.map(c => c.id === tempId ? realComment : c));
        else { setComments(prev => prev.filter(c => c.id !== tempId)); setCommentsCount(prev => prev - 1); }
    };

    const handleDeletePost = async () => {
        if(confirm("Excluir esta publicação permanentemente?")) {
            setIsDeleting(true);
            if(onDelete) onDelete(post.id); 
            
            const result = await deletePost(post.id);
            if(!result.success) {
                alert(`Erro ao excluir: ${result.error}`);
            }
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Apagar comentário?")) return;
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentsCount(prev => prev - 1);
        await deletePostComment(commentId);
    };

    const handleLikeComment = async (commentId: string, isLiked: boolean) => {
        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                return { ...c, liked_by_me: !isLiked, likes_count: isLiked ? c.likes_count - 1 : c.likes_count + 1 };
            }
            return c;
        }));
        await toggleCommentLike(commentId, currentUser.id);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewComment(val);
        
        const words = val.split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord.startsWith('@') && lastWord.length > 1) {
            const query = lastWord.substring(1);
            setMentionQuery(query);
            searchUsers(query, currentUser.id).then(res => setMentionSuggestions(res));
        } else {
            setMentionSuggestions([]);
        }
    };

    const insertMention = (username: string) => {
        const words = newComment.split(' ');
        words.pop(); 
        setNewComment(words.join(' ') + ` @${username} `);
        setMentionSuggestions([]);
    };

    return (
        <>
            {fullScreenImage && <ImageViewer src={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
            
            <div className={`bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm rounded-[24px] overflow-hidden mb-6 shadow-sm transition-all hover:border-zinc-700/80 hover:bg-zinc-900/80 hover:shadow-lg ${isDeleting ? 'opacity-0 scale-95 duration-500' : 'opacity-100 scale-100'}`}>
                {/* Header */}
                <div className="p-4 pl-5 flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onProfileClick(post.user.id)}>
                        <div className="relative">
                            <img src={post.user.avatar_url} className="w-10 h-10 rounded-full border border-zinc-800 object-cover group-hover:border-brand-primary/50 transition-colors" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-zinc-100 font-bold text-sm leading-none group-hover:underline decoration-zinc-600 tracking-tight">{formatDisplayName(post.user.name)}</span>
                            <span className="text-zinc-500 text-[10px] mt-1 font-mono">@{post.user.username} • {new Date(post.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                        </div>
                    </div>
                    {isOwner && (
                        <button onClick={handleDeletePost} disabled={isDeleting} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                            {isDeleting ? <Loader2 size={14} className="animate-spin text-red-500"/> : <Trash2 size={16} />}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                    <RichText 
                        content={post.content} 
                        onMentionClick={onMentionClick}
                        className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed tracking-wide font-light"
                    />
                </div>

                {/* Media */}
                {post.media_url && (
                    <div className="w-full bg-black border-y border-zinc-800/50 relative">
                        {post.media_type === 'video' ? (
                            <VideoPlayer src={post.media_url} className="w-full aspect-video" />
                        ) : post.media_type === 'audio' ? (
                            <div className="p-4 bg-zinc-950/50">
                                <AudioPlayer src={post.media_url} />
                            </div>
                        ) : (
                            <div className="relative group cursor-pointer overflow-hidden" onClick={() => setFullScreenImage(post.media_url!)}>
                                <img src={post.media_url} className="w-full h-auto object-cover max-h-[500px] transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={32}/>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions Bar */}
                <div className="px-5 py-3 flex items-center justify-between border-t border-white/5 bg-zinc-950/20">
                    <div className="flex items-center gap-6">
                        <button onClick={handleLike} className="flex items-center gap-2 group p-1 -ml-1 hover:bg-zinc-800/50 rounded-lg px-2 transition-colors relative">
                            <Heart size={20} className={`transition-transform duration-300 ${liked ? 'fill-brand-primary text-brand-primary' : 'text-zinc-500 group-hover:text-zinc-300'} ${animateLike ? 'scale-150' : 'scale-100'}`} />
                            {animateLike && <div className="absolute inset-0 animate-ping rounded-full bg-brand-primary/20"></div>}
                            <span className={`text-sm font-medium ${liked ? 'text-brand-primary' : 'text-zinc-500'}`}>{likesCount}</span>
                        </button>
                        
                        {post.allow_comments && (
                            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 group p-1 hover:bg-zinc-800/50 rounded-lg px-2 transition-colors">
                                <MessageCircle size={20} className={`text-zinc-500 group-hover:text-zinc-300 transition-colors ${showComments ? 'text-zinc-100' : ''}`} />
                                <span className={`text-sm font-medium ${showComments ? 'text-zinc-200' : 'text-zinc-500'}`}>{commentsCount}</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-zinc-600 px-2">
                        <Eye size={16} />
                        <span className="text-xs font-mono">{post.views_count || 0}</span>
                    </div>
                </div>

                {/* Comments Section */}
                {showComments && post.allow_comments && (
                    <div className="bg-zinc-950/30 border-t border-zinc-800/50 animate-fade-in">
                        <div className="px-5 pt-4 pb-4 space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                            {loadingComments ? (
                                <div className="text-center py-4 text-zinc-600 text-xs">Carregando rastro...</div>
                            ) : comments.length === 0 ? (
                                <div className="text-center py-6 text-zinc-600 text-xs italic">Seja o primeiro a marcar presença.</div>
                            ) : (
                                comments.map(c => (
                                    <div key={c.id} className="flex gap-3 group">
                                        <img src={c.user.avatar_url} className="w-8 h-8 rounded-full object-cover mt-1 cursor-pointer hover:border-brand-primary border border-transparent transition-colors" onClick={() => onProfileClick(c.user.id)}/>
                                        <div className="flex-1">
                                            <div className="flex items-baseline justify-between">
                                                <div className="bg-zinc-900/80 rounded-2xl rounded-tl-none px-3 py-2 border border-zinc-800 inline-block min-w-[120px]">
                                                    <span className="text-xs font-bold text-zinc-300 block mb-0.5 cursor-pointer hover:underline decoration-zinc-600" onClick={() => onProfileClick(c.user.id)}>{formatDisplayName(c.user.name)}</span>
                                                    <RichText 
                                                        content={c.content} 
                                                        onMentionClick={onMentionClick}
                                                        className="text-sm text-zinc-400 leading-snug"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-center ml-2">
                                                     <button onClick={() => handleLikeComment(c.id, !!c.liked_by_me)} className="p-1">
                                                         <Heart size={12} className={`${c.liked_by_me ? 'fill-brand-primary text-brand-primary' : 'text-zinc-600 hover:text-zinc-400'}`}/>
                                                     </button>
                                                     {c.likes_count > 0 && <span className="text-[9px] text-zinc-600">{c.likes_count}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 mt-1 pl-2">
                                                <button onClick={() => setNewComment(`@${c.user.username} `)} className="text-[10px] font-bold text-zinc-600 hover:text-brand-primary">Responder</button>
                                                {(c.user_id === currentUser.id || c.user.id === currentUser.id) && (
                                                    <button onClick={() => handleDeleteComment(c.id)} className="text-[10px] font-bold text-zinc-600 hover:text-red-500">Excluir</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {/* Mention Suggestions */}
                        {mentionSuggestions.length > 0 && (
                            <div className="px-5 pb-2">
                                 <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                                     {mentionSuggestions.map((s, i) => (
                                         <div key={i} onClick={() => insertMention(s.user.username)} className="px-3 py-2 hover:bg-zinc-800 cursor-pointer flex items-center gap-2">
                                             <img src={s.user.avatar_url} className="w-6 h-6 rounded-full"/>
                                             <span className="text-xs text-white font-bold">{s.user.username}</span>
                                         </div>
                                     ))}
                                 </div>
                            </div>
                        )}

                        <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 flex items-center gap-3 backdrop-blur-md">
                            <img src={currentUser.avatar_url} className="w-8 h-8 rounded-full object-cover border border-zinc-700" />
                            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-2 flex items-center focus-within:border-brand-primary/50 transition-colors">
                                <input 
                                    value={newComment}
                                    onChange={handleInputChange}
                                    placeholder={`Comentar...`} 
                                    className="bg-transparent text-sm text-zinc-200 w-full outline-none placeholder-zinc-600"
                                    onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                                />
                                <button onClick={handleComment} disabled={!newComment.trim()} className="text-brand-primary disabled:opacity-30 hover:scale-110 transition-transform p-1">
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
});

export default PostCard;
