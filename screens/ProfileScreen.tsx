import React, { useEffect, useState, useRef } from 'react';
import { User, Pulse, ChatSummary } from '../types';
import { fetchPulses, getUserProfile, deletePulse, deleteMyAccount, toggleBlockUser, sendFriendRequest, removeFriend, updateUserProfileMeta, getFriendsCount, fetchUserChats, getChatId } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, LogOut, Zap, Trash2, Ban, ShieldAlert, Snowflake, UserPlus, Check, MessageCircle, X, UserMinus, Edit2, Camera, Upload, Save, Palette, Reply, Users, Calendar, Activity, BarChart3, Radio } from 'lucide-react';

interface ProfileScreenProps {
  targetUserId?: string; // If null, shows own profile
  onBack: () => void;
  onSignOut: () => void;
  onStartChat?: (user: User, initialContext?: string) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ targetUserId, onBack, onSignOut, onStartChat }) => {
  const { user, signOut, updateUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPulses, setUserPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [friendsCount, setFriendsCount] = useState(0);
  const [resonanceScore, setResonanceScore] = useState(0); // Função única "Ressonância"
  
  // States para ações
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // States de Edição
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const PRESET_AVATARS = [
      'https://ui-avatars.com/api/?background=10b981&color=fff&name=',
      'https://ui-avatars.com/api/?background=6366f1&color=fff&name=',
      'https://ui-avatars.com/api/?background=f43f5e&color=fff&name=',
      'https://ui-avatars.com/api/?background=f59e0b&color=fff&name=',
      'https://ui-avatars.com/api/?background=18181b&color=fff&name=',
      'https://api.dicebear.com/7.x/notionists/svg?seed=',
      'https://api.dicebear.com/7.x/micah/svg?seed=',
      'https://api.dicebear.com/7.x/bottts/svg?seed=',
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

        // 3. Stats Extras (Inovação)
        const count = await getFriendsCount(uid);
        setFriendsCount(count);

        if (!isOwnProfile && user) {
            // Calcular "Ressonância" (Compatibilidade simulada baseada em interações)
            // Na vida real isso analisaria mensagens trocadas, likes, etc.
            const chats = await fetchUserChats(user.id);
            const commonChat = chats.find(c => c.otherUser.id === uid);
            if (commonChat) {
                // Score baseado em mensagens + vibe check (simulado por hash do ID pra ser consistente)
                const pseudoRandom = (uid.charCodeAt(0) + user.id.charCodeAt(0)) % 40; 
                setResonanceScore(60 + pseudoRandom); // Entre 60 e 100
            } else {
                setResonanceScore(0);
            }
        }

        setLoading(false);
    };
    loadProfile();
  }, [targetUserId, user]);

  const removePulseFromList = (pulseId: string) => {
      setUserPulses(prev => prev.filter(p => p.id !== pulseId));
  };

  const handleDeleteAccount = async () => {
      setLoading(true);
      const success = await deleteMyAccount();
      if(success) {
          await signOut();
          alert("Sua conta foi excluída e seus dados removidos.");
      } else {
          setLoading(false);
          alert("Erro ao excluir conta. Tente novamente.");
      }
  };

  const handleBlockToggle = async () => {
      if(!friendshipId || !user) return;
      const newStatus = !isBlocked;
      setIsBlocked(newStatus); 
      const success = await toggleBlockUser(friendshipId, newStatus, user.id);
      if(!success) setIsBlocked(!newStatus);
  };

  const handleConnect = async () => {
      if(user && profileUser && !friendshipStatus) {
          const success = await sendFriendRequest(user.id, profileUser.id);
          if (success) setFriendshipStatus('pending');
      }
  };

  const handleRemoveFriend = async () => {
      if (friendshipId && window.confirm(`Deseja desfazer a amizade com ${profileUser?.name}?`)) {
          const success = await removeFriend(friendshipId);
          if (success) {
              setFriendshipStatus(null);
              setFriendshipId(null);
          }
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

  if (!profileUser) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-zinc-950 p-6 text-center">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <Ban size={32} className="text-zinc-600"/>
            </div>
            <h2 className="text-xl font-bold text-zinc-300 mb-2">Usuário não encontrado</h2>
            <button onClick={onBack} className="bg-zinc-100 text-zinc-950 px-6 py-3 rounded-full font-bold">Voltar</button>
        </div>
      );
  }

  // --- COMPONENTES VISUAIS ---

  const StatCard = ({ icon, value, label, highlight = false }: any) => (
      <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border ${highlight ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-900/50 border-zinc-800'}`}>
          <div className={`mb-1 ${highlight ? 'text-brand-primary' : 'text-zinc-400'}`}>{icon}</div>
          <span className={`text-lg font-bold ${highlight ? 'text-zinc-100' : 'text-zinc-300'}`}>{value}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
      </div>
  );

  return (
    <div className={`min-h-full bg-zinc-950 pb-32 relative transition-all duration-700 ${isBlocked ? 'grayscale blur-[1px]' : ''}`}>
        
        {/* Blocked Overlay */}
        {isBlocked && (
            <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                <div className="bg-zinc-950/80 p-6 rounded-3xl border border-blue-500/30 backdrop-blur-md flex flex-col items-center animate-in zoom-in duration-300">
                    <Snowflake size={40} className="text-blue-400 mb-2 animate-pulse" />
                    <p className="text-blue-200 font-bold tracking-widest text-sm">CONEXÃO CONGELADA</p>
                </div>
            </div>
        )}

        {/* Modal de Exclusão */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
                <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-3xl max-w-sm w-full shadow-2xl shadow-red-900/20">
                    <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <ShieldAlert className="text-red-500" size={24} />
                    </div>
                    <h3 className="text-red-500 font-bold text-lg text-center mb-2">Zona de Perigo</h3>
                    <p className="text-zinc-400 text-sm text-center mb-6">
                        Isso excluirá permanentemente seu perfil e dados.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-medium">Cancelar</button>
                        <button onClick={handleDeleteAccount} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Confirmar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Header Actions */}
        <div className="fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-start pointer-events-none">
            <button 
                onClick={onBack} 
                className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-all border border-white/10 shadow-lg pointer-events-auto"
            >
                <ArrowLeft size={20} />
            </button>

            {isOwnProfile && (
                 <div className="flex gap-2 pointer-events-auto">
                     {isEditing ? (
                         <button onClick={handleSaveProfile} className="bg-brand-primary text-zinc-950 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                             <Save size={16} /> Salvar
                         </button>
                     ) : (
                         <>
                            <button onClick={() => setIsEditing(true)} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-zinc-200 hover:text-white border border-white/10">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={onSignOut} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-zinc-400 hover:text-red-400 border border-white/10">
                                <LogOut size={16} />
                            </button>
                         </>
                     )}
                </div>
            )}
        </div>

        {/* Banner Gráfico */}
        <div className="h-48 w-full bg-zinc-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-zinc-950"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 rounded-full blur-[80px] -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-secondary/10 rounded-full blur-[60px] -ml-10 -mb-10"></div>
        </div>

        {/* Profile Header */}
        <div className="px-6 relative z-10 -mt-20">
            <div className="flex flex-col items-center">
                
                {/* Avatar */}
                <div className="relative mb-4 group">
                    <div className="w-32 h-32 rounded-full border-4 border-zinc-950 bg-zinc-900 overflow-hidden shadow-2xl relative">
                        <img 
                            src={isEditing ? editAvatar : (profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`)} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {isEditing && (
                        <button 
                            onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                            className="absolute bottom-1 right-1 bg-brand-primary text-zinc-950 p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform border-4 border-zinc-950"
                        >
                            <Camera size={18} />
                        </button>
                    )}
                </div>

                {/* Seletor de Avatar */}
                {isEditing && showAvatarSelector && (
                    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 animate-fade-in">
                        <p className="text-xs text-zinc-500 font-bold uppercase mb-3">Escolha ou Envie</p>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar mb-3">
                             <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-12 h-12 rounded-full bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center shrink-0 hover:border-brand-primary text-zinc-400 hover:text-brand-primary"
                            >
                                <Upload size={20} />
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
                            </button>
                            {PRESET_AVATARS.map((url, i) => {
                                const fullUrl = url.includes('=') ? url + profileUser.name : url + i;
                                return (
                                    <button key={i} onClick={() => { setEditAvatar(fullUrl); setShowAvatarSelector(false); }} className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-zinc-800 hover:border-brand-primary transition-colors">
                                        <img src={fullUrl} className="w-full h-full object-cover" />
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
                
                {/* Names */}
                <h1 className="text-2xl font-bold text-zinc-100">{profileUser.name}</h1>
                <p className="text-zinc-500 text-sm font-medium mb-4">@{profileUser.username}</p>

                {/* Actions (Friend/Block) */}
                {!isOwnProfile && (
                    <div className="flex items-center gap-3 mb-6">
                        {!isBlocked && (
                            <>
                                {friendshipStatus === 'accepted' ? (
                                    <button onClick={() => onStartChat && onStartChat(profileUser)} className="bg-brand-primary text-zinc-950 px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-brand-primary/20 hover:scale-105 transition-transform">
                                        <MessageCircle size={18} /> Mensagem
                                    </button>
                                ) : friendshipStatus === 'pending' ? (
                                    <button className="bg-zinc-800 text-zinc-400 px-6 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 cursor-default border border-zinc-700">
                                        <Check size={18} /> Pendente
                                    </button>
                                ) : (
                                    <button onClick={handleConnect} className="bg-zinc-100 text-zinc-950 px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform">
                                        <UserPlus size={18} /> Conectar
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={handleBlockToggle} className={`p-2.5 rounded-full border transition-all ${isBlocked ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400'}`}>
                            {isBlocked ? <Snowflake size={20} /> : <Ban size={20} />}
                        </button>
                    </div>
                )}

                {/* Bio */}
                {isEditing ? (
                    <div className="w-full mb-6">
                        <textarea 
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            placeholder="Escreva algo sobre você..."
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:border-brand-primary/50 outline-none resize-none h-24"
                            maxLength={150}
                        />
                        <div className="flex justify-end mt-1">
                            <span className="text-[10px] text-zinc-600">{editBio.length}/150</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-zinc-300 text-sm leading-relaxed text-center max-w-xs mb-8 opacity-80">
                        {profileUser.bio || (isOwnProfile ? "Toque no lápis para adicionar uma bio." : "Sem bio.")}
                    </p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 w-full mb-8">
                    <StatCard 
                        icon={<Users size={18} />} 
                        value={friendsCount} 
                        label="Amigos" 
                    />
                    <StatCard 
                        icon={<Zap size={18} />} 
                        value={userPulses.length} 
                        label="Vibes" 
                    />
                    {!isOwnProfile && resonanceScore > 0 ? (
                        <StatCard 
                            icon={<Radio size={18} />} 
                            value={`${resonanceScore}%`} 
                            label="Ressonância"
                            highlight 
                        />
                    ) : (
                         <StatCard 
                            icon={<Calendar size={18} />} 
                            value="2024" 
                            label="Desde" 
                        />
                    )}
                </div>

                {isOwnProfile && (
                     <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-500/60 hover:text-red-500 bg-red-500/5 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors mb-6">
                        <Trash2 size={12} /> Excluir Conta
                    </button>
                )}

            </div>
        </div>

        {/* Galeria de Vibes */}
        <div className="px-6 border-t border-zinc-900 pt-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <Activity size={14} className="text-brand-primary"/>
                Histórico de Vibe
            </h3>

            {userPulses.length === 0 ? (
                <div className="py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center">
                    <Zap size={24} className="text-zinc-700 mb-2" />
                    <p className="text-zinc-500 text-xs italic">Nenhuma vibe registrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {userPulses.map(pulse => (
                         <div 
                            key={pulse.id} 
                            onClick={() => handlePulseClick(pulse)}
                            className={`aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden relative border border-zinc-800/50 group ${!isOwnProfile && friendshipStatus === 'accepted' ? 'cursor-pointer active:scale-95 transition-transform hover:border-brand-primary/50' : ''}`}
                        >
                             {pulse.content_type === 'image' ? (
                                 <img src={pulse.content} className="w-full h-full object-cover" />
                             ) : (
                                 <div className="w-full h-full p-3 flex items-center justify-center text-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                                     <p className="text-[10px] text-zinc-300 font-serif italic line-clamp-5">"{pulse.content}"</p>
                                 </div>
                             )}
                             
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <p className="text-[10px] text-white/90 line-clamp-2 leading-tight">{pulse.description || pulse.content}</p>
                                {!isOwnProfile && friendshipStatus === 'accepted' && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-primary font-bold">
                                        <Reply size={10} /> Responder
                                    </div>
                                )}
                             </div>

                             {isOwnProfile && (
                                 <button 
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if(window.confirm("Apagar vibe?")) {
                                            const ok = await deletePulse(pulse.id);
                                            if(ok) removePulseFromList(pulse.id);
                                        }
                                    }}
                                    className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm p-2 rounded-full text-white/70 hover:text-red-400 hover:bg-black/80 transition-all"
                                 >
                                     <Trash2 size={12} /> 
                                 </button>
                             )}
                         </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default ProfileScreen;