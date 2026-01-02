import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts, Notification, MessageType } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- HELPER: Gera ID único para conversa entre dois usuários ---
export const getChatId = (userA: string, userB: string) => {
    const ids = [userA, userB].sort();
    return `${ids[0]}_${ids[1]}`;
};

// --- SERVICES ---

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
        // Query A: Eu sou user_id
        const { count: countA, error: errorA } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'accepted');

        // Query B: Eu sou friend_id
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

// --- UPDATE PROFILE ---
export const updateUserProfileMeta = async (userId: string, updates: { bio?: string, avatar_url?: string }): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('users_meta')
            .update(updates)
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
    // Busca pulsos
    const { data: pulses, error } = await supabase
      .from('pulsos')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    if (!pulses || pulses.length === 0) return [];

    // Busca IDs de usuários que ainda existem na users_meta
    const userIds = [...new Set(pulses.map(p => p.user_id))];
    const { data: existingUsers } = await supabase
        .from('users_meta')
        .select('user_id')
        .in('user_id', userIds);
    
    // Cria um Set para busca rápida O(1)
    const validUserIds = new Set(existingUsers?.map(u => u.user_id));

    // Filtra apenas posts de usuários que ainda existem
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
        // Verifica se já existe
        const { data: existing } = await supabase
            .from('pulse_reactions')
            .select('*')
            .eq('pulse_id', pulseId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            if (existing.reaction_type === type) {
                // Remove (toggle off)
                await supabase.from('pulse_reactions').delete().eq('id', existing.id);
            } else {
                // Atualiza para o novo tipo
                await supabase.from('pulse_reactions').update({ reaction_type: type }).eq('id', existing.id);
            }
        } else {
            // Cria nova
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

// --- CHAT & FRIENDS FETCHING (REWRITTEN FOR "NEW CONNECTIONS") ---
export const fetchUserChats = async (currentUserId: string): Promise<ChatSummary[]> => {
    try {
        // 1. Busca TODAS as amizades aceitas primeiro
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

        // Consolida IDs de amigos
        const friendIds: string[] = [];
        const friendshipDates = new Map<string, string>(); // friendId -> date

        friendshipsA?.forEach((f: any) => {
             friendIds.push(f.friend_id);
             friendshipDates.set(f.friend_id, f.created_at);
        });
        friendshipsB?.forEach((f: any) => {
             friendIds.push(f.user_id);
             friendshipDates.set(f.user_id, f.created_at);
        });

        if (friendIds.length === 0) return [];

        // 2. Busca Detalhes dos Usuários (Amigos)
        const { data: usersData } = await supabase
            .from('users_meta')
            .select('user_id, name, username, avatar_url')
            .in('user_id', friendIds);
        
        const friendsMap = new Map<string, any>();
        usersData?.forEach((u: any) => friendsMap.set(u.user_id, u));

        // 3. Busca MENSAGENS recentes para determinar conversas ativas
        const { data: rawMessages } = await supabase
            .from('messages')
            .select('*')
            .ilike('chat_id', `%${currentUserId}%`)
            .order('created_at', { ascending: false }); // As mais recentes primeiro

        // Injeta tipo baseado no conteúdo, já que a coluna 'type' não existe no DB
        const messages = (rawMessages || []).map((m: any) => ({
            ...m,
            type: m.location ? 'location' : (m.content && m.content.startsWith('data:image') ? 'image' : 'text')
        }));

        // 4. Processa e Agrupa
        const chats: ChatSummary[] = [];
        const processedFriendIds = new Set<string>();
        const chatsWithUnread: { [chatId: string]: number } = {};

        // Helper para contar mensagens não lidas por chat
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

        // B. Novas Conexões (Amigos que ainda NÃO têm mensagens)
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
                        // lastMessage é undefined
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
                .select('status, blocked_by, user_id, friend_id')
                .eq('user_id', currentUserId)
                .eq('friend_id', u.user_id)
                .single();

            const { data: friendshipB } = await supabase
                .from('friendships')
                .select('status, blocked_by, user_id, friend_id')
                .eq('user_id', u.user_id)
                .eq('friend_id', currentUserId)
                .single();

            const friendship = friendshipA || friendshipB;

            let status = null;
            if (friendship) {
                if (friendship.status === 'blocked' && friendship.blocked_by === u.user_id) {
                    return null; // Não mostrar se fui bloqueado
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
        const { data: incoming, error: errorIncoming } = await supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at')
            .eq('friend_id', currentUserId)
            .eq('status', 'pending');

        if (errorIncoming) throw errorIncoming;

        const { data: updates, error: errorUpdates } = await supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at')
            .eq('user_id', currentUserId)
            .in('status', ['accepted', 'rejected']);

        if (errorUpdates) throw errorUpdates;

        const requests = [...(incoming || []), ...(updates || [])];

        requests.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

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
        console.error("Erro ao buscar notificações", JSON.stringify(e));
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
                bio: userData.bio
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
    
    // Mapeamento manual de tipo, pois a coluna não existe no banco
    return (data || []).map((m: any) => ({
        ...m,
        type: m.location ? 'location' : (m.content && m.content.startsWith('data:image') ? 'image' : 'text')
    })) as Message[];

  } catch (e: any) {
    console.error('Erro ao buscar mensagens:', e.message);
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
            // type: type // REMOVIDO: A coluna type não existe no banco. Inferimos no fetch.
        };

        const { data, error } = await supabase
            .from('messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) throw error;

        // Retorna o objeto completo para a UI usar (incluindo o tipo que o front já sabe)
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