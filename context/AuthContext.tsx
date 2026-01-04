
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{data: any; error: any}>; 
  signUp: (username: string, password: string, name: string, phone: string) => Promise<{data: any; error: any}>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tempo limite de inatividade em milissegundos (30 minutos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchFullUserProfile(session.user.id, session);
        startActivityTimer();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Apenas busca perfil se já não tivermos usuário ou se o ID mudou
        // Para evitar loops, mas garantindo verificação de deleted
        fetchFullUserProfile(session.user.id, session);
        startActivityTimer();
      } else {
        setUser(null);
        setLoading(false);
        stopActivityTimer();
      }
    });

    // Activity Listeners
    const handleActivity = () => resetActivityTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      subscription.unsubscribe();
      stopActivityTimer();
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, []);

  const resetActivityTimer = () => {
      if (user) {
          if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
          activityTimerRef.current = setTimeout(() => {
              console.log("ELO: Auto-logout devido a inatividade.");
              signOut();
              alert("Sessão encerrada por segurança devido a inatividade.");
          }, INACTIVITY_TIMEOUT);
      }
  };

  const startActivityTimer = () => {
      resetActivityTimer();
  };

  const stopActivityTimer = () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
  };

  const fetchFullUserProfile = async (userId: string, session: Session) => {
      try {
          const { data: meta, error } = await supabase
              .from('users_meta')
              .select('*')
              .eq('user_id', userId)
              .single();
          
          if (error) {
              console.error("Error fetching user meta:", error);
              // Não bloqueia login por erro de rede, mas usuário fica incompleto
          }

          // --- BLOQUEIO DE CONTA DELETADA (Sessão Restaurada) ---
          if (meta?.is_deleted) {
              console.warn("ELO: Tentativa de acesso a conta deletada bloqueada.");
              await supabase.auth.signOut();
              setUser(null);
              setLoading(false);
              return;
          }
          // ------------------------------------------------------

          const metadata = session.user.user_metadata || {};

          setUser({
              id: session.user.id,
              email: session.user.email!,
              name: meta?.name || metadata.name || 'Usuário',
              username: meta?.username || metadata.username,
              phone: meta?.phone || metadata.phone,
              avatar_url: meta?.avatar_url || metadata.avatar_url,
              bio: meta?.bio || '',
              latitude: meta?.latitude,
              longitude: meta?.longitude,
              city: meta?.city,
              education: meta?.education
          });
      } catch (e) {
          console.error("Profile fetch error", e);
      } finally {
          setLoading(false);
      }
  };

  const signIn = async (identifier: string, password: string) => {
    const internalEmail = `${identifier.trim().toLowerCase()}@elo.app`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    
    if (error) {
        if (error.message.includes("Invalid login credentials")) {
            return { data, error: { message: "Usuário ou senha incorretos." } };
        }
        return { data, error };
    }

    // --- BLOQUEIO DE CONTA DELETADA (Login Ativo) ---
    if (data.user) {
        const { data: meta } = await supabase
            .from('users_meta')
            .select('is_deleted')
            .eq('user_id', data.user.id)
            .single();

        if (meta?.is_deleted) {
            await supabase.auth.signOut();
            return { 
                data: { user: null, session: null }, 
                error: { message: "Esta conta foi excluída permanentemente e não pode ser acessada." } 
            };
        }
    }
    // ------------------------------------------------
    
    return { data, error };
  };

  const signUp = async (username: string, password: string, name: string, phone: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const internalEmail = `${cleanUsername}@elo.app`;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // 1. Criar Auth User
    const { data, error } = await supabase.auth.signUp({
        email: internalEmail,
        password,
        options: {
            data: {
                name,
                phone,
                username: cleanUsername,
                avatar_url: avatarUrl
            }
        }
    });

    if (error) {
        // Tradução amigável de erros comuns do Supabase Auth
        if (error.message.includes('User already registered')) {
            return { data, error: { message: "Este nome de usuário já está registrado (email associado em uso)." } };
        }
        return { data, error };
    }

    // 2. Garantir criação no users_meta
    if (data.user) {
        const { error: metaError } = await supabase.from('users_meta').upsert({
                user_id: data.user.id,
                username: cleanUsername,
                name: name,
                avatar_url: avatarUrl,
                phone: phone,
                bio: '',
                is_deleted: false // Garante que novas contas nasçam vivas
            }, { onConflict: 'user_id' }); 
        
        if (metaError) {
            console.error("Meta Creation Error:", metaError);
            // Se falhar o meta, o usuário fica num estado inconsistente. Retornamos o erro.
            return { data, error: { message: "Erro ao criar perfil público. Tente novamente." } };
        }
    }
    
    return { data, error };
  };

  const signOut = async () => {
    stopActivityTimer();
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
      setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
