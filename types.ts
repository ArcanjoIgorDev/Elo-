
export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  city?: string; // Novo
  education?: string; // Novo
  latitude?: number; // Novo
  longitude?: number; // Novo
  is_deleted?: boolean;
}

export type MessageType = 'text' | 'image' | 'audio' | 'location';

export interface Message {
  id: string;
  sender_id: string | null;
  content: string;
  type?: MessageType;
  created_at: string;
  is_read: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  context_score?: number;
}

export type EmotionalState = 'neutro' | 'feliz' | 'triste' | 'energizado' | 'cansado' | 'focado';
export type ReactionType = 'heart' | 'fire';

export interface Pulse {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  content_type: 'text' | 'image';
  content: string; 
  description?: string;
  emotional_state?: EmotionalState;
  created_at: string;
  expires_at: string;
}

export interface PulseReactionCounts {
  heart: number;
  fire: number;
}

export interface Topic {
    id: string;
    title: string;
}

export interface Metric {
  label: string;
  value: number;
  delta?: number;
}

export interface ActivityPoint {
    date: string; // YYYY-MM-DD
    fullDate: string; // Display
    messages: number;
    pulses: number;
    total: number;
}

export interface EcoData {
  pulseViews: { date: string; views: number }[];
  totalMarks: number;
  engagementScore: number;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'pulse' | 'user';
  title: string;
  content: string;
  date: string;
  meta: any;
}

export interface ChatSummary {
  chatId: string;
  otherUser: {
    id: string;
    name: string;
    username: string;
    avatar_url: string;
    is_deleted?: boolean; // Novo
  };
  lastMessage?: Message;
  unreadCount: number;
  isNewConnection?: boolean;
}

export interface Notification {
    id: string;
    type: 'FRIEND_REQUEST' | 'REQUEST_ACCEPTED' | 'REQUEST_REJECTED';
    user: User;
    timestamp: string;
    read: boolean;
}

export enum AppScreen {
  LOGIN = 'LOGIN',
  HOME = 'HOME',
  CHAT = 'CHAT',
  MAP = 'MAP', // Nova Tela
  ECO = 'ECO',
  PROFILE = 'PROFILE',
  USER_PROFILE = 'USER_PROFILE',
  SETTINGS = 'SETTINGS'
}
