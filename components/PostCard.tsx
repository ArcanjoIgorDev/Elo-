
import React, { useState, useEffect, useCallback } from 'react';
import { Post, User, PostComment } from '../types';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { togglePostLike, addPostComment, deletePost, fetchPostComments, deletePostComment, toggleCommentLike, searchUsers } from '../services/dataService';
import RichText from './RichText';

interface PostCardProps {
    post: Post;
    currentUser: User;
    onDelete?: (postId: string) => void;
    onProfileClick: (userId: string) => void;
    onMentionClick: (username: string) => void; // New prop for mention navigation
}

const PostCard: React.FC<PostCardProps> = React.memo(({ post, currentUser, onDelete, onProfileClick, onMentionClick }) => {
    const [liked, setLiked] = useState(post.liked_by_me);
    const [likesCount, setLikesCount] = useState(post.likes_count);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentsCount, setCommentsCount] = useState(post.comments_count);
    const [loadingComments, setLoadingComments] = useState(false);
    
    // Mention Suggestion State
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);

    const isOwner = post.user.id === currentUser.id;

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
            id: tempId, post_id: post.id, user: currentUser, content: newComment, created_at: new Date().toISOString(), likes_count: 0, liked_by_me: false
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
            const success = await deletePost(post.id);
            if(success && onDelete) onDelete(post.id);
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
        
        // Simple mention detection: last word starts with @
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
        words.pop(); // Remove partial mention
        setNewComment(words.join(' ') + ` @${username} `);
        setMentionSuggestions([]);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-3xl overflow-hidden mb-6 shadow-sm">
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onProfileClick(post.user.id)}>
                    <img src={post.user.avatar_url} className="w-10 h-10 rounded-full border border-zinc-800 object-cover" />
                    <div className="flex flex-col">
                        <span className="text-zinc-100 font-bold text-sm leading-none">{post.user.name}</span>
                        <span className="text-zinc-500 text-xs mt-0.5">@{post.user.username}</span>
                    </div>
                </div>
                {isOwner && (
                    <button onClick={handleDeletePost} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="px-5 pb-3">
                <RichText 
                    content={post.content} 
                    onMentionClick={onMentionClick}
                    className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed tracking-wide"
                />
            </div>

            {/* Media */}
            {post.media_url && (
                <div className="w-full bg-black">
                    {post.media_type === 'video' ? (
                        <VideoPlayer src={post.media_url} className="w-full aspect-video" />
                    ) : (
                        <img src={post.media_url} className="w-full h-auto object-cover max-h-[500px]" loading="lazy" />
                    )}
                </div>
            )}

            {/* Actions Bar */}
            <div className="px-5 py-3 flex items-center justify-between border-t border-white/5 bg-zinc-950/20">
                <div className="flex items-center gap-6">
                    <button onClick={handleLike} className="flex items-center gap-2 group p-1 -ml-1">
                        <div className={`p-1.5 rounded-full transition-colors ${liked ? 'bg-red-500/10' : 'group-hover:bg-zinc-800'}`}>
                             <Heart size={20} className={`transition-transform duration-300 ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-400 group-hover:scale-110'}`} />
                        </div>
                        <span className={`text-sm font-medium ${liked ? 'text-red-500' : 'text-zinc-500'}`}>{likesCount}</span>
                    </button>
                    
                    {post.allow_comments && (
                        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 group p-1">
                            <div className="p-1.5 rounded-full group-hover:bg-zinc-800 transition-colors">
                                <MessageCircle size={20} className={`text-zinc-400 group-hover:text-zinc-200 transition-colors ${showComments ? 'text-zinc-100' : ''}`} />
                            </div>
                            <span className={`text-sm font-medium ${showComments ? 'text-zinc-200' : 'text-zinc-500'}`}>{commentsCount}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Comments Section */}
            {showComments && post.allow_comments && (
                <div className="bg-zinc-950/50 border-t border-zinc-800/50">
                    <div className="px-5 pt-4 pb-4 space-y-5">
                        {loadingComments ? (
                            <div className="text-center py-4 text-zinc-600 text-xs">Carregando comentários...</div>
                        ) : comments.length === 0 ? (
                            <div className="text-center py-6 text-zinc-600 text-xs italic">Seja o primeiro a comentar.</div>
                        ) : (
                            comments.map(c => (
                                <div key={c.id} className="flex gap-3 group animate-fade-in">
                                    <img src={c.user.avatar_url} className="w-8 h-8 rounded-full object-cover mt-1 cursor-pointer" onClick={() => onProfileClick(c.user.id)}/>
                                    <div className="flex-1">
                                        <div className="flex items-baseline justify-between">
                                            <div className="bg-zinc-900 rounded-2xl px-3 py-2 border border-zinc-800 inline-block min-w-[120px]">
                                                <span className="text-xs font-bold text-zinc-200 block mb-0.5 cursor-pointer hover:underline" onClick={() => onProfileClick(c.user.id)}>{c.user.username}</span>
                                                <RichText 
                                                    content={c.content} 
                                                    onMentionClick={onMentionClick}
                                                    className="text-sm text-zinc-300 leading-snug"
                                                />
                                            </div>
                                            <div className="flex flex-col items-center ml-2">
                                                 <button onClick={() => handleLikeComment(c.id, !!c.liked_by_me)} className="p-1">
                                                     <Heart size={14} className={`${c.liked_by_me ? 'fill-red-500 text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}/>
                                                 </button>
                                                 {c.likes_count > 0 && <span className="text-[9px] text-zinc-500">{c.likes_count}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mt-1 pl-2">
                                            <button onClick={() => setNewComment(`@${c.user.username} `)} className="text-[10px] font-bold text-zinc-500 hover:text-brand-primary">Responder</button>
                                            {c.user.id === currentUser.id && (
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

                    <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-3">
                        <img src={currentUser.avatar_url} className="w-8 h-8 rounded-full object-cover" />
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
    );
});

export default PostCard;
