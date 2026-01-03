
export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  education?: string;
  latitude?: number;
  longitude?: number;
  is_deleted?: boolean;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'location';

export interface Message {
  id: string;
  sender_id: string | null;
  content: string;
  media_url?: string; // Novo campo para URL do storage
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
  content_type: 'text' | 'image' | 'video';
  content: string; // URL ou Texto
  description?: string;
  emotional_state?: EmotionalState;
  created_at: string;
  expires_at: string;
}

export interface PulseReactionCounts {
  heart: number;
  fire: number;
}

// --- NOVOS TIPOS PARA O FEED ---

export interface Post {
    id: string;
    user: User;
    content: string;
    media_url?: string;
    media_type?: 'image' | 'video';
    allow_comments: boolean;
    likes_count: number;
    comments_count: number;
    created_at: string;
    liked_by_me?: boolean; // Campo virtual para UI
}

export interface PostComment {
    id: string;
    post_id: string;
    user: User;
    content: string;
    created_at: string;
}

// ------------------------------

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
    is_deleted?: boolean;
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
  MAP = 'MAP',
  ECO = 'ECO',
  PROFILE = 'PROFILE',
  USER_PROFILE = 'USER_PROFILE',
  SETTINGS = 'SETTINGS'
}
