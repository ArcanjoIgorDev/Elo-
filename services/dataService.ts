
import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts, Notification, MessageType, ActivityPoint } from '../types';
import { supabase } from '../lib/supabaseClient';

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

        // 1. Buscar mensagens enviadas pelo usuário
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('created_at')
            .eq('sender_id', userId)
            .gte('created_at', isoDate);

        // 2. Buscar vibes (pulses) criadas pelo usuário
        const { data: pulses, error: pulseError } = await supabase
            .from('pulsos')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', isoDate);

        if (msgError || pulseError) return [];

        // 3. Processar e Agrupar por dia
        const activityMap = new Map<string, { messages: number, pulses: number }>();
        
        // Inicializa os últimos 7 dias com 0
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            activityMap.set(key, { messages: 0, pulses: 0 });
        }

        messages?.forEach((m: any) => {
            const key = m.created_at.split('T')[0];
            if (activityMap.has(key)) {
                const current = activityMap.get(key)!;
                current.messages++;
            }
        });

        pulses?.forEach((p: any) => {
            const key = p.created_at.split('T')[0];
            if (activityMap.has(key)) {
                const current = activityMap.get(key)!;
                current.pulses++;
            }
        });

        // 4. Converter para Array ordenado (Recharts friendly)
        const result: ActivityPoint[] = Array.from(activityMap.entries())
            .map(([date, counts]) => {
                const dateObj = new Date(date);
                const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
                
                return {
                    date,
                    fullDate: localDate.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
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
    try {
        const { data, error } = await supabase
            .from('daily_topics')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !data) return defaultTopic;
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

        const { error } = await supabase
            .from('friendships')
            .update(updateData)
            .eq('id', friendshipId);
            
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Erro ao bloquear:", e);
        return false;
    }
};

export const removeFriend = async (friendshipId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Erro ao remover amigo:", e);
        return false;
    }
};

export const getFriendsCount = async (userId: string): Promise<number> => {
    try {
        const { count: countA, error: errorA } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'accepted');

        const { count: countB, error: errorB } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('friend_id', userId)
            .eq('status', 'accepted');
        
        if (errorA || errorB) return 0;
        return (countA || 0) + (countB || 0);
    } catch (e) {
        return 0;
    }
}

// --- UPDATE PROFILE (Com novos campos) ---
export const updateUserProfileMeta = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    try {
        const payload: any = {};
        if (updates.bio !== undefined) payload.bio = updates.bio;
        if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
        if (updates.city !== undefined) payload.city = updates.city;
        if (updates.education !== undefined) payload.education = updates.education;
        if (updates.latitude !== undefined) payload.latitude = updates.latitude;
        if (updates.longitude !== undefined) payload.longitude = updates.longitude;
        if (updates.latitude || updates.longitude) payload.location_updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('users_meta')
            .update(payload)
            .eq('user_id', userId);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Erro ao atualizar perfil:", e);
        return false;
    }
};

// --- FETCH PULSES (Com filtro de usuários deletados) ---
export const fetchPulses = async (): Promise<Pulse[]> => {
  try {
    const { data: pulses, error } = await supabase
      .from('pulsos')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    if (!pulses || pulses.length === 0) return [];

    const userIds = [...new Set(pulses.map(p => p.user_id))];
    const { data: existingUsers } = await supabase
        .from('users_meta')
        .select('user_id')
        .in('user_id', userIds);
    
    const validUserIds = new Set(existingUsers?.map(u => u.user_id));
    const validPulses = pulses.filter(p => validUserIds.has(p.user_id));

    return validPulses as Pulse[];
  } catch (e: any) {
    console.error('Erro ao buscar vibes:', e.message);
    return [];
  }
};

export const deletePulse = async (pulseId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('pulsos')
            .delete()
            .eq('id', pulseId);
        
        if (error) throw error;
        return true;
    } catch (e: any) {
        console.error("Erro ao deletar vibe:", e.message);
        return false;
    }
};

export const createPulse = async (
    content: string, 
    userId: string, 
    userName: string, 
    userAvatar: string, 
    emotion: EmotionalState = 'neutro',
    isImage: boolean = false,
    description: string = ''
): Promise<Pulse | null> => {
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

        const { data, error } = await supabase
            .from('pulsos')
            .insert([newPulse])
            .select()
            .single();

        if (error) throw error;
        return data as Pulse;
    } catch (e: any) {
        console.error('Erro ao criar vibe:', e.message);
        return null;
    }
};

// --- REACTION SERVICES ---

export const getPulseReactions = async (pulseId: string, currentUserId: string): Promise<{counts: PulseReactionCounts, userReaction: ReactionType | null}> => {
    try {
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
        const { data: existing } = await supabase
            .from('pulse_reactions')
            .select('*')
            .eq('pulse_id', pulseId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            if (existing.reaction_type === type) {
                await supabase.from('pulse_reactions').delete().eq('id', existing.id);
            } else {
                await supabase.from('pulse_reactions').update({ reaction_type: type }).eq('id', existing.id);
            }
        } else {
            await supabase.from('pulse_reactions').insert({
                pulse_id: pulseId,
                user_id: userId,
                reaction_type: type
            });
        }
        return true;
    } catch (e) {
        console.error("Erro ao reagir:", e);
        return false;
    }
};

// --- FRIENDS & LOCATIONS ---
// NOVA FUNÇÃO: Busca apenas amigos que têm localização salva, com dados REAIS do banco.
export const fetchFriendsLocations = async (currentUserId: string): Promise<User[]> => {
    try {
        // 1. Pegar IDs dos amigos
        const { data: friendshipsA } = await supabase.from('friendships').select('friend_id').eq('user_id', currentUserId).eq('status', 'accepted');
        const { data: friendshipsB } = await supabase.from('friendships').select('user_id').eq('friend_id', currentUserId).eq('status', 'accepted');

        const friendIds = new Set<string>();
        friendshipsA?.forEach((f: any) => friendIds.add(f.friend_id));
        friendshipsB?.forEach((f: any) => friendIds.add(f.user_id));

        if (friendIds.size === 0) return [];

        // 2. Pegar dados dos amigos, INCLUINDO latitude/longitude
        const { data: users } = await supabase
            .from('users_meta')
            .select('*')
            .in('user_id', Array.from(friendIds))
            .not('latitude', 'is', null) // Só traz quem tem localização
            .not('longitude', 'is', null); 

        return (users || []).map((u: any) => ({
            id: u.user_id,
            email: '', // Não precisa expor
            name: u.name,
            username: u.username,
            avatar_url: u.avatar_url,
            city: u.city,
            latitude: u.latitude,
            longitude: u.longitude
        }));

    } catch (e: any) {
        console.error("Erro ao buscar localizações:", e.message);
        return [];
    }
};

// --- CHAT & FRIENDS FETCHING ---
export const fetchUserChats = async (currentUserId: string): Promise<ChatSummary[]> => {
    try {
        const { data: friendshipsA } = await supabase
            .from('friendships')
            .select('friend_id, created_at')
            .eq('user_id', currentUserId)
            .eq('status', 'accepted');
            
        const { data: friendshipsB } = await supabase
            .from('friendships')
            .select('user_id, created_at')
            .eq('friend_id', currentUserId)
            .eq('status', 'accepted');

        const friendIds: string[] = [];
        friendshipsA?.forEach((f: any) => friendIds.push(f.friend_id));
        friendshipsB?.forEach((f: any) => friendIds.push(f.user_id));

        if (friendIds.length === 0) return [];

        const { data: usersData } = await supabase
            .from('users_meta')
            .select('user_id, name, username, avatar_url')
            .in('user_id', friendIds);
        
        const friendsMap = new Map<string, any>();
        usersData?.forEach((u: any) => friendsMap.set(u.user_id, u));

        const { data: rawMessages } = await supabase
            .from('messages')
            .select('*')
            .ilike('chat_id', `%${currentUserId}%`)
            .order('created_at', { ascending: false });

        const messages = (rawMessages || []).map((m: any) => ({
            ...m,
            type: m.location ? 'location' : (m.content && m.content.startsWith('data:image') ? 'image' : 'text')
        }));

        const chats: ChatSummary[] = [];
        const processedFriendIds = new Set<string>();
        const chatsWithUnread: { [chatId: string]: number } = {};

        if (messages) {
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
        
        return chats;

    } catch (e: any) {
        console.error('Erro ao buscar chats:', e.message);
        return [];
    }
};

export const searchUsers = async (query: string, currentUserId: string): Promise<{user: User, friendshipStatus: string | null}[]> => {
    if (!query || query.length < 3) return [];
    
    try {
        // Busca agora inclui cidade e educação
        const { data: users, error } = await supabase
            .from('users_meta')
            .select('*')
            .neq('user_id', currentUserId)
            .ilike('username', `%${query}%`)
            .limit(10);

        if (error) throw error;
        
        const results = await Promise.all(users.map(async (u: any) => {
            const { data: friendshipA } = await supabase
                .from('friendships')
                .select('status, blocked_by')
                .eq('user_id', currentUserId)
                .eq('friend_id', u.user_id)
                .single();

            const { data: friendshipB } = await supabase
                .from('friendships')
                .select('status, blocked_by')
                .eq('user_id', u.user_id)
                .eq('friend_id', currentUserId)
                .single();

            const friendship = friendshipA || friendshipB;

            let status = null;
            if (friendship) {
                if (friendship.status === 'blocked' && friendship.blocked_by === u.user_id) {
                    return null;
                }
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
                    education: u.education,
                    phone: ''
                },
                friendshipStatus: status
            };
        }));

        return results.filter(r => r !== null) as {user: User, friendshipStatus: string | null}[];

    } catch (e: any) {
        console.error('Erro na busca de usuários:', e.message);
        return [];
    }
};

export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => {
    try {
        const { data: existingA } = await supabase.from('friendships')
            .select('*').eq('user_id', currentUserId).eq('friend_id', targetUserId).single();
            
        const { data: existingB } = await supabase.from('friendships')
            .select('*').eq('user_id', targetUserId).eq('friend_id', currentUserId).single();
            
        const existing = existingA || existingB;

        if (existing) {
            if (existing.status === 'rejected') {
                const { error } = await supabase
                    .from('friendships')
                    .update({ 
                        status: 'pending', 
                        user_id: currentUserId, 
                        friend_id: targetUserId,
                        blocked_by: null,
                    })
                    .eq('id', existing.id);
                if (error) throw error;
                return true;
            }
            return true; 
        }

        const { error } = await supabase
            .from('friendships')
            .insert([{ 
                user_id: currentUserId, 
                friend_id: targetUserId, 
                status: 'pending',
                created_at: new Date().toISOString()
            }]);
        
        if(error) throw error;
        return true;
    } catch(e: any) {
        console.error("Erro ao enviar solicitacao", e.message);
        return false;
    }
};

export const fetchNotifications = async (currentUserId: string): Promise<Notification[]> => {
    try {
        const { data: incoming } = await supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at')
            .eq('friend_id', currentUserId)
            .eq('status', 'pending');

        const { data: updates } = await supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at')
            .eq('user_id', currentUserId)
            .in('status', ['accepted', 'rejected']);

        const requests = [...(incoming || []), ...(updates || [])];

        requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const notifications: Notification[] = [];

        for (const req of requests) {
            const isIncomingRequest = req.friend_id === currentUserId && req.status === 'pending';
            const otherUserId = isIncomingRequest ? req.user_id : req.friend_id;

            const { data: u } = await supabase
                .from('users_meta')
                .select('*')
                .eq('user_id', otherUserId)
                .single();

            if (!u) continue; 

            let type: 'FRIEND_REQUEST' | 'REQUEST_ACCEPTED' | 'REQUEST_REJECTED' | null = null;
            
            if (isIncomingRequest) type = 'FRIEND_REQUEST';
            else if (req.status === 'accepted') type = 'REQUEST_ACCEPTED';
            else if (req.status === 'rejected') type = 'REQUEST_REJECTED';

            if (type) {
                notifications.push({
                    id: req.id,
                    type: type,
                    user: {
                        id: u.user_id,
                        name: u.name,
                        username: u.username,
                        avatar_url: u.avatar_url,
                        email: ''
                    },
                    timestamp: req.created_at,
                    read: false 
                });
            }
        }

        return notifications;
    } catch (e: any) {
        return [];
    }
};

export const clearNotification = async (notificationId: string, type: string) => {
    try {
        if (type === 'REQUEST_REJECTED') {
            await supabase.from('friendships').delete().eq('id', notificationId);
        }
        return true;
    } catch (e) {
        return false;
    }
}

export const fetchPendingRequests = async (currentUserId: string) => {
    const notifs = await fetchNotifications(currentUserId);
    return notifs.filter(n => n.type === 'FRIEND_REQUEST').map(n => ({
        requestId: n.id,
        user: n.user
    }));
};

export const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    try {
        if (accept) {
            await supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', requestId);
        } else {
            await supabase
                .from('friendships')
                .update({ status: 'rejected' })
                .eq('id', requestId);
        }
        return true;
    } catch (e) {
        console.error("Erro ao responder:", e);
        return false;
    }
};

export const getUserProfile = async (userId: string, currentUserId: string): Promise<{user: User, friendship: any} | null> => {
    try {
        const { data: userData, error: userError } = await supabase
            .from('users_meta')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (userError || !userData) {
            return null;
        }

        let friendship = null;
        
        const { data: friendshipA } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('friend_id', userId)
            .single();

        const { data: friendshipB } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id', userId)
            .eq('friend_id', currentUserId)
            .single();

        friendship = friendshipA || friendshipB;

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
    } catch (e) {
        return null;
    }
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

  } catch (e: any) {
    return [];
  }
};

export const markMessagesAsRead = async (chatId: string, userId: string) => {
    try {
        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('chat_id', chatId)
            .neq('sender_id', userId) 
            .eq('is_read', false);
    } catch (e: any) {
        console.error("Erro ao marcar como lido", e.message);
    }
};

export const sendMessage = async (
    content: string, 
    chatId: string, 
    userId: string, 
    type: MessageType = 'text',
    location?: {lat: number, lng: number}
): Promise<Message | null> => {
    try {
        const newMessage = {
            content,
            sender_id: String(userId),
            chat_id: chatId,
            created_at: new Date().toISOString(),
            is_read: false,
            location: location || null,
        };

        const { data, error } = await supabase
            .from('messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) throw error;

        return {
            ...data,
            type: type
        } as Message;

    } catch (e: any) {
        console.error('Erro ao enviar mensagem:', e.message);
        return null;
    }
};

// --- Checks ---
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    if (!username) return false;
    try {
        const { data, error } = await supabase.from('users_meta').select('username').eq('username', username).single();
        if (error && error.code === 'PGRST116') return true;
        if (data) return false;
        return true; 
    } catch (e) {
        return true; 
    }
};

export const checkPhoneAvailable = async (phone: string): Promise<boolean> => {
    if (!phone) return false;
    try {
        const { data, error } = await supabase.from('users_meta').select('phone').eq('phone', phone).single();
        if (error && error.code === 'PGRST116') return true;
        if (data) return false;
        return true;
    } catch (e) {
        return true;
    }
};

export const fetchEcoData = async (): Promise<EcoData> => {
  return {
      totalMarks: 0,
      engagementScore: 0,
      pulseViews: []
  };
};

export const searchContent = async (query: string): Promise<SearchResult[]> => {
  return []; 
};
