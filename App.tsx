
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import EcoScreen from './screens/EcoScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen'; // Novo
import { AppScreen, User } from './types';
import { getChatId } from './services/dataService';

const AppContent: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  
  // State management aligned with History API
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.HOME);
  
  // Chat State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatTargetUser, setChatTargetUser] = useState<User | null>(null);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  
  // Profile State
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  // Vibe Trigger State (Middle Button)
  const [vibeTrigger, setVibeTrigger] = useState(0);

  // --- NAVEGAÇÃO COM BOTÃO VOLTAR FÍSICO ---
  useEffect(() => {
    // Ao montar, define o estado inicial no histórico se não existir
    if (!window.history.state) {
        window.history.replaceState({ screen: AppScreen.HOME }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
        const state = event.state;
        if (state && state.screen) {
            // Restaura estados baseados na tela
            if (state.screen === AppScreen.HOME) {
                setSelectedChatId(null);
                setChatTargetUser(null);
                setViewProfileId(null);
            }
            setCurrentScreen(state.screen);
        } else {
            // Fallback para Home se não houver estado
            setCurrentScreen(AppScreen.HOME);
        }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (screen: AppScreen, extraState: any = {}) => {
      // Evita pushState se já estiver na tela (exceto Chat/Profile que podem mudar de ID)
      const isSameScreen = currentScreen === screen;
      
      // Atualiza o estado React
      setCurrentScreen(screen);

      // Atualiza o Histórico do Navegador
      window.history.pushState({ screen, ...extraState }, '');
  };

  const handleOpenChat = (chatId: string, targetUser: User) => {
      setSelectedChatId(chatId);
      setChatTargetUser(targetUser);
      setChatInitialMessage(undefined);
      navigateTo(AppScreen.CHAT, { chatId });
  };

  const handleStartChatFromProfile = (targetUser: User, initialContext?: string) => {
      if (!user) return;
      const chatId = getChatId(user.id, targetUser.id);
      setSelectedChatId(chatId);
      setChatTargetUser(targetUser);
      setChatInitialMessage(initialContext);
      navigateTo(AppScreen.CHAT, { chatId });
  };

  const handleViewProfile = (userId: string) => {
      setViewProfileId(userId);
      navigateTo(AppScreen.USER_PROFILE, { userId });
  };

  const handleNavClick = (screen: AppScreen) => {
      if (screen === AppScreen.HOME) {
           window.history.pushState({ screen: AppScreen.HOME }, '');
           setCurrentScreen(AppScreen.HOME);
      } else {
           navigateTo(screen);
      }
  };

  const handleTriggerVibe = () => {
      setVibeTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-100 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Full screen overrides (no bottom nav)
  if (currentScreen === AppScreen.CHAT && selectedChatId && chatTargetUser) {
    return (
        <ChatScreen 
            chatId={selectedChatId} 
            targetUser={chatTargetUser}
            initialMessage={chatInitialMessage}
            onBack={() => window.history.back()} 
        />
    );
  }

  // Settings Screen
  if (currentScreen === AppScreen.SETTINGS) {
      return (
          <SettingsScreen 
            onBack={() => window.history.back()}
            onNavigateProfile={() => {
                // Navigate to own profile but inside layout context? Or keep as full?
                // Let's use standard nav
                navigateTo(AppScreen.PROFILE);
            }}
            onLogout={signOut}
          />
      );
  }

  if (currentScreen === AppScreen.USER_PROFILE && viewProfileId) {
      return (
          <ProfileScreen 
            targetUserId={viewProfileId}
            onBack={() => window.history.back()}
            onSettings={() => navigateTo(AppScreen.SETTINGS)}
            onStartChat={handleStartChatFromProfile}
          />
      );
  }

  if (currentScreen === AppScreen.PROFILE) {
      return (
          <Layout activeScreen={AppScreen.PROFILE} onNavigate={handleNavClick}>
            <ProfileScreen 
                onBack={() => handleNavClick(AppScreen.HOME)}
                onSettings={() => navigateTo(AppScreen.SETTINGS)}
                onStartChat={handleStartChatFromProfile}
            />
          </Layout>
      )
  }

  return (
    <Layout 
        activeScreen={currentScreen} 
        onNavigate={handleNavClick}
        onTriggerVibe={handleTriggerVibe}
    >
      {currentScreen === AppScreen.HOME && (
          <HomeScreen 
            onNavigate={handleNavClick} 
            onChatSelect={handleOpenChat} 
            onViewProfile={handleViewProfile}
            vibeTrigger={vibeTrigger}
          />
      )}
      {currentScreen === AppScreen.ECO && <EcoScreen />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
