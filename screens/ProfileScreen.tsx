import React, { useEffect, useState } from 'react';
import { User, Pulse } from '../types';
import { fetchPulses, getUserProfile, deletePulse, deleteMyAccount, toggleBlockUser, sendFriendRequest } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, LogOut, Zap, Trash2, Ban, ShieldAlert, Snowflake, UserPlus, Check, MessageCircle } from 'lucide-react';

interface ProfileScreenProps {
  targetUserId?: string; // If null, shows own profile
  onBack: () => void;
  onSignOut: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ targetUserId, onBack, onSignOut }) => {
  const { user, signOut } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPulses, setUserPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para ações
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null); // 'pending', 'accepted', 'blocked'
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  useEffect(() => {
    const loadProfile = async () => {
        setLoading(true);
        const uid = targetUserId || user?.id;
        if(!uid) return;

        if (isOwnProfile && user) {
            setProfileUser(user);
        } else {
            // Se for outro usuário, buscamos também o status da amizade para saber se está bloqueado
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
          await signOut(); // O usuário já foi deletado do banco, isso limpa a sessão local
          alert("Sua conta foi excluída e seus dados removidos.");
      } else {
          setLoading(false);
          alert("Erro ao excluir conta. Tente novamente.");
      }
  };

  const handleBlockToggle = async () => {
      if(!friendshipId || !user) return;
      const newStatus = !isBlocked;
      setIsBlocked(newStatus); // Optimistic Update
      const success = await toggleBlockUser(friendshipId, newStatus, user.id);
      if(!success) setIsBlocked(!newStatus); // Revert
  };

  const handleConnect = async () => {
      if(user && profileUser && !friendshipStatus) {
          const success = await sendFriendRequest(user.id, profileUser.id);
          if (success) setFriendshipStatus('pending');
      }
  };

  if (loading) {
      return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-zinc-100 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profileUser) return <div className="p-10 text-center text-zinc-500">Usuário não encontrado.</div>;

  return (
    <div className={`min-h-full bg-zinc-950 pb-20 relative transition-all duration-700 ${isBlocked ? 'grayscale blur-[1px]' : ''}`}>
        
        {/* Efeito de Gelo Inovador se Bloqueado */}
        {isBlocked && (
            <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-100/5 mix-blend-overlay"></div>
                <div className="bg-zinc-950/80 p-6 rounded-3xl border border-blue-500/30 backdrop-blur-md flex flex-col items-center animate-in zoom-in duration-300">
                    <Snowflake size={40} className="text-blue-400 mb-2 animate-pulse" />
                    <p className="text-blue-200 font-bold tracking-widest text-sm">CONEXÃO CONGELADA</p>
                </div>
            </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
                <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-3xl max-w-sm w-full shadow-2xl shadow-red-900/20">
                    <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <ShieldAlert className="text-red-500" size={24} />
                    </div>
                    <h3 className="text-red-500 font-bold text-lg text-center mb-2">Zona de Perigo</h3>
                    <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
                        Isso excluirá permanentemente seu perfil, posts e amizades. 
                        Suas mensagens antigas ficarão anônimas. O nome de usuário 
                        <strong className="text-zinc-200"> @{profileUser.username} </strong> será liberado.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700">Cancelar</button>
                        <button onClick={handleDeleteAccount} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700">Confirmar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Banner */}
        <div className="h-32 w-full bg-gradient-to-b from-zinc-800 to-zinc-950 relative">
             <div className="absolute top-4 left-4 z-10">
                {!isOwnProfile && (
                    <button onClick={onBack} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                )}
            </div>
            {isOwnProfile && (
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onSignOut} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-zinc-400 hover:text-white hover:bg-black/60 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            )}
        </div>

        {/* Informações do Perfil */}
        <div className="px-6 flex flex-col items-start -mt-12 mb-6 relative z-10">
            <div className="w-24 h-24 rounded-full border-4 border-zinc-950 bg-zinc-900 overflow-hidden shadow-lg mb-4">
                <img 
                    src={profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                />
            </div>
            
            <div className="flex justify-between w-full items-start">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 leading-tight">{profileUser.name}</h1>
                    <p className="text-zinc-500 text-sm mb-4 font-medium">@{profileUser.username}</p>
                </div>
                
                {/* Ações para Outros Usuários */}
                {!isOwnProfile && (
                    <div className="flex items-center gap-2">
                        {/* Botão de Amizade */}
                        {!isBlocked && (
                            <>
                                {friendshipStatus === 'accepted' ? (
                                    <button 
                                        onClick={onBack} // Simplesmente volta para home onde pode ir pro chat
                                        className="bg-brand-primary text-zinc-950 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-primary/20"
                                    >
                                        <MessageCircle size={16} />
                                        Mensagem
                                    </button>
                                ) : friendshipStatus === 'pending' ? (
                                    <button className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full font-medium text-xs flex items-center gap-2 cursor-default">
                                        <Check size={16} />
                                        Pendente
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleConnect}
                                        className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform"
                                    >
                                        <UserPlus size={16} />
                                        Conectar
                                    </button>
                                )}
                            </>
                        )}

                        <button 
                            onClick={handleBlockToggle}
                            className={`p-2.5 rounded-full border transition-all ${
                                isBlocked 
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-900/50'
                            }`}
                            title={isBlocked ? "Desbloquear" : "Bloquear"}
                        >
                            {isBlocked ? <Snowflake size={20} /> : <Ban size={20} />}
                        </button>
                    </div>
                )}
            </div>
            
            <p className="text-zinc-300 text-sm leading-relaxed max-w-md border-l-2 border-zinc-800 pl-3">
                {profileUser.bio || (isOwnProfile ? "Sua bio é seu cartão de visita no ELO." : "Sem bio.")}
            </p>

            <div className="flex gap-8 mt-6 pb-6 w-full border-b border-zinc-900">
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-white">{userPulses.length}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Vibes</span>
                </div>
                {isOwnProfile && (
                    <div className="ml-auto">
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-500/60 hover:text-red-500 bg-red-500/5 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 size={12} />
                            Excluir Conta
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
                         <div key={pulse.id} className="aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden relative border border-zinc-800/50 group">
                             {pulse.content_type === 'image' ? (
                                 <img src={pulse.content} className="w-full h-full object-cover" />
                             ) : (
                                 <div className="w-full h-full p-3 flex items-center justify-center text-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                                     <p className="text-[10px] text-zinc-300 font-serif italic line-clamp-5">"{pulse.content}"</p>
                                 </div>
                             )}
                             
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <p className="text-[10px] text-white/90 line-clamp-2 leading-tight">{pulse.description || pulse.content}</p>
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
                                    className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm p-1.5 rounded-full text-white/50 hover:text-red-400 hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all"
                                 >
                                     <LogOut size={12} /> 
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