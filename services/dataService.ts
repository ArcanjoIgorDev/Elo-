import { Pulse, Message, EcoData, SearchResult, ChatSummary, User, EmotionalState, Topic, ReactionType, PulseReactionCounts } from '../types';
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
        
        // Se der erro ou não tiver tópico, retorna o padrão para a UI não quebrar
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

        // Cache simples para evitar requests repetidos para mesmo usuario deletado
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
                        
                        // LÓGICA DE USUÁRIO EXCLUÍDO
                        // Se não retornou data, o usuário foi deletado do banco
                        userData = data || {
                            name: 'Usuário Excluído',
                            username: 'desconhecido',
                            avatar_url: '', // Avatar vazio
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
                .select('status, blocked_by')
                .or(`and(user_id.eq.${currentUserId},friend_id.eq.${u.user_id}),and(user_id.eq.${u.user_id},friend_id.eq.${currentUserId})`)
                .single();

            // Se eu fui bloqueado por ele, não vejo ele na busca (ou vejo como pendente/null)
            if (friendship && friendship.status === 'blocked' && friendship.blocked_by === u.user_id) {
                return null;
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
                friendshipStatus: friendship ? friendship.status : null
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
        const { data } = await supabase.from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`)
            .single();

        if (data) return true; 

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

export const fetchPendingRequests = async (currentUserId: string) => {
    try {
        const { data: requests, error } = await supabase
            .from('friendships')
            .select('id, user_id, created_at')
            .eq('friend_id', currentUserId)
            .eq('status', 'pending');

        if (error) throw error;
        if (!requests || requests.length === 0) return [];

        const enrichedRequests = await Promise.all(requests.map(async (req) => {
            const { data: u } = await supabase
                .from('users_meta')
                .select('*')
                .eq('user_id', req.user_id)
                .single();
            
            // Check se o usuário ainda existe
            if (!u) return null;

            return {
                requestId: req.id,
                user: {
                    id: u.user_id,
                    name: u.name,
                    username: u.username,
                    avatar_url: u.avatar_url,
                    email: ''
                } as User
            };
        }));

        // Remove itens nulos (de usuários deletados)
        return enrichedRequests.filter(req => req !== null) as {requestId: string, user: User}[];
    } catch (e) {
        console.error("Erro ao buscar solicitações", e);
        return [];
    }
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
                .delete()
                .eq('id', requestId);
        }
        return true;
    } catch (e) {
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