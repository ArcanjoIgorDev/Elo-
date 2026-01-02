import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts, Notification } from '../types';
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

export const fetchPulses = async (): Promise<Pulse[]> => {
  try {
    const { data, error } = await supabase
      .from('pulsos')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data as Pulse[] || [];
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

export const fetchUserChats = async (currentUserId: string): Promise<ChatSummary[]> => {
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .ilike('chat_id', `%${currentUserId}%`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!messages) return [];

        const chatMap = new Map<string, ChatSummary>();
        const userCache = new Map<string, any>();

        for (const msg of messages) {
            if (!chatMap.has(msg.chat_id)) {
                const ids = msg.chat_id.split('_');
                const otherId = ids.find((id: string) => id !== currentUserId);
                
                if (otherId) {
                    let userData = userCache.get(otherId);

                    if (!userData) {
                        const { data } = await supabase
                            .from('users_meta')
                            .select('name, username, avatar_url')
                            .eq('user_id', otherId)
                            .single();
                        
                        userData = data || {
                            name: 'Usuário Excluído',
                            username: 'desconhecido',
                            avatar_url: '',
                            is_deleted: true
                        };
                        userCache.set(otherId, userData);
                    }

                    chatMap.set(msg.chat_id, {
                        chatId: msg.chat_id,
                        otherUser: {
                            id: otherId,
                            name: userData.name,
                            username: userData.username,
                            avatar_url: userData.avatar_url,
                            is_deleted: userData.is_deleted
                        },
                        lastMessage: msg,
                        unreadCount: 0 
                    });
                }
            }
        }

        return Array.from(chatMap.values());
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
            const { data: friendship } = await supabase
                .from('friendships')
                .select('status, blocked_by, user_id, friend_id')
                .or(`and(user_id.eq.${currentUserId},friend_id.eq.${u.user_id}),and(user_id.eq.${u.user_id},friend_id.eq.${currentUserId})`)
                .single();

            // Lógica de Status
            let status = null;
            if (friendship) {
                if (friendship.status === 'blocked' && friendship.blocked_by === u.user_id) {
                    return null; // Não mostrar se fui bloqueado
                }
                status = friendship.status;
                
                // Se o status for rejected e eu fui quem pediu, mostrar como se não tivesse nada (para tentar de novo se quiser)
                // OU mostrar 'rejected' para feedback
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
        // Verificar se já existe uma amizade ou pedido (mesmo que rejeitado)
        const { data: existing, error: fetchError } = await supabase.from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`)
            .single();

        if (existing) {
            // Se foi rejeitada, atualiza para pending novamente
            if (existing.status === 'rejected') {
                const { error } = await supabase
                    .from('friendships')
                    .update({ 
                        status: 'pending', 
                        user_id: currentUserId, // Importante: quem pede agora é o currentUser
                        friend_id: targetUserId,
                        blocked_by: null
                    })
                    .eq('id', existing.id);
                if (error) throw error;
                return true;
            }
            return true; // Já existe (pending ou accepted)
        }

        // Se não existe, cria nova
        const { error } = await supabase
            .from('friendships')
            .insert([{ user_id: currentUserId, friend_id: targetUserId, status: 'pending' }]);
        
        if(error) throw error;
        return true;
    } catch(e: any) {
        console.error("Erro ao enviar solicitacao", e.message);
        return false;
    }
};

// --- NOVO SISTEMA DE NOTIFICAÇÕES (Pedidos + Status) ---

export const fetchNotifications = async (currentUserId: string): Promise<Notification[]> => {
    try {
        // Buscar pedidos onde eu sou o amigo (friend_id) e status é pending (ALGUÉM ME PEDIU)
        // OU onde eu sou o user (user_id) e status é accepted/rejected (ALGUÉM RESPONDEU MEU PEDIDO)
        
        const { data: requests, error } = await supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at, updated_at')
            .or(`and(friend_id.eq.${currentUserId},status.eq.pending),and(user_id.eq.${currentUserId},status.in.(accepted,rejected))`)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        if (!requests || requests.length === 0) return [];

        const notifications: Notification[] = [];

        for (const req of requests) {
            // Determinar o "outro" usuário
            const isIncomingRequest = req.friend_id === currentUserId && req.status === 'pending';
            const isStatusUpdate = req.user_id === currentUserId && (req.status === 'accepted' || req.status === 'rejected');
            
            const otherUserId = isIncomingRequest ? req.user_id : req.friend_id;

            const { data: u } = await supabase
                .from('users_meta')
                .select('*')
                .eq('user_id', otherUserId)
                .single();

            if (!u) continue; // Usuário deletado

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
                    timestamp: req.updated_at || req.created_at,
                    read: false // Idealmente salvaríamos isso no banco, mas por simplicidade assumimos false
                });
            }
        }

        return notifications;
    } catch (e) {
        console.error("Erro ao buscar notificações", e);
        return [];
    }
};

// Limpa notificações que são apenas informativas (Aceito/Recusado)
// Para 'rejected', podemos deletar a row ou mudar status para 'deleted_notification' se tivéssemos essa coluna.
// Como não temos, vamos DELETAR o registro de amizade se for 'rejected' e o usuário dispensar.
// Se for 'accepted', apenas removemos da UI localmente (o status continua accepted no banco para manter a amizade).
export const clearNotification = async (notificationId: string, type: string) => {
    try {
        if (type === 'REQUEST_REJECTED') {
            // Se foi rejeitado e o usuário viu, podemos limpar do banco para ele poder pedir de novo no futuro
            await supabase.from('friendships').delete().eq('id', notificationId);
        }
        // Se for accepted, não fazemos nada no banco, a UI filtra (ou precisaríamos de uma tabela de notificações real)
        return true;
    } catch (e) {
        return false;
    }
}

export const fetchPendingRequests = async (currentUserId: string) => {
    // Mantido para compatibilidade, mas agora usamos fetchNotifications
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
                .update({ 
                    status: 'accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);
        } else {
            // NÃO DELETAR. Marcar como rejeitado para o remetente ser notificado.
            await supabase
                .from('friendships')
                .update({ 
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
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
        // Busca Perfil
        const { data: userData, error: userError } = await supabase
            .from('users_meta')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (userError) throw userError;

        // Busca Status Amizade
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
                bio: userData.bio
            },
            friendship
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
    return data as Message[] || [];
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

export const sendMessage = async (content: string, chatId: string, userId: string, location?: {lat: number, lng: number}): Promise<Message | null> => {
    try {
        const newMessage = {
            content,
            sender_id: String(userId), // UUID string é uma string válida
            chat_id: chatId,
            created_at: new Date().toISOString(),
            is_read: false,
            location: location || null
        };

        const { data, error } = await supabase
            .from('messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) throw error;

        return data as Message;
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