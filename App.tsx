import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import EcoScreen from './screens/EcoScreen';
import ProfileScreen from './screens/ProfileScreen';
import { AppScreen, User } from './types';
import { getChatId } from './services/dataService';

const AppContent: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.HOME);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatTargetUser, setChatTargetUser] = useState<User | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);

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

  const handleOpenChat = (chatId: string, targetUser: User) => {
      setSelectedChatId(chatId);
      setChatTargetUser(targetUser);
      setChatInitialMessage(undefined); // Limpa contexto anterior
      setCurrentScreen(AppScreen.CHAT);
  };

  const handleStartChatFromProfile = (targetUser: User, initialContext?: string) => {
      if (!user) return;
      const chatId = getChatId(user.id, targetUser.id);
      setSelectedChatId(chatId);
      setChatTargetUser(targetUser);
      setChatInitialMessage(initialContext);
      setCurrentScreen(AppScreen.CHAT);
  };

  const handleViewProfile = (userId: string) => {
      setViewProfileId(userId);
      setCurrentScreen(AppScreen.USER_PROFILE);
  };

  // Full screen overrides (no bottom nav)
  if (currentScreen === AppScreen.CHAT && selectedChatId && chatTargetUser) {
    return (
        <ChatScreen 
            chatId={selectedChatId} 
            targetUser={chatTargetUser}
            initialMessage={chatInitialMessage}
            onBack={() => {
                setSelectedChatId(null);
                setChatTargetUser(null);
                setChatInitialMessage(undefined);
                setCurrentScreen(AppScreen.HOME);
            }} 
        />
    );
  }

  if (currentScreen === AppScreen.USER_PROFILE && viewProfileId) {
      return (
          <ProfileScreen 
            targetUserId={viewProfileId}
            onBack={() => setCurrentScreen(AppScreen.HOME)}
            onSignOut={() => {}}
            onStartChat={handleStartChatFromProfile}
          />
      );
  }

  if (currentScreen === AppScreen.PROFILE) {
      return (
          <Layout activeScreen={AppScreen.PROFILE} onNavigate={setCurrentScreen}>
            <ProfileScreen 
                onBack={() => setCurrentScreen(AppScreen.HOME)}
                onSignOut={signOut}
                onStartChat={handleStartChatFromProfile}
            />
          </Layout>
      )
  }

  return (
    <Layout activeScreen={currentScreen} onNavigate={setCurrentScreen}>
      {currentScreen === AppScreen.HOME && (
          <HomeScreen 
            onNavigate={setCurrentScreen} 
            onChatSelect={handleOpenChat} 
            onViewProfile={handleViewProfile}
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