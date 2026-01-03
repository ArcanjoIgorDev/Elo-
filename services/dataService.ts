
import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts, Notification, MessageType, ActivityPoint, Post } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- CACHE SYSTEM ---
const CACHE_TTL = 30000; 
const CACHE = {
    pulses: { data: [] as Pulse[], lastFetch: 0 },
    chats: { data: [] as ChatSummary[], lastFetch: 0 },
    notifications: { data: [] as Notification[], lastFetch: 0 },
    friendsLocations: { data: [] as User[], lastFetch: 0 },
    feed: { data: [] as Post[], lastFetch: 0 }
};

const isCacheValid = (key: keyof typeof CACHE) => {
    return (Date.now() - CACHE[key].lastFetch) < CACHE_TTL;
};

// --- HELPER: Upload to Storage ---
export const uploadMedia = async (file: File, bucket: 'media' = 'media'): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading media:', error);
        return null;
    }
};

// --- HELPER: Gera ID único para conversa ---
export const getChatId = (userA: string, userB: string) => {
    const ids = [userA, userB].sort();
    return `${ids[0]}_${ids[1]}`;
};

// --- HELPER: Distância Haversine (Km) ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return Math.round(d * 10) / 10; 
};

// --- SERVICES ---

// --- FEED (POSTS) ---
export const fetchFeed = async (currentUserId: string, forceRefresh = false): Promise<Post[]> => {
    if (!forceRefresh && isCacheValid('feed')) return CACHE.feed.data;

    try {
        // Busca posts ordenados por engagement (likes + comments)
        // O algoritmo "real" seria feito no backend, aqui simulamos ordenando pelo score
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                user:users_meta(*)
            `)
            .order('engagement_score', { ascending: false }) // Algoritmo: Mais engajados primeiro
            .order('created_at', { ascending: false }) // Desempate por data
            .limit(50);

        if (error) throw error;

        // Verifica se eu dei like
        const posts = await Promise.all(data.map(async (p: any) => {
            const { data: like } = await supabase
                .from('post_likes')
                .select('id')
                .eq('post_id', p.id)
                .eq('user_id', currentUserId)
                .single();
            
            return {
                ...p,
                user: {
                    id: p.user.user_id,
                    name: p.user.name,
                    username: p.user.username,
                    avatar_url: p.user.avatar_url
                },
                liked_by_me: !!like
            } as Post;
        }));

        CACHE.feed = { data: posts, lastFetch: Date.now() };
        return posts;
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const createPost = async (userId: string, content: string, mediaFile?: File, allowComments = true): Promise<boolean> => {
    try {
        let mediaUrl = null;
        let mediaType = null;

        if (mediaFile) {
            mediaUrl = await uploadMedia(mediaFile);
            mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
        }

        const { error } = await supabase.from('posts').insert({
            user_id: userId,
            content,
            media_url: mediaUrl,
            media_type: mediaType,
            allow_comments: allowComments
        });

        if (error) throw error;
        CACHE.feed.lastFetch = 0; // Invalida cache
        return true;
    } catch (e) {
        return false;
    }
};

export const deletePost = async (postId: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) throw error;
        CACHE.feed.lastFetch = 0;
        return true;
    } catch(e) { return false; }
};

export const togglePostLike = async (postId: string, userId: string): Promise<boolean> => {
    try {
        const { data: existing } = await supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).single();
        
        if (existing) {
            await supabase.from('post_likes').delete().eq('id', existing.id);
        } else {
            await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
        }
        return true;
    } catch (e) { return false; }
};

export const addPostComment = async (postId: string, userId: string, content: string): Promise<boolean> => {
    try {
        await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, content });
        return true;
    } catch (e) { return false; }
};

// --- VIBES (PULSES) 24h ---
export const fetchPulses = async (forceRefresh = false): Promise<Pulse[]> => {
  if (!forceRefresh && isCacheValid('pulses')) return CACHE.pulses.data;

  try {
    // Filtra apenas vibes das últimas 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pulses, error } = await supabase
      .from('pulsos')
      .select('*')
      .gt('created_at', oneDayAgo) // Algoritmo de expiração
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Otimização: Pegar IDs únicos e buscar users
    const userIds = [...new Set((pulses || []).map(p => p.user_id))];
    const { data: existingUsers } = await supabase
        .from('users_meta')
        .select('user_id')
        .in('user_id', userIds);
    
    const validUserIds = new Set(existingUsers?.map(u => u.user_id));
    const validPulses = (pulses || []).filter(p => validUserIds.has(p.user_id));

    CACHE.pulses = { data: validPulses as Pulse[], lastFetch: Date.now() };
    return validPulses as Pulse[];
  } catch (e: any) {
    return CACHE.pulses.data;
  }
};

export const createPulse = async (
    content: string, // Pode ser Texto ou URL
    userId: string, 
    userName: string, 
    userAvatar: string, 
    emotion: EmotionalState = 'neutro', 
    contentType: 'text' | 'image' | 'video' = 'text',
    description: string = '',
    mediaFile?: File
): Promise<Pulse | null> => {
    try {
        let finalContent = content;

        if (mediaFile) {
            const url = await uploadMedia(mediaFile);
            if (!url) throw new Error("Falha no upload");
            finalContent = url;
            contentType = mediaFile.type.startsWith('video') ? 'video' : 'image';
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const newPulse = {
            user_id: userId,
            user_name: userName,
            user_avatar: userAvatar || '',
            content: finalContent,
            content_type: contentType,
            emotional_state: emotion,
            description: description,
            created_at: new Date().toISOString(),
            expires_at: expiresAt
        };

        const { data, error } = await supabase.from('pulsos').insert([newPulse]).select().single();
        if (error) throw error;
        
        CACHE.pulses.lastFetch = 0;
        return data as Pulse;
    } catch (e) { return null; }
};

export const deletePulse = async (pulseId: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('pulsos').delete().eq('id', pulseId);
        if (error) throw error;
        CACHE.pulses.lastFetch = 0; 
        return true;
    } catch (e) { return false; }
};

// --- CHAT ---
export const fetchUserChats = async (currentUserId: string, forceRefresh = false): Promise<ChatSummary[]> => {
    if (!forceRefresh && isCacheValid('chats')) return CACHE.chats.data;
    // ... (mesma lógica de antes, mantida para brevidade)
    try {
        const [friendshipsA, friendshipsB] = await Promise.all([
             supabase.from('friendships').select('friend_id').eq('user_id', currentUserId).eq('status', 'accepted'),
             supabase.from('friendships').select('user_id').eq('friend_id', currentUserId).eq('status', 'accepted')
        ]);
        const friendIds: string[] = [];
        friendshipsA.data?.forEach((f: any) => friendIds.push(f.friend_id));
        friendshipsB.data?.forEach((f: any) => friendIds.push(f.user_id));
        if (friendIds.length === 0) { CACHE.chats = { data: [], lastFetch: Date.now() }; return []; }

        const [usersRes, msgsRes] = await Promise.all([
            supabase.from('users_meta').select('user_id, name, username, avatar_url').in('user_id', friendIds),
            supabase.from('messages').select('*').ilike('chat_id', `%${currentUserId}%`).order('created_at', { ascending: false }).limit(200)
        ]);
        
        const friendsMap = new Map<string, any>();
        usersRes.data?.forEach((u: any) => friendsMap.set(u.user_id, u));

        const messages = (msgsRes.data || []).map((m: any) => ({
            ...m,
            type: m.location ? 'location' : m.type || 'text'
        }));

        const chats: ChatSummary[] = [];
        const processedFriendIds = new Set<string>();
        const chatsWithUnread: { [chatId: string]: number } = {};

        messages.forEach((m: any) => {
             if (!m.is_read && m.sender_id !== currentUserId) {
                 chatsWithUnread[m.chat_id] = (chatsWithUnread[m.chat_id] || 0) + 1;
             }
        });

        for (const msg of messages) {
            const ids = msg.chat_id.split('_');
            const otherId = ids.find((id: string) => id !== currentUserId);

            if (otherId && !processedFriendIds.has(otherId) && friendsMap.has(otherId)) {
                processedFriendIds.add(otherId);
                const friend = friendsMap.get(otherId);

                chats.push({
                    chatId: msg.chat_id,
                    otherUser: {
                        id: friend.user_id,
                        name: friend.name,
                        username: friend.username,
                        avatar_url: friend.avatar_url,
                        is_deleted: false
                    },
                    lastMessage: msg,
                    unreadCount: chatsWithUnread[msg.chat_id] || 0,
                    isNewConnection: false
                });
            }
        }
        
        // Add empty chats for friends
        for (const friendId of friendIds) {
            if (!processedFriendIds.has(friendId)) {
                const friend = friendsMap.get(friendId);
                if (friend) {
                     chats.push({
                        chatId: getChatId(currentUserId, friendId),
                        otherUser: {
                            id: friend.user_id,
                            name: friend.name,
                            username: friend.username,
                            avatar_url: friend.avatar_url,
                            is_deleted: false
                        },
                        unreadCount: 0,
                        isNewConnection: true
                    });
                }
            }
        }
        CACHE.chats = { data: chats, lastFetch: Date.now() };
        return chats;
    } catch (e) { return CACHE.chats.data; }
};

export const sendMessage = async (
    content: string, 
    chatId: string, 
    userId: string, 
    type: MessageType = 'text', 
    location?: {lat: number, lng: number},
    mediaFile?: File
): Promise<Message | null> => {
    try {
        let mediaUrl = undefined;
        let finalContent = content;

        if (mediaFile) {
            const url = await uploadMedia(mediaFile);
            if (!url) throw new Error("Upload failed");
            mediaUrl = url;
            finalContent = mediaFile.type.startsWith('video') ? 'video' : 'image'; 
            // Para manter compatibilidade com clients antigos que leem content como URL
            if (type === 'image' || type === 'video') {
                finalContent = url; 
            }
        }

        const newMessage = {
            content: finalContent,
            sender_id: String(userId),
            chat_id: chatId,
            created_at: new Date().toISOString(),
            is_read: false,
            location: location || null,
            type: type,
            media_url: mediaUrl 
        };

        const { data, error } = await supabase.from('messages').insert([newMessage]).select().single();
        if (error) throw error;
        
        CACHE.chats.lastFetch = 0; 
        return { ...data } as Message;
    } catch (e) { return null; }
};

export const fetchMessages = async (chatId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return data as Message[];
  } catch (e) { return []; }
};

// ... (Outras funções auxiliares como fetchUserResonance, searchUsers, etc mantidas do original)
// Para economizar tokens, assumo que as outras funções não mudaram drasticamente além do que foi solicitado.
// Elas devem ser incluídas aqui se o arquivo for substituído por completo.

// --- REACTION SERVICES ---
export const getPulseReactions = async (pulseId: string, currentUserId: string): Promise<{counts: PulseReactionCounts, userReaction: ReactionType | null}> => {
    try {
        const { data, error } = await supabase.from('pulse_reactions').select('user_id, reaction_type').eq('pulse_id', pulseId);
        if (error) throw error;
        const counts = { heart: 0, fire: 0 };
        let userReaction: ReactionType | null = null;
        data.forEach((r: any) => {
            if (r.reaction_type === 'heart') counts.heart++;
            if (r.reaction_type === 'fire') counts.fire++;
            if (r.user_id === currentUserId) userReaction = r.reaction_type as ReactionType;
        });
        return { counts, userReaction };
    } catch (e) { return { counts: { heart: 0, fire: 0 }, userReaction: null }; }
};
export const togglePulseReaction = async (pulseId: string, userId: string, type: ReactionType): Promise<boolean> => {
    try {
        const { data: existing } = await supabase.from('pulse_reactions').select('id, reaction_type').eq('pulse_id', pulseId).eq('user_id', userId).single();
        if (existing) {
            if (existing.reaction_type === type) await supabase.from('pulse_reactions').delete().eq('id', existing.id);
            else await supabase.from('pulse_reactions').update({ reaction_type: type }).eq('id', existing.id);
        } else await supabase.from('pulse_reactions').insert({ pulse_id: pulseId, user_id: userId, reaction_type: type });
        return true;
    } catch (e) { return false; }
};
// --- FRIENDS & NOTIFICATIONS ---
export const fetchFriendsLocations = async (currentUserId: string, forceRefresh = false): Promise<User[]> => {
    if (!forceRefresh && isCacheValid('friendsLocations')) return CACHE.friendsLocations.data;
    try {
        const [resA, resB] = await Promise.all([
             supabase.from('friendships').select('friend_id').eq('user_id', currentUserId).eq('status', 'accepted'),
             supabase.from('friendships').select('user_id').eq('friend_id', currentUserId).eq('status', 'accepted')
        ]);
        const friendIds = new Set<string>();
        resA.data?.forEach((f: any) => friendIds.add(f.friend_id));
        resB.data?.forEach((f: any) => friendIds.add(f.user_id));
        if (friendIds.size === 0) { CACHE.friendsLocations = { data: [], lastFetch: Date.now() }; return []; }
        const { data: users } = await supabase.from('users_meta').select('user_id, name, username, avatar_url, city, latitude, longitude').in('user_id', Array.from(friendIds)).not('latitude', 'is', null).not('longitude', 'is', null); 
        const result = (users || []).map((u: any) => ({ id: u.user_id, email: '', name: u.name, username: u.username, avatar_url: u.avatar_url, city: u.city, latitude: u.latitude, longitude: u.longitude }));
        CACHE.friendsLocations = { data: result, lastFetch: Date.now() };
        return result;
    } catch (e) { return CACHE.friendsLocations.data; }
};
export const searchUsers = async (query: string, currentUserId: string): Promise<{user: User, friendshipStatus: string | null}[]> => {
    if (!query || query.length < 3) return [];
    try {
        const { data: users, error } = await supabase.from('users_meta').select('*').neq('user_id', currentUserId).ilike('username', `%${query}%`).limit(10);
        if (error) throw error;
        const results = await Promise.all(users.map(async (u: any) => {
            const { data: friendship } = await supabase.from('friendships').select('status, blocked_by').or(`and(user_id.eq.${currentUserId},friend_id.eq.${u.user_id}),and(user_id.eq.${u.user_id},friend_id.eq.${currentUserId})`).single();
            let status = null;
            if (friendship) { if (friendship.status === 'blocked' && friendship.blocked_by === u.user_id) return null; status = friendship.status; if (status === 'rejected') status = null; }
            return { user: { id: u.user_id, email: '', name: u.name, username: u.username, avatar_url: u.avatar_url, bio: u.bio, city: u.city, education: u.education }, friendshipStatus: status };
        }));
        return results.filter(r => r !== null) as any;
    } catch (e) { return []; }
};
export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => { try { const { data: existing } = await supabase.from('friendships').select('*').or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`).single(); if (existing) { if (existing.status === 'rejected') { await supabase.from('friendships').update({ status: 'pending', user_id: currentUserId, friend_id: targetUserId, blocked_by: null }).eq('id', existing.id); return true; } return true; } await supabase.from('friendships').insert([{ user_id: currentUserId, friend_id: targetUserId, status: 'pending', created_at: new Date().toISOString() }]); return true; } catch(e) { return false; } };
export const fetchNotifications = async (currentUserId: string, forceRefresh = false): Promise<Notification[]> => { if (!forceRefresh && isCacheValid('notifications')) return CACHE.notifications.data; try { const [incoming, updates] = await Promise.all([ supabase.from('friendships').select('id, user_id, friend_id, status, created_at').eq('friend_id', currentUserId).eq('status', 'pending'), supabase.from('friendships').select('id, user_id, friend_id, status, created_at').eq('user_id', currentUserId).in('status', ['accepted', 'rejected']) ]); const requests = [...(incoming.data || []), ...(updates.data || [])]; requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); if (requests.length === 0) { CACHE.notifications = { data: [], lastFetch: Date.now() }; return []; } const involvedUserIds = new Set(requests.map(r => r.friend_id === currentUserId ? r.user_id : r.friend_id)); const { data: users } = await supabase.from('users_meta').select('*').in('user_id', Array.from(involvedUserIds)); const userMap = new Map<string, any>(users?.map((u:any) => [u.user_id, u]) || []); const notifications: Notification[] = []; for (const req of requests) { const isIncoming = req.friend_id === currentUserId && req.status === 'pending'; const otherUserId = isIncoming ? req.user_id : req.friend_id; const u = userMap.get(otherUserId); if (!u) continue; let type: any = null; if (isIncoming) type = 'FRIEND_REQUEST'; else if (req.status === 'accepted') type = 'REQUEST_ACCEPTED'; else if (req.status === 'rejected') type = 'REQUEST_REJECTED'; if (type) { notifications.push({ id: req.id, type: type, user: { id: u.user_id, name: u.name, username: u.username, avatar_url: u.avatar_url, email: '' }, timestamp: req.created_at, read: false }); } } CACHE.notifications = { data: notifications, lastFetch: Date.now() }; return notifications; } catch (e) { return CACHE.notifications.data; } };
export const clearNotification = async (notificationId: string, type: string) => { try { if (type === 'REQUEST_REJECTED') await supabase.from('friendships').delete().eq('id', notificationId); CACHE.notifications.lastFetch = 0; return true; } catch (e) { return false; } }
export const respondToFriendRequest = async (requestId: string, accept: boolean) => { try { const status = accept ? 'accepted' : 'rejected'; await supabase.from('friendships').update({ status }).eq('id', requestId); CACHE.notifications.lastFetch = 0; CACHE.chats.lastFetch = 0; return true; } catch (e) { return false; } };
export const getUserProfile = async (userId: string, currentUserId: string): Promise<{user: User, friendship: any} | null> => { try { const { data: userData, error } = await supabase.from('users_meta').select('*').eq('user_id', userId).single(); if (error || !userData) return null; const { data: friendship } = await supabase.from('friendships').select('*').or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`).single(); return { user: { id: userData.user_id, email: '', name: userData.name, username: userData.username, avatar_url: userData.avatar_url, bio: userData.bio, city: userData.city, education: userData.education, latitude: userData.latitude, longitude: userData.longitude }, friendship: friendship }; } catch (e) { return null; } };
export const markMessagesAsRead = async (chatId: string, userId: string) => { try { await supabase.from('messages').update({ is_read: true }).eq('chat_id', chatId).neq('sender_id', userId).eq('is_read', false); } catch (e) { console.error("Erro ao marcar lido", e); } };
export const checkUsernameAvailable = async (username: string): Promise<boolean> => { if (!username) return false; try { const { data } = await supabase.from('users_meta').select('username').eq('username', username).single(); return !data; } catch (e) { return true; } };
export const checkPhoneAvailable = async (phone: string): Promise<boolean> => { if (!phone) return false; try { const { data } = await supabase.from('users_meta').select('phone').eq('phone', phone).single(); return !data; } catch (e) { return true; } };
export const fetchEcoData = async (): Promise<EcoData> => { return { totalMarks: 0, engagementScore: 0, pulseViews: [] }; };
export const fetchUserResonance = async (userId: string): Promise<ActivityPoint[]> => { return []; };
export const getFriendsCount = async (userId: string): Promise<number> => { try { const [resA, resB] = await Promise.all([ supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'), supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', userId).eq('status', 'accepted') ]); return (resA.count || 0) + (resB.count || 0); } catch (e) { return 0; } }
export const updateUserProfileMeta = async (userId: string, updates: Partial<User>): Promise<boolean> => { try { const payload: any = { ...updates }; if (updates.latitude || updates.longitude) payload.location_updated_at = new Date().toISOString(); const { error } = await supabase.from('users_meta').update(payload).eq('user_id', userId); if (error) throw error; return true; } catch (e) { return false; } };
