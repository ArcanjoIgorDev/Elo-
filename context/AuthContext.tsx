import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{data: any; error: any}>; 
  signUp: (username: string, password: string, name: string, phone: string) => Promise<{data: any; error: any}>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        mapSessionToUser(session);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        mapSessionToUser(session);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapSessionToUser = (session: Session) => {
    const metadata = session.user.user_metadata || {};
    setUser({
      id: session.user.id,
      email: session.user.email!, 
      name: metadata.name || 'Usuário',
      username: metadata.username,
      phone: metadata.phone,
      avatar_url: metadata.avatar_url,
    });
    setLoading(false);
  };

  const signIn = async (identifier: string, password: string) => {
    const internalEmail = `${identifier.trim().toLowerCase()}@elo.app`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    
    if (error && error.message.includes("Invalid login credentials")) {
        return { data, error: { message: "Usuário ou senha incorretos." } };
    }
    
    return { data, error };
  };

  const signUp = async (username: string, password: string, name: string, phone: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const internalEmail = `${cleanUsername}@elo.app`;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // 1. Cria o usuário na Auth do Supabase
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

    if (error) return { data, error };

    // 2. CRUCIAL: Força a inserção na tabela pública 'users_meta' caso a trigger do banco falhe ou não exista.
    // Isso garante que o usuário seja encontrado na busca de amigos imediatamente.
    if (data.user) {
        const { error: metaError } = await supabase
            .from('users_meta')
            .upsert({
                user_id: data.user.id,
                username: cleanUsername,
                name: name,
                avatar_url: avatarUrl,
                phone: phone,
                bio: ''
            }, { onConflict: 'user_id' }); // Se já existir (pela trigger), apenas atualiza
            
        if (metaError) {
            console.error("Erro ao sincronizar perfil público:", metaError);
            // Não bloqueia o fluxo, mas loga o erro
        }
    }
    
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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