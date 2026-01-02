
import React, { useEffect, useState, useRef } from 'react';
import { User, Pulse, ActivityPoint } from '../types';
import { fetchPulses, getUserProfile, deleteMyAccount, toggleBlockUser, sendFriendRequest, updateUserProfileMeta, getFriendsCount, fetchUserChats, getChatId, fetchUserResonance } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Zap, ShieldAlert, UserPlus, Check, MessageCircle, Edit2, Camera, Upload, Save, Settings, Users, Activity } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, CartesianGrid, XAxis } from 'recharts';

interface ProfileScreenProps {
  targetUserId?: string; // If null, shows own profile
  onBack: () => void;
  onSettings: () => void; // Link to Settings
  onStartChat?: (user: User, initialContext?: string) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ targetUserId, onBack, onSettings, onStartChat }) => {
  const { user, updateUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPulses, setUserPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats & Chart Data
  const [friendsCount, setFriendsCount] = useState(0);
  const [resonanceScore, setResonanceScore] = useState(0); 
  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  
  // Actions
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const PRESET_AVATARS = [
      'https://ui-avatars.com/api/?background=10b981&color=fff&name=',
      'https://ui-avatars.com/api/?background=6366f1&color=fff&name=',
      'https://ui-avatars.com/api/?background=18181b&color=fff&name=',
      'https://api.dicebear.com/7.x/notionists/svg?seed=',
  ];

  useEffect(() => {
    const loadProfile = async () => {
        setLoading(true);
        const uid = targetUserId || user?.id;
        if(!uid) return;

        // 1. Dados Básicos
        if (isOwnProfile && user) {
            setProfileUser(user);
            setEditBio(user.bio || '');
            setEditAvatar(user.avatar_url || '');
        } else {
            const result = await getUserProfile(uid, user!.id);
            if (result) {
                setProfileUser(result.user);
                if (result.friendship) {
                    setFriendshipId(result.friendship.id);
                    setFriendshipStatus(result.friendship.status);
                    setIsBlocked(result.friendship.status === 'blocked' && result.friendship.blocked_by === user!.id);
                } else {
                    setFriendshipStatus(null);
                }
            } else {
                setProfileUser(null);
            }
        }

        // 2. Vibes
        const allPulses = await fetchPulses();
        const myPulses = allPulses.filter(p => p.user_id === uid);
        setUserPulses(myPulses);

        // 3. Stats & Chart Real Data
        const count = await getFriendsCount(uid);
        setFriendsCount(count);

        // Fetch Real Resonance Data
        const realActivity = await fetchUserResonance(uid);
        setActivityData(realActivity);

        if (!isOwnProfile && user) {
            const chats = await fetchUserChats(user.id);
            const commonChat = chats.find(c => c.otherUser.id === uid);
            setResonanceScore(commonChat ? 85 : 0);
        }

        setLoading(false);
    };
    loadProfile();
  }, [targetUserId, user]);

  const handleConnect = async () => {
      if(user && profileUser && !friendshipStatus) {
          const success = await sendFriendRequest(user.id, profileUser.id);
          if (success) setFriendshipStatus('pending');
      }
  };

  const handlePulseClick = (pulse: Pulse) => {
      if (!isOwnProfile && profileUser && onStartChat && friendshipStatus === 'accepted') {
          const context = `> Vibe de ${pulse.created_at.split('T')[0]}:\n"${pulse.content_type === 'image' ? 'Foto da Vibe' : pulse.content}"\n\n`;
          onStartChat(profileUser, context);
      }
  };

  // --- LOGICA DE EDIÇÃO ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditAvatar(reader.result as string);
            setShowAvatarSelector(false);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
      if(!user) return;
      setLoading(true);
      const success = await updateUserProfileMeta(user.id, {
          bio: editBio,
          avatar_url: editAvatar
      });
      if (success) {
          updateUser({ bio: editBio, avatar_url: editAvatar });
          setProfileUser(prev => prev ? {...prev, bio: editBio, avatar_url: editAvatar} : null);
          setIsEditing(false);
      }
      setLoading(false);
  };

  if (loading) {
      return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-zinc-100 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profileUser) return null;

  return (
    <div className={`min-h-full bg-zinc-950 pb-32 relative transition-all duration-700 ${isBlocked ? 'grayscale' : ''}`}>
        
        {/* Header Actions */}
        <div className="fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-start pointer-events-none">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md rounded-full text-white border border-white/10 shadow-lg pointer-events-auto hover:scale-105 transition-transform"><ArrowLeft size={20} /></button>

            {isOwnProfile && (
                 <div className="flex gap-2 pointer-events-auto">
                     {isEditing ? (
                         <button onClick={handleSaveProfile} className="bg-brand-primary text-zinc-950 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                             <Save size={16} /> Salvar
                         </button>
                     ) : (
                         <>
                            <button onClick={() => setIsEditing(true)} className="w-10 h-10 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md rounded-full text-zinc-200 hover:text-white border border-white/10"><Edit2 size={16} /></button>
                            <button onClick={onSettings} className="w-10 h-10 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md rounded-full text-zinc-400 hover:text-white border border-white/10 animate-fade-in"><Settings size={16} /></button>
                         </>
                     )}
                </div>
            )}
        </div>

        {/* Profile Card Main */}
        <div className="pt-24 px-6 flex flex-col items-center relative">
            
            {/* Avatar Ring */}
            <div className="relative mb-5 group">
                <div className="w-28 h-28 rounded-[2rem] p-[3px] bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-2xl relative overflow-hidden">
                    <img 
                        src={isEditing ? editAvatar : (profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`)} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-[1.8rem] bg-zinc-950"
                    />
                    {/* Activity Dot */}
                    <div className="absolute bottom-2 right-2 w-4 h-4 bg-brand-primary rounded-full border-[3px] border-zinc-950"></div>
                </div>
                {isEditing && (
                    <button onClick={() => setShowAvatarSelector(!showAvatarSelector)} className="absolute -bottom-2 -right-2 bg-zinc-100 text-zinc-950 p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                        <Camera size={16} />
                    </button>
                )}
            </div>

            {/* Avatar Selector Panel */}
            {isEditing && showAvatarSelector && (
                <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 mb-4 animate-fade-in backdrop-blur-md z-20">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-3">Origem da Imagem</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-xl bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center shrink-0 hover:border-brand-primary text-zinc-400 hover:text-brand-primary"><Upload size={20} /><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/></button>
                            {PRESET_AVATARS.map((url, i) => {
                                const fullUrl = url.includes('=') ? url + profileUser.name : url + i;
                                return ( <button key={i} onClick={() => { setEditAvatar(fullUrl); setShowAvatarSelector(false); }} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-zinc-800 hover:border-brand-primary transition-colors"><img src={fullUrl} className="w-full h-full object-cover" /></button>)
                            })}
                    </div>
                </div>
            )}
            
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">{profileUser.name}</h1>
            <p className="text-brand-primary text-xs font-mono mb-4 bg-brand-primary/10 px-3 py-1 rounded-full">@{profileUser.username}</p>

            {/* Bio Area */}
            {isEditing ? (
                <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Sua bio..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:border-brand-primary/50 outline-none resize-none h-20 mb-4"
                    maxLength={150}
                />
            ) : (
                <p className="text-zinc-400 text-sm text-center max-w-xs mb-6 leading-relaxed">
                    {profileUser.bio || "Sem descrição disponível."}
                </p>
            )}

            {/* Action Buttons (Non-Owner) */}
            {!isOwnProfile && !isBlocked && (
                <div className="flex gap-3 mb-8 w-full justify-center">
                    {friendshipStatus === 'accepted' ? (
                        <button onClick={() => onStartChat && onStartChat(profileUser)} className="bg-zinc-100 text-zinc-950 px-8 py-3 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform flex items-center gap-2">
                            <MessageCircle size={18} /> Iniciar Chat
                        </button>
                    ) : friendshipStatus === 'pending' ? (
                        <button className="bg-zinc-800 text-zinc-500 px-8 py-3 rounded-xl font-medium text-sm border border-zinc-700 cursor-not-allowed flex items-center gap-2">
                            <Check size={18} /> Enviado
                        </button>
                    ) : (
                        <button onClick={handleConnect} className="bg-brand-primary text-zinc-950 px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2">
                            <UserPlus size={18} /> Conectar
                        </button>
                    )}
                </div>
            )}

            {/* Dashboard Grid */}
            <div className="w-full grid grid-cols-2 gap-4 mb-6">
                 {/* Card 1: Friends */}
                 <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between h-24 relative overflow-hidden group">
                     <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={40} /></div>
                     <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Conexões</span>
                     <span className="text-3xl font-bold text-zinc-100">{friendsCount}</span>
                 </div>

                 {/* Card 2: Vibes */}
                 <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between h-24 relative overflow-hidden group">
                     <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Zap size={40} /></div>
                     <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Vibes</span>
                     <span className="text-3xl font-bold text-zinc-100">{userPulses.length}</span>
                 </div>
            </div>

            {/* Chart Section (Activity Resonance) */}
            <div className="w-full bg-zinc-900/30 border border-zinc-800 rounded-3xl p-5 mb-8 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                     <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                         <Activity size={14} className="text-brand-primary" /> RESSONÂNCIA (7 Dias)
                     </h3>
                     {resonanceScore > 0 && <span className="text-[10px] text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-md">{resonanceScore}% Match</span>}
                </div>
                <div className="h-40 w-full">
                    {activityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis 
                                    dataKey="fullDate" 
                                    tick={{fontSize: 9, fill: '#52525b'}} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    interval="preserveStartEnd"
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '10px'}} 
                                    itemStyle={{color: '#fff'}} 
                                    cursor={{stroke: '#52525b', strokeWidth: 1}}
                                    labelFormatter={() => ''}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="total" 
                                    stroke="#10b981" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorActivity)" 
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-600 text-xs italic">
                            Sem dados de ressonância suficientes.
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Vibes */}
            <div className="w-full">
                <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-wider pl-1">Histórico Recente</h3>
                <div className="grid grid-cols-2 gap-3">
                    {userPulses.map(pulse => (
                         <div 
                            key={pulse.id} 
                            onClick={() => handlePulseClick(pulse)}
                            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden relative aspect-[4/5] group"
                        >
                            {pulse.content_type === 'image' ? (
                                <img src={pulse.content} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="w-full h-full p-4 flex items-center justify-center text-center bg-zinc-900">
                                    <p className="text-[10px] text-zinc-400 font-mono italic">"{pulse.content}"</p>
                                </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/5">
                                <p className="text-[8px] text-zinc-300">{new Date(pulse.created_at).toLocaleDateString()}</p>
                            </div>
                         </div>
                    ))}
                    {userPulses.length === 0 && <p className="text-zinc-600 text-xs col-span-2 text-center py-8 italic">Nenhuma vibe transmitida ainda.</p>}
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProfileScreen;
