
import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts, Notification, MessageType, ActivityPoint } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- CACHE SYSTEM ---
const CACHE_TTL = 30000; // 30 segundos de cache
const CACHE = {
    pulses: { data: [] as Pulse[], lastFetch: 0 },
    chats: { data: [] as ChatSummary[], lastFetch: 0 },
    notifications: { data: [] as Notification[], lastFetch: 0 },
    friendsLocations: { data: [] as User[], lastFetch: 0 }
};

const isCacheValid = (key: keyof typeof CACHE) => {
    return (Date.now() - CACHE[key].lastFetch) < CACHE_TTL;
};

// --- HELPER: Gera ID único para conversa entre dois usuários ---
export const getChatId = (userA: string, userB: string) => {
    const ids = [userA, userB].sort();
    return `${ids[0]}_${ids[1]}`;
};

// --- HELPER: Distância Haversine (Km) ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return Math.round(d * 10) / 10; // Retorna com 1 casa decimal
};

// --- SERVICES ---

// Calcula a Ressonância Real (Atividade nos últimos 7 dias)
export const fetchUserResonance = async (userId: string): Promise<ActivityPoint[]> => {
    try {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
        const isoDate = sevenDaysAgo.toISOString();

        // Promise.all para paralelizar as requisições
        const [messagesRes, pulsesRes] = await Promise.all([
            supabase
            .from('messages')
            .select('created_at')
            .eq('sender_id', userId)
            .gte('created_at', isoDate),

            supabase
            .from('pulsos')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', isoDate)
        ]);

        if (messagesRes.error || pulsesRes.error) return [];

        // Processamento otimizado com Map
        const activityMap = new Map<string, { messages: number, pulses: number }>();
        
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            activityMap.set(key, { messages: 0, pulses: 0 });
        }

        messagesRes.data?.forEach((m: any) => {
            const key = m.created_at.split('T')[0];
            if (activityMap.has(key)) activityMap.get(key)!.messages++;
        });

        pulsesRes.data?.forEach((p: any) => {
            const key = p.created_at.split('T')[0];
            if (activityMap.has(key)) activityMap.get(key)!.pulses++;
        });

        const result: ActivityPoint[] = Array.from(activityMap.entries())
            .map(([date, counts]) => {
                const dateObj = new Date(date);
                // Correção de timezone simplificada para visualização
                const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
                
                return {
                    date,
                    fullDate: dayName,
                    messages: counts.messages,
                    pulses: counts.pulses,
                    total: counts.messages + (counts.pulses * 5)
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return result;
    } catch (e) {
        console.error("Erro ao calcular ressonância:", e);
        return [];
    }
};

export const fetchDailyTopic = async (): Promise<Topic> => {
    const defaultTopic = { id: 'default', title: 'O que te fez sorrir hoje?' };
    // Cache simples em memória para o tópico (muda pouco)
    if ((window as any)._dailyTopicCache) return (window as any)._dailyTopicCache;

    try {
        const { data, error } = await supabase
            .from('daily_topics')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !data) return defaultTopic;
        (window as any)._dailyTopicCache = data;
        return data as Topic;
    } catch (e) {
        return defaultTopic;
    }
};

export const deleteMyAccount = async (): Promise<boolean> => {
    try {
        const { error } = await supabase.rpc('delete_own_account');
        if (error) throw error;
        return true;
    } catch (e: any) {
        console.error("Erro ao deletar conta:", e.message);
        return false;
    }
};

export const toggleBlockUser = async (friendshipId: string, block: boolean, currentUserId: string): Promise<boolean> => {
    try {
        const updateData = block 
            ? { status: 'blocked', blocked_by: currentUserId }
            : { status: 'accepted', blocked_by: null };

        const { error } = await supabase.from('friendships').update(updateData).eq('id', friendshipId);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
};

export const removeFriend = async (friendshipId: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
};

export const getFriendsCount = async (userId: string): Promise<number> => {
    try {
        // Otimização: Promise.all
        const [resA, resB] = await Promise.all([
            supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'),
            supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', userId).eq('status', 'accepted')
        ]);
        
        return (resA.count || 0) + (resB.count || 0);
    } catch (e) { return 0; }
}

export const updateUserProfileMeta = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    try {
        const payload: any = { ...updates };
        if (updates.latitude || updates.longitude) payload.location_updated_at = new Date().toISOString();

        const { error } = await supabase.from('users_meta').update(payload).eq('user_id', userId);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
};

// --- FETCH PULSES (Com Cache) ---
export const fetchPulses = async (forceRefresh = false): Promise<Pulse[]> => {
  if (!forceRefresh && isCacheValid('pulses')) return CACHE.pulses.data;

  try {
    const { data: pulses, error } = await supabase
      .from('pulsos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); // Limite para evitar payload gigante
      
    if (error) throw error;
    if (!pulses || pulses.length === 0) {
        CACHE.pulses = { data: [], lastFetch: Date.now() };
        return [];
    }

    // Otimização: Pegar IDs únicos e buscar users em uma query
    const userIds = [...new Set(pulses.map(p => p.user_id))];
    const { data: existingUsers } = await supabase
        .from('users_meta')
        .select('user_id')
        .in('user_id', userIds);
    
    const validUserIds = new Set(existingUsers?.map(u => u.user_id));
    const validPulses = pulses.filter(p => validUserIds.has(p.user_id));

    CACHE.pulses = { data: validPulses as Pulse[], lastFetch: Date.now() };
    return validPulses as Pulse[];
  } catch (e: any) {
    console.error('Erro ao buscar vibes:', e.message);
    return CACHE.pulses.data; // Retorna cache antigo em erro
  }
};

export const deletePulse = async (pulseId: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('pulsos').delete().eq('id', pulseId);
        if (error) throw error;
        // Invalida cache
        CACHE.pulses.lastFetch = 0; 
        return true;
    } catch (e) { return false; }
};

export const createPulse = async (content: string, userId: string, userName: string, userAvatar: string, emotion: EmotionalState = 'neutro', isImage: boolean = false, description: string = ''): Promise<Pulse | null> => {
    try {
        const newPulse = {
            user_id: userId,
            user_name: userName,
            user_avatar: userAvatar || '',
            content,
            content_type: isImage ? 'image' : 'text',
            emotional_state: emotion,
            description: description,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('pulsos').insert([newPulse]).select().single();
        if (error) throw error;
        
        // Invalida cache
        CACHE.pulses.lastFetch = 0;
        return data as Pulse;
    } catch (e) { return null; }
};

// --- REACTION SERVICES ---
export const getPulseReactions = async (pulseId: string, currentUserId: string): Promise<{counts: PulseReactionCounts, userReaction: ReactionType | null}> => {
    try {
        // Otimização: RPC call se possível, ou select count simples
        // Por enquanto mantemos query direta mas leve
        const { data, error } = await supabase
            .from('pulse_reactions')
            .select('user_id, reaction_type')
            .eq('pulse_id', pulseId);

        if (error) throw error;

        const counts = { heart: 0, fire: 0 };
        let userReaction: ReactionType | null = null;

        data.forEach((r: any) => {
            if (r.reaction_type === 'heart') counts.heart++;
            if (r.reaction_type === 'fire') counts.fire++;
            if (r.user_id === currentUserId) userReaction = r.reaction_type as ReactionType;
        });

        return { counts, userReaction };
    } catch (e) {
        return { counts: { heart: 0, fire: 0 }, userReaction: null };
    }
};

export const togglePulseReaction = async (pulseId: string, userId: string, type: ReactionType): Promise<boolean> => {
    try {
        const { data: existing } = await supabase.from('pulse_reactions').select('id, reaction_type').eq('pulse_id', pulseId).eq('user_id', userId).single();

        if (existing) {
            if (existing.reaction_type === type) {
                await supabase.from('pulse_reactions').delete().eq('id', existing.id);
            } else {
                await supabase.from('pulse_reactions').update({ reaction_type: type }).eq('id', existing.id);
            }
        } else {
            await supabase.from('pulse_reactions').insert({ pulse_id: pulseId, user_id: userId, reaction_type: type });
        }
        return true;
    } catch (e) { return false; }
};

// --- FRIENDS & LOCATIONS (Cacheado) ---
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

        if (friendIds.size === 0) {
             CACHE.friendsLocations = { data: [], lastFetch: Date.now() };
             return [];
        }

        const { data: users } = await supabase
            .from('users_meta')
            .select('user_id, name, username, avatar_url, city, latitude, longitude')
            .in('user_id', Array.from(friendIds))
            .not('latitude', 'is', null)
            .not('longitude', 'is', null); 

        const result = (users || []).map((u: any) => ({
            id: u.user_id,
            email: '',
            name: u.name,
            username: u.username,
            avatar_url: u.avatar_url,
            city: u.city,
            latitude: u.latitude,
            longitude: u.longitude
        }));

        CACHE.friendsLocations = { data: result, lastFetch: Date.now() };
        return result;

    } catch (e) { return CACHE.friendsLocations.data; }
};

// --- CHAT & FRIENDS FETCHING (Cacheado) ---
export const fetchUserChats = async (currentUserId: string, forceRefresh = false): Promise<ChatSummary[]> => {
    if (!forceRefresh && isCacheValid('chats')) return CACHE.chats.data;

    try {
        // 1. Busca amizades e IDs
        const [friendshipsA, friendshipsB] = await Promise.all([
             supabase.from('friendships').select('friend_id').eq('user_id', currentUserId).eq('status', 'accepted'),
             supabase.from('friendships').select('user_id').eq('friend_id', currentUserId).eq('status', 'accepted')
        ]);

        const friendIds: string[] = [];
        friendshipsA.data?.forEach((f: any) => friendIds.push(f.friend_id));
        friendshipsB.data?.forEach((f: any) => friendIds.push(f.user_id));

        if (friendIds.length === 0) {
            CACHE.chats = { data: [], lastFetch: Date.now() };
            return [];
        }

        // 2. Busca dados de usuários e mensagens em paralelo
        const [usersRes, msgsRes] = await Promise.all([
            supabase.from('users_meta').select('user_id, name, username, avatar_url').in('user_id', friendIds),
            supabase.from('messages').select('*').ilike('chat_id', `%${currentUserId}%`).order('created_at', { ascending: false }).limit(200) // Limite aumentado
        ]);
        
        const friendsMap = new Map<string, any>();
        usersRes.data?.forEach((u: any) => friendsMap.set(u.user_id, u));

        const messages = (msgsRes.data || []).map((m: any) => ({
            ...m,
            type: m.location ? 'location' : (m.content && m.content.startsWith('data:image') ? 'image' : 'text')
        }));

        const chats: ChatSummary[] = [];
        const processedFriendIds = new Set<string>();
        const chatsWithUnread: { [chatId: string]: number } = {};

        // Cálculo de unread local
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

    } catch (e) {
        console.error('Erro ao buscar chats:', e);
        return CACHE.chats.data;
    }
};

export const searchUsers = async (query: string, currentUserId: string): Promise<{user: User, friendshipStatus: string | null}[]> => {
    if (!query || query.length < 3) return [];
    try {
        const { data: users, error } = await supabase
            .from('users_meta')
            .select('*')
            .neq('user_id', currentUserId)
            .ilike('username', `%${query}%`)
            .limit(10); // Limite de busca

        if (error) throw error;
        
        const results = await Promise.all(users.map(async (u: any) => {
            // Verifica amizade individualmente (pode ser otimizado futuramente com join)
            const { data: friendship } = await supabase
                .from('friendships')
                .select('status, blocked_by')
                .or(`and(user_id.eq.${currentUserId},friend_id.eq.${u.user_id}),and(user_id.eq.${u.user_id},friend_id.eq.${currentUserId})`)
                .single();

            let status = null;
            if (friendship) {
                if (friendship.status === 'blocked' && friendship.blocked_by === u.user_id) return null;
                status = friendship.status;
                if (status === 'rejected') status = null; 
            }

            return {
                user: {
                    id: u.user_id,
                    email: '',
                    name: u.name,
                    username: u.username,
                    avatar_url: u.avatar_url,
                    bio: u.bio,
                    city: u.city,
                    education: u.education
                },
                friendshipStatus: status
            };
        }));

        return results.filter(r => r !== null) as any;
    } catch (e) { return []; }
};

export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => {
    try {
        const { data: existing } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`)
            .single();

        if (existing) {
            if (existing.status === 'rejected') {
                await supabase.from('friendships').update({ status: 'pending', user_id: currentUserId, friend_id: targetUserId, blocked_by: null }).eq('id', existing.id);
                return true;
            }
            return true; 
        }

        await supabase.from('friendships').insert([{ user_id: currentUserId, friend_id: targetUserId, status: 'pending', created_at: new Date().toISOString() }]);
        return true;
    } catch(e) { return false; }
};

export const fetchNotifications = async (currentUserId: string, forceRefresh = false): Promise<Notification[]> => {
    if (!forceRefresh && isCacheValid('notifications')) return CACHE.notifications.data;

    try {
        const [incoming, updates] = await Promise.all([
             supabase.from('friendships').select('id, user_id, friend_id, status, created_at').eq('friend_id', currentUserId).eq('status', 'pending'),
             supabase.from('friendships').select('id, user_id, friend_id, status, created_at').eq('user_id', currentUserId).in('status', ['accepted', 'rejected'])
        ]);

        const requests = [...(incoming.data || []), ...(updates.data || [])];
        requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (requests.length === 0) {
             CACHE.notifications = { data: [], lastFetch: Date.now() };
             return [];
        }

        const involvedUserIds = new Set(requests.map(r => r.friend_id === currentUserId ? r.user_id : r.friend_id));
        const { data: users } = await supabase.from('users_meta').select('*').in('user_id', Array.from(involvedUserIds));
        const userMap = new Map<string, any>(users?.map((u:any) => [u.user_id, u]) || []);

        const notifications: Notification[] = [];
        for (const req of requests) {
            const isIncoming = req.friend_id === currentUserId && req.status === 'pending';
            const otherUserId = isIncoming ? req.user_id : req.friend_id;
            const u = userMap.get(otherUserId);
            
            if (!u) continue; 

            let type: any = null;
            if (isIncoming) type = 'FRIEND_REQUEST';
            else if (req.status === 'accepted') type = 'REQUEST_ACCEPTED';
            else if (req.status === 'rejected') type = 'REQUEST_REJECTED';

            if (type) {
                notifications.push({
                    id: req.id,
                    type: type,
                    user: { id: u.user_id, name: u.name, username: u.username, avatar_url: u.avatar_url, email: '' },
                    timestamp: req.created_at,
                    read: false 
                });
            }
        }

        CACHE.notifications = { data: notifications, lastFetch: Date.now() };
        return notifications;
    } catch (e) { return CACHE.notifications.data; }
};

export const clearNotification = async (notificationId: string, type: string) => {
    try {
        if (type === 'REQUEST_REJECTED') {
            await supabase.from('friendships').delete().eq('id', notificationId);
        }
        // Invalida cache localmente para UI update imediato
        CACHE.notifications.lastFetch = 0;
        return true;
    } catch (e) { return false; }
}

export const fetchPendingRequests = async (currentUserId: string) => {
    const notifs = await fetchNotifications(currentUserId);
    return notifs.filter(n => n.type === 'FRIEND_REQUEST').map(n => ({ requestId: n.id, user: n.user }));
};

export const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    try {
        const status = accept ? 'accepted' : 'rejected';
        await supabase.from('friendships').update({ status }).eq('id', requestId);
        CACHE.notifications.lastFetch = 0; // Força refresh notifs
        CACHE.chats.lastFetch = 0; // Força refresh chats (se aceitou)
        return true;
    } catch (e) { return false; }
};

export const getUserProfile = async (userId: string, currentUserId: string): Promise<{user: User, friendship: any} | null> => {
    try {
        const { data: userData, error } = await supabase.from('users_meta').select('*').eq('user_id', userId).single();
        if (error || !userData) return null;

        const { data: friendship } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`)
            .single();

        return {
            user: {
                id: userData.user_id,
                email: '',
                name: userData.name,
                username: userData.username,
                avatar_url: userData.avatar_url,
                bio: userData.bio,
                city: userData.city,
                education: userData.education,
                latitude: userData.latitude,
                longitude: userData.longitude
            },
            friendship: friendship
        };
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
    return (data || []).map((m: any) => ({
        ...m,
        type: m.location ? 'location' : (m.content && m.content.startsWith('data:image') ? 'image' : 'text')
    })) as Message[];

  } catch (e) { return []; }
};

export const markMessagesAsRead = async (chatId: string, userId: string) => {
    try {
        await supabase.from('messages').update({ is_read: true }).eq('chat_id', chatId).neq('sender_id', userId).eq('is_read', false);
        // Otimização: Não precisamos esperar essa promise resolver para continuar a UI
    } catch (e) { console.error("Erro ao marcar lido", e); }
};

export const sendMessage = async (content: string, chatId: string, userId: string, type: MessageType = 'text', location?: {lat: number, lng: number}): Promise<Message | null> => {
    try {
        const newMessage = {
            content,
            sender_id: String(userId),
            chat_id: chatId,
            created_at: new Date().toISOString(),
            is_read: false,
            location: location || null,
        };

        const { data, error } = await supabase.from('messages').insert([newMessage]).select().single();
        if (error) throw error;
        
        CACHE.chats.lastFetch = 0; // Invalida lista de chats para atualizar last message
        return { ...data, type: type } as Message;
    } catch (e) { return null; }
};

// --- Checks ---
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    if (!username) return false;
    try {
        const { data } = await supabase.from('users_meta').select('username').eq('username', username).single();
        return !data; 
    } catch (e) { return true; }
};

export const checkPhoneAvailable = async (phone: string): Promise<boolean> => {
    if (!phone) return false;
    try {
        const { data } = await supabase.from('users_meta').select('phone').eq('phone', phone).single();
        return !data;
    } catch (e) { return true; }
};

export const fetchEcoData = async (): Promise<EcoData> => {
  return { totalMarks: 0, engagementScore: 0, pulseViews: [] };
};

export const searchContent = async (query: string): Promise<SearchResult[]> => { return []; };
