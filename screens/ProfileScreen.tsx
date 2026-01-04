
import React, { useEffect, useState, useRef } from 'react';
import { User, Pulse, ActivityPoint, FriendDetail } from '../types';
import { fetchPulses, getUserProfile, updateUserProfileMeta, getFriendsCount, fetchUserChats, fetchUserResonance, sendFriendRequest, calculateDistance, fetchFriendsDetailed, formatDisplayName } from '../services/dataService';
import { searchCities, getCityCoordinates } from '../services/locationData'; 
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Zap, UserPlus, Check, MessageCircle, Edit2, Camera, Upload, Save, Settings, Users, Activity, Hexagon, Grid, Layers, Share2, BarChart3, Fingerprint, MapPin, GraduationCap, Globe, LocateFixed, Search, Loader2, Calendar, QrCode, X } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, CartesianGrid, XAxis } from 'recharts';

interface ProfileScreenProps {
  targetUserId?: string;
  onBack: () => void;
  onSettings: () => void;
  onStartChat?: (user: User, initialContext?: string) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ targetUserId, onBack, onSettings, onStartChat }) => {
  const { user, updateUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPulses, setUserPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [friendsCount, setFriendsCount] = useState(0);
  const [resonanceScore, setResonanceScore] = useState(0); 
  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  const [identityChips, setIdentityChips] = useState<{label: string, color: string, icon: any}[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [friendsList, setFriendsList] = useState<FriendDetail[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'vibes' | 'map' | 'friends'>('overview');
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  
  // Location Non-AI State
  const [editCity, setEditCity] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const PRESET_AVATARS = [
      'https://ui-avatars.com/api/?background=10b981&color=fff&name=',
      'https://ui-avatars.com/api/?background=6366f1&color=fff&name=',
      'https://ui-avatars.com/api/?background=18181b&color=fff&name=',
  ];

  useEffect(() => {
    const loadProfile = async () => {
        setLoading(true);
        const uid = targetUserId || user?.id;
        if(!uid) return;

        let currentUserData = user;
        let targetUserData = null;

        if (!isOwnProfile && user) {
            const myProfile = await getUserProfile(user.id, user.id);
            if (myProfile) currentUserData = myProfile.user;
        }

        if (isOwnProfile && currentUserData) {
            setProfileUser(currentUserData);
            setEditBio(currentUserData.bio || '');
            setEditAvatar(currentUserData.avatar_url || '');
            setEditCity(currentUserData.city || '');
            setEditEducation(currentUserData.education || '');
        } else {
            const result = await getUserProfile(uid, user!.id);
            if (result) {
                setProfileUser(result.user);
                targetUserData = result.user;
                if (result.friendship) {
                    setFriendshipStatus(result.friendship.status);
                    setIsBlocked(result.friendship.status === 'blocked' && result.friendship.blocked_by === user!.id);
                } else {
                    setFriendshipStatus(null);
                }
            }
        }

        if (!isOwnProfile && currentUserData?.latitude && currentUserData?.longitude && targetUserData?.latitude && targetUserData?.longitude) {
            const km = calculateDistance(currentUserData.latitude, currentUserData.longitude, targetUserData.latitude, targetUserData.longitude);
            setDistanceKm(km);
        }

        const allPulses = await fetchPulses();
        const myPulses = allPulses.filter(p => p.user_id === uid);
        setUserPulses(myPulses);
        
        const count = await getFriendsCount(uid);
        setFriendsCount(count);
        
        const realActivity = await fetchUserResonance(uid);
        setActivityData(realActivity);

        setLoadingFriends(true);
        fetchFriendsDetailed(uid).then((list) => {
            setFriendsList(list);
            setLoadingFriends(false);
        });

        const chips = [];
        if (myPulses.length > 5) chips.push({ label: 'VIBE MAKER', color: 'from-brand-primary to-emerald-600', icon: Zap });
        if (count > 3) chips.push({ label: 'HUB', color: 'from-blue-500 to-indigo-600', icon: Users });
        if (myPulses.some(p => p.content_type === 'image')) chips.push({ label: 'VISUAL', color: 'from-pink-500 to-rose-600', icon: Camera });
        setIdentityChips(chips);

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
          if (success) {
              setFriendshipStatus('pending');
              alert("Pedido enviado!");
          } else {
              alert("Não foi possível enviar o pedido. Verifique se vocês já são amigos ou se há um pedido pendente.");
          }
      }
  };

  const handleCityChange = (val: string) => {
      setEditCity(val);
      if (val.length < 2) {
          setShowLocationResults(false);
          setLocationSuggestions([]);
          return;
      }
      
      const results = searchCities(val); 
      setLocationSuggestions(results);
      setShowLocationResults(results.length > 0);
  };

  const selectLocation = (loc: string) => {
      setEditCity(loc);
      setShowLocationResults(false);
  };

  const handleSaveProfile = async () => {
      if(!user) return;
      setUpdatingLocation(true);

      const updates: any = { 
          bio: editBio, 
          avatar_url: editAvatar,
          city: editCity,
          education: editEducation
      };

      if (editCity && editCity !== profileUser?.city) {
          const coords = await getCityCoordinates(editCity);
          if (coords) {
              updates.latitude = coords.latitude;
              updates.longitude = coords.longitude;
          }
      }

      await updateUserProfileMeta(user.id, updates);
      updateUser(updates);
      setProfileUser(prev => prev ? {...prev, ...updates} : null);
      setIsEditing(false);
      setUpdatingLocation(false);
  };

  const handleForceGPS = () => {
      if (!navigator.geolocation || !user) return;
      setUpdatingLocation(true);
      navigator.geolocation.getCurrentPosition(
          async (pos) => {
              const { latitude, longitude } = pos.coords;
              await updateUserProfileMeta(user.id, { latitude, longitude });
              setProfileUser(prev => prev ? {...prev, latitude, longitude} : null);
              setUpdatingLocation(false);
          },
          (err) => {
              console.error(err);
              setUpdatingLocation(false);
          }
      );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => { setEditAvatar(reader.result as string); setShowAvatarSelector(false); };
        reader.readAsDataURL(file);
    }
  };

  if (loading || !profileUser) {
      return <div className="flex items-center justify-center h-full bg-zinc-950"><div className="w-6 h-6 border-2 border-zinc-100 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className={`h-full bg-zinc-950 flex flex-col relative overflow-hidden ${isBlocked ? 'grayscale' : ''}`}>
        
        {/* Abstract Dynamic Background */}
        <div className="absolute top-0 left-0 w-full h-[350px] z-0 overflow-hidden pointer-events-none">
             <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950"></div>
             <div className="absolute -top-20 -left-20 w-80 h-80 bg-brand-primary/10 rounded-full blur-[80px] opacity-60 mix-blend-screen"></div>
             <div className="absolute top-10 right-0 w-64 h-64 bg-brand-secondary/10 rounded-full blur-[80px] opacity-60 mix-blend-screen"></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        </div>

        {/* Header Actions */}
        <div className="absolute top-0 left-0 w-full z-50 p-4 pt- safe flex justify-between items-center">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-white border border-white/10 hover:bg-white/10 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div className="flex gap-2">
                 {!isEditing && (
                    <button onClick={() => setShowQrModal(true)} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-zinc-200 hover:text-white border border-white/10"><QrCode size={16}/></button>
                 )}
                 {isOwnProfile && (
                     <>
                         {isEditing ? (
                             <button onClick={handleSaveProfile} disabled={updatingLocation} className="bg-white text-black px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50">
                                 {updatingLocation ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />} 
                                 {updatingLocation ? 'Calculando...' : 'Salvar'}
                             </button>
                         ) : (
                             <>
                                <button onClick={() => setIsEditing(true)} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-zinc-200 hover:text-white border border-white/10"><Edit2 size={16} /></button>
                                <button onClick={onSettings} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-zinc-200 hover:text-white border border-white/10"><Settings size={16} /></button>
                             </>
                         )}
                    </>
                )}
            </div>
        </div>

        {/* ELO ID Modal */}
        {showQrModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowQrModal(false)}>
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] w-full max-w-sm relative overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent"></div>
                    <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                    
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 mb-2 bg-zinc-800/50 px-3 py-1 rounded-full border border-white/5">
                            <Hexagon size={14} className="fill-brand-primary text-brand-primary rotate-90"/>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-300">ELO ID</span>
                        </div>
                        <h2 className="text-2xl font-black text-white">{profileUser.username?.toUpperCase()}</h2>
                        <p className="text-zinc-500 text-xs mt-1">Identidade Digital Verificada</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl mx-auto w-48 h-48 mb-6 shadow-inner relative group">
                        <div className="absolute inset-0 border-[4px] border-brand-primary/20 rounded-2xl"></div>
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brand-primary"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brand-primary"></div>
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brand-primary"></div>
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brand-primary"></div>
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=elo_user:${profileUser.id}&bgcolor=ffffff&color=000000&margin=0`} 
                            className="w-full h-full object-contain mix-blend-multiply" 
                            alt="QR Code"
                        />
                    </div>
                    
                    <div className="flex items-center gap-4 bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                        <img src={profileUser.avatar_url} className="w-10 h-10 rounded-full bg-zinc-800" />
                        <div className="text-left flex-1">
                             <p className="text-xs text-zinc-400 font-mono">HASH: {profileUser.id.substring(0,8)}...</p>
                             <p className="text-[10px] text-brand-primary font-bold">STATUS: ATIVO</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto z-10 no-scrollbar pt-20">
            <div className="px-6 flex flex-col items-center">
                
                {/* Avatar with Glow */}
                <div className="relative mb-4 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-white/10 to-transparent relative">
                         <img 
                            src={isEditing ? editAvatar : (profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.name}&background=random`)} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full bg-zinc-950 border-4 border-zinc-950"
                        />
                        {isEditing && (
                            <button onClick={() => setShowAvatarSelector(!showAvatarSelector)} className="absolute bottom-1 right-1 bg-white text-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform"><Camera size={14} /></button>
                        )}
                    </div>
                </div>

                {/* Avatar Selector Panel */}
                {isEditing && showAvatarSelector && (
                    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 animate-fade-in backdrop-blur-md">
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center shrink-0 hover:border-brand-primary text-zinc-400 hover:text-brand-primary"><Upload size={20} /><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/></button>
                                {PRESET_AVATARS.map((url, i) => {
                                    const fullUrl = url + (i + 1);
                                    return ( <button key={i} onClick={() => { setEditAvatar(fullUrl); setShowAvatarSelector(false); }} className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-zinc-800 hover:border-brand-primary transition-colors"><img src={fullUrl} className="w-full h-full object-cover" /></button>)
                                })}
                        </div>
                    </div>
                )}

                {/* Name & Bio */}
                <h1 className="text-3xl font-bold text-white tracking-tight mb-1 text-center">{formatDisplayName(profileUser.name)}</h1>
                <p className="text-zinc-400 text-sm font-medium mb-4">@{profileUser.username}</p>
                
                {/* Identity Badges */}
                <div className="flex gap-2 mb-6 flex-wrap justify-center">
                    {identityChips.map((chip, idx) => (
                        <div key={idx} className={`pl-1.5 pr-2.5 py-1 rounded-full border border-white/5 bg-zinc-900/50 backdrop-blur-md flex items-center gap-1.5 shadow-lg`}>
                            <div className={`p-1 rounded-full bg-gradient-to-br ${chip.color}`}><chip.icon size={8} className="text-white" /></div>
                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-300">{chip.label}</span>
                        </div>
                    ))}
                    {identityChips.length === 0 && <span className="text-[10px] text-zinc-600 font-mono border border-zinc-800 px-3 py-1 rounded-full">NOVATO</span>}
                </div>

                {isEditing ? (
                    <div className="w-full space-y-3 mb-6 relative">
                        <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Escreva sobre sua vibe..." className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:border-brand-primary/50 outline-none resize-none h-20" maxLength={150} />
                        <div className="grid grid-cols-1 gap-3">
                            <input value={editEducation} onChange={(e) => setEditEducation(e.target.value)} placeholder="Formação / Cargo" className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 outline-none focus:border-brand-primary/50" />
                            <div className="relative z-20">
                                <div className="relative group">
                                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-primary transition-colors"/>
                                    <input 
                                        value={editCity} 
                                        onChange={(e) => handleCityChange(e.target.value)} 
                                        onFocus={() => setShowLocationResults(true)}
                                        placeholder="Cidade - Estado" 
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-9 pr-9 py-3 text-xs text-zinc-200 outline-none focus:border-brand-primary/50 transition-colors" 
                                    />
                                </div>
                                {showLocationResults && locationSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-30 max-h-48 overflow-y-auto">
                                        <div className="px-3 py-2 text-[9px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-950/50 flex items-center justify-between"><span>Sugestões</span><Globe size={10} /></div>
                                        {locationSuggestions.map((loc, i) => (
                                            <button key={i} onClick={() => selectLocation(loc)} className="w-full text-left px-4 py-3 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white border-b border-white/5 last:border-0 transition-colors flex items-center gap-2 group">
                                                <MapPin size={12} className="text-zinc-500 group-hover:text-brand-primary transition-colors"/> <span className="truncate">{loc}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {isOwnProfile && (
                            <button onClick={handleForceGPS} className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-brand-secondary/80 font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 mt-2"><LocateFixed size={14} /> Usar GPS Atual (Substituir Texto)</button>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text-zinc-400 text-sm text-center max-w-sm mb-4 leading-relaxed opacity-90">{profileUser.bio || "Explorador do ELO."}</p>
                        <div className="flex gap-4 mb-8 text-xs text-zinc-500">
                            {profileUser.city && <div className="flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50 text-brand-primary/80"><MapPin size={12} className="text-brand-primary"/> {profileUser.city}</div>}
                            {profileUser.education && <div className="flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50"><GraduationCap size={12} className="text-brand-accent"/> {profileUser.education}</div>}
                        </div>
                    </>
                )}

                {!isOwnProfile && !isBlocked && (
                    <div className="flex gap-3 mb-8 w-full justify-center">
                        {friendshipStatus === 'accepted' ? (
                            <button onClick={() => onStartChat && onStartChat(profileUser)} className="bg-white text-black px-8 py-3.5 rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform flex items-center gap-2"><MessageCircle size={18} /> Chat</button>
                        ) : friendshipStatus === 'pending' ? (
                            <button className="bg-zinc-800 text-zinc-500 px-8 py-3.5 rounded-2xl font-medium text-sm border border-zinc-700 cursor-not-allowed flex items-center gap-2"><Check size={18} /> Pendente</button>
                        ) : (
                            <button onClick={handleConnect} className="bg-brand-primary text-zinc-950 px-8 py-3.5 rounded-2xl font-bold text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center gap-2"><UserPlus size={18} /> Conectar</button>
                        )}
                        <button className="bg-zinc-900 text-zinc-300 p-3.5 rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-colors"><Share2 size={18} /></button>
                    </div>
                )}

                <div className="w-full flex p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-6 backdrop-blur-sm overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[80px] py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Grid size={14} /> Geral</button>
                    <button onClick={() => setActiveTab('vibes')} className={`flex-1 min-w-[80px] py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'vibes' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Layers size={14} /> Vibes</button>
                    <button onClick={() => setActiveTab('friends')} className={`flex-1 min-w-[80px] py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'friends' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Users size={14} /> Conexões</button>
                    {!isOwnProfile && distanceKm !== null && <button onClick={() => setActiveTab('map')} className={`flex-1 min-w-[80px] py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Globe size={14} /> Mapa</button>}
                </div>

                <div className="w-full pb-24">
                    {activeTab === 'overview' ? (
                        <div className="animate-fade-in space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Fingerprint className="text-zinc-600 mb-2" size={20} />
                                    <h4 className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Único</h4>
                                    <p className="text-zinc-200 font-mono text-xs truncate">#{profileUser.id.substring(0,8)}</p>
                                </div>
                                <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl relative overflow-hidden group">
                                     <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Users className="text-zinc-600 mb-2" size={20} />
                                    <h4 className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Círculo</h4>
                                    <p className="text-2xl font-bold text-white">{friendsCount}</p>
                                </div>
                                <div className="col-span-2 bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-4">
                                        <div><h4 className="text-zinc-200 text-xs font-bold flex items-center gap-2"><BarChart3 size={14} className="text-brand-primary"/> Ressonância (7D)</h4></div>
                                        {resonanceScore > 0 && <span className="bg-brand-primary/20 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded">{resonanceScore}% Match</span>}
                                    </div>
                                    <div className="h-28 w-full">
                                        {activityData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={activityData}>
                                                    <defs><linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                                                    <XAxis dataKey="fullDate" tick={{fontSize: 9, fill: '#52525b'}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex items-center justify-center h-full text-zinc-600 text-[10px]">Sem dados suficientes.</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'vibes' ? (
                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                            {userPulses.map(pulse => (
                                <div key={pulse.id} className="aspect-[3/4] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative group cursor-pointer transition-all hover:border-zinc-600">
                                    {pulse.content_type === 'image' ? (
                                        <img src={pulse.content} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full p-4 flex items-center justify-center text-center bg-gradient-to-b from-zinc-800 to-zinc-900">
                                            <p className="text-[10px] text-zinc-300 font-medium leading-relaxed">"{pulse.content}"</p>
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-[9px] text-white border border-white/5 font-mono">
                                        {new Date(pulse.created_at).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                                    </div>
                                </div>
                            ))}
                            {userPulses.length === 0 && <div className="col-span-2 py-12 text-center"><p className="text-zinc-600 text-xs">Nenhuma vibe registrada.</p></div>}
                        </div>
                    ) : activeTab === 'friends' ? (
                        <div className="animate-fade-in min-h-[200px]">
                            {loadingFriends ? (
                                <div className="text-center py-10"><Loader2 className="animate-spin text-zinc-500 mx-auto" size={24}/></div>
                            ) : friendsList.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">Nenhuma conexão encontrada.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {friendsList.map(friend => (
                                        <div key={friend.id} onClick={() => onStartChat && onStartChat(friend)} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-800 cursor-pointer transition-all group hover:border-zinc-700">
                                            <div className="relative">
                                                <img src={friend.avatar_url} className="w-12 h-12 rounded-full object-cover border border-zinc-800 group-hover:border-brand-primary transition-colors bg-zinc-950" />
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-brand-primary rounded-full border-2 border-zinc-900"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-zinc-100 text-sm truncate">{formatDisplayName(friend.name)}</h4>
                                                <p className="text-zinc-500 text-xs truncate">@{friend.username}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[9px] bg-zinc-950 px-2 py-0.5 rounded text-zinc-400 font-mono border border-zinc-800">
                                                        {friend.friendship_duration_days}d
                                                    </span>
                                                    {friend.city && <span className="text-[9px] text-zinc-500 flex items-center gap-0.5"><MapPin size={8}/>{friend.city}</span>}
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-brand-primary group-hover:border-brand-primary transition-all">
                                                <MessageCircle size={18} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="w-full aspect-square bg-zinc-950 rounded-full border-2 border-zinc-800 relative overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.05)] mb-4">
                                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>
                                <div className="absolute w-2/3 h-2/3 border border-dashed border-zinc-800 rounded-full opacity-50 animate-pulse-slow"></div>
                                <div className="absolute w-1/3 h-1/3 border border-zinc-800 rounded-full opacity-30"></div>
                                <div className="absolute w-3 h-3 bg-white rounded-full z-10 shadow-[0_0_15px_white]"></div>
                                <div className="absolute mt-8 text-[9px] font-bold text-zinc-500">ALVO</div>
                                <div className="absolute w-full h-full animate-[spin_60s_linear_infinite]">
                                     <div className="absolute top-[20%] right-[20%] w-4 h-4 bg-brand-primary rounded-full shadow-[0_0_20px_#10b981] z-10 animate-pulse"></div>
                                     <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        <line x1="50%" y1="50%" x2="80%" y2="20%" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" className="opacity-50" />
                                     </svg>
                                </div>
                                <div className="absolute bottom-6 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-brand-primary/30 text-brand-primary font-mono text-xs font-bold">
                                    {distanceKm} km
                                </div>
                            </div>
                            <p className="text-center text-[10px] text-zinc-600 max-w-[200px] mx-auto">
                                Distância calculada via satélite neural. Conexão física estabelecida.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProfileScreen;
