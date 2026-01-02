import React, { useEffect, useState, useRef } from 'react';
import { User, Pulse } from '../types';
import { fetchPulses, getUserProfile, deletePulse, deleteMyAccount, toggleBlockUser, sendFriendRequest, removeFriend, updateUserProfileMeta } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, LogOut, Zap, Trash2, Ban, ShieldAlert, Snowflake, UserPlus, Check, MessageCircle, X, UserMinus, Edit2, Camera, Upload, Save, Palette, Reply } from 'lucide-react';

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

        const allPulses = await fetchPulses();
        const myPulses = allPulses.filter(p => p.user_id === uid);
        setUserPulses(myPulses);
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

  return (
    <div className={`min-h-full bg-zinc-950 pb-32 relative transition-all duration-700 ${isBlocked ? 'grayscale blur-[1px]' : ''}`}>
        
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
        {!isOwnProfile && (
            <div className="fixed top-4 left-4 z-50">
                <button 
                    onClick={onBack} 
                    className="w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-all border border-white/10 shadow-lg"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>
        )}

        {isOwnProfile && (
             <div className="fixed top-4 right-4 z-50 flex gap-2">
                 {isEditing ? (
                     <button onClick={handleSaveProfile} className="bg-brand-primary text-zinc-950 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                         <Save size={16} /> Salvar
                     </button>
                 ) : (
                     <>
                        <button onClick={() => setIsEditing(true)} className="w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full text-zinc-200 hover:text-white border border-white/10">
                            <Edit2 size={16} />
                        </button>
                        <button onClick={onSignOut} className="w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full text-zinc-400 hover:text-red-400 border border-white/10">
                            <LogOut size={16} />
                        </button>
                     </>
                 )}
            </div>
        )}

        {/* Banner */}
        <div className="h-40 w-full bg-gradient-to-b from-zinc-800 to-zinc-950 relative"></div>

        {/* Informações do Perfil */}
        <div className="px-6 flex flex-col items-start -mt-16 mb-6 relative z-10">
            
            <div className="relative mb-4 group">
                <div className="w-28 h-28 rounded-full border-[5px] border-zinc-950 bg-zinc-900 overflow-hidden shadow-2xl">
                    <img 
                        src={isEditing ? editAvatar : (profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`)} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                    />
                </div>
                {isEditing && (
                    <button 
                        onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                        className="absolute bottom-1 right-1 bg-brand-primary text-zinc-950 p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                        <Camera size={16} />
                    </button>
                )}
            </div>

            {/* Seletor de Avatar (Aparece ao clicar na camera) */}
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
            
            <div className="flex justify-between w-full items-start">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 leading-tight">{profileUser.name}</h1>
                    <p className="text-zinc-500 text-sm mb-4 font-medium">@{profileUser.username}</p>
                </div>
                
                {!isOwnProfile && (
                    <div className="flex flex-col gap-2 mt-2 items-end">
                        <div className="flex items-center gap-2">
                            {!isBlocked && (
                                <>
                                    {friendshipStatus === 'accepted' ? (
                                        <button onClick={() => onStartChat && onStartChat(profileUser)} className="bg-brand-primary text-zinc-950 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-primary/20">
                                            <MessageCircle size={16} /> Mensagem
                                        </button>
                                    ) : friendshipStatus === 'pending' ? (
                                        <button className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full font-medium text-xs flex items-center gap-2 cursor-default border border-zinc-700">
                                            <Check size={16} /> Pendente
                                        </button>
                                    ) : (
                                        <button onClick={handleConnect} className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform">
                                            <UserPlus size={16} /> Conectar
                                        </button>
                                    )}
                                </>
                            )}
                            <button onClick={handleBlockToggle} className={`p-2.5 rounded-full border transition-all ${isBlocked ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400'}`}>
                                {isBlocked ? <Snowflake size={20} /> : <Ban size={20} />}
                            </button>
                        </div>
                        {friendshipStatus === 'accepted' && !isBlocked && (
                            <button onClick={handleRemoveFriend} className="text-[10px] text-red-400/70 hover:text-red-400 flex items-center gap-1 font-medium pr-1">
                                <UserMinus size={12} /> Desfazer Amizade
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {isEditing ? (
                <div className="w-full">
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
                <p className="text-zinc-300 text-sm leading-relaxed max-w-md border-l-2 border-zinc-800 pl-3">
                    {profileUser.bio || (isOwnProfile ? "Toque no ícone de lápis para adicionar uma bio." : "Sem bio.")}
                </p>
            )}

            <div className="flex gap-8 mt-6 pb-6 w-full border-b border-zinc-900">
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-white">{userPulses.length}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Vibes</span>
                </div>
                {isOwnProfile && (
                    <div className="ml-auto">
                        <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-500/60 hover:text-red-500 bg-red-500/5 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} /> Excluir Conta
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Galeria de Vibes */}
        <div className="px-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <Zap size={14} className="text-brand-primary"/>
                Linha do Tempo
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