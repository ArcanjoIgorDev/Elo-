
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchFriendsLocations, updateUserProfileMeta, calculateDistance } from '../services/dataService';
import { User } from '../types';
import { ArrowLeft, LocateFixed, MapPin, Navigation, Compass, AlertTriangle, Loader2, Plus, Minus, Eye, EyeOff, Radio } from 'lucide-react';
import L from 'leaflet';

interface MapScreenProps {
  onBack: () => void;
  onViewProfile: (userId: string) => void;
}

const MapScreen: React.FC<MapScreenProps> = ({ onBack, onViewProfile }) => {
  const { user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const friendsLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);

  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showLines, setShowLines] = useState(true);
  const [friendsCount, setFriendsCount] = useState(0);

  useEffect(() => {
      // Inicializa o Mapa apenas uma vez
      if (mapContainerRef.current && !mapInstanceRef.current) {
          try {
              const map = L.map(mapContainerRef.current, {
                  zoomControl: false, 
                  attributionControl: false,
                  center: [-14.2350, -51.9253], // Centro do Brasil Default
                  zoom: 4,
                  minZoom: 3,
                  maxZoom: 18,
                  zoomAnimation: true
              });

              // Adiciona Camada de Tiles Hacker
              L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                  className: 'hacker-map-tiles', // CSS Class definida no index.html
                  subdomains: 'abcd',
                  maxZoom: 20
              }).addTo(map);

              mapInstanceRef.current = map;
              friendsLayerRef.current = L.layerGroup().addTo(map);
              linesLayerRef.current = L.layerGroup().addTo(map);
          } catch (e) {
              console.error("Erro ao inicializar mapa Leaflet:", e);
          }
      }

      // Prioridade: Localização do DB > GPS
      initializeLocationStrategy();

      return () => {
          if (mapInstanceRef.current) {
              mapInstanceRef.current.remove();
              mapInstanceRef.current = null;
          }
      };
  }, []);

  useEffect(() => {
      if (linesLayerRef.current) {
          if (showLines) {
             drawConnectionLines();
          } else {
             linesLayerRef.current.clearLayers();
          }
      }
  }, [showLines, myLocation]);

  const initializeLocationStrategy = async () => {
      setLoading(true);
      
      // 1. Tenta usar a localização salva no perfil do usuário (Banco de Dados)
      if (user?.latitude && user?.longitude) {
          // Usa localização salva
          const lat = user.latitude;
          const lng = user.longitude;
          updateMyMapPosition(lat, lng);
          setLoading(false);
      } else {
          // 2. Se não tiver, tenta o GPS
          tryGPS();
      }
  };

  const tryGPS = () => {
      if (!navigator.geolocation) {
          setPermissionDenied(true);
          setLoading(false);
          return;
      }

      navigator.geolocation.getCurrentPosition(
          async (position) => {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              
              // Se obtivermos GPS com sucesso e não tínhamos nada, salvamos
              if (user) {
                  updateUserProfileMeta(user.id, { latitude: lat, longitude: lng });
              }
              
              updateMyMapPosition(lat, lng);
              setLoading(false);
          },
          (err) => {
              console.error(err);
              setPermissionDenied(true);
              setLoading(false);
          }
      );
  }

  const updateMyMapPosition = async (lat: number, lng: number) => {
      setMyLocation({ lat, lng });

      if (mapInstanceRef.current) {
          // Atualiza Marcador do Usuário (VOCÊ)
          const myIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div class="relative flex items-center justify-center w-8 h-8">
                    <div class="absolute w-full h-full bg-brand-primary/20 rounded-full radar-pulse"></div>
                    <div class="absolute w-3 h-3 bg-brand-primary rounded-full border border-black shadow-[0_0_15px_#10b981]"></div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
          });

          if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([lat, lng]);
          } else {
              userMarkerRef.current = L.marker([lat, lng], { icon: myIcon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
          }

          // Centraliza suavemente
          mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
      }

      // Busca e Plota Amigos
      await plotFriends();
  };

  const plotFriends = async () => {
      if (!user || !mapInstanceRef.current || !friendsLayerRef.current) return;
      
      const friends = await fetchFriendsLocations(user.id);
      setFriendsCount(friends.length);
      friendsLayerRef.current.clearLayers();
      (window as any).cachedFriends = friends; 

      friends.forEach(friend => {
          if (friend.latitude && friend.longitude) {
              // Marcador do Amigo
              const friendIcon = L.divIcon({
                  className: 'friend-marker',
                  html: `
                    <div class="relative group cursor-pointer transition-transform hover:scale-110">
                        <div class="absolute -inset-1 rounded-full bg-gradient-to-r from-brand-secondary to-transparent opacity-0 group-hover:opacity-50 blur-md transition-opacity"></div>
                        <img src="${friend.avatar_url}" class="w-10 h-10 rounded-full border-2 border-zinc-600 grayscale hover:grayscale-0 hover:border-brand-primary transition-all object-cover bg-zinc-900 shadow-2xl relative z-10" />
                        <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-0.5 rounded text-[8px] text-brand-primary font-mono border border-brand-primary/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                            ${friend.username}
                        </div>
                    </div>
                  `,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
              });

              const marker = L.marker([friend.latitude, friend.longitude], { icon: friendIcon });
              marker.on('click', () => onViewProfile(friend.id));
              marker.addTo(friendsLayerRef.current!);
          }
      });

      if (showLines) drawConnectionLines();
  };

  const drawConnectionLines = () => {
      const friends = (window as any).cachedFriends as User[] || [];
      if (!myLocation || !mapInstanceRef.current || !linesLayerRef.current) return;

      linesLayerRef.current.clearLayers();

      friends.forEach(friend => {
          if (friend.latitude && friend.longitude) {
              const dist = calculateDistance(myLocation.lat, myLocation.lng, friend.latitude, friend.longitude);
              
              const latlngs = [
                  [myLocation.lat, myLocation.lng],
                  [friend.latitude, friend.longitude]
              ];

              // Linha com animação de fluxo (classe definida no HTML global)
              L.polyline(latlngs as any, {
                  color: '#10b981', // Brand Primary
                  weight: 2,
                  opacity: 0.6,
                  className: 'connection-line-flow' 
              }).addTo(linesLayerRef.current!);

              // Adiciona Label de Distância no meio da linha
              const centerLat = (myLocation.lat + friend.latitude) / 2;
              const centerLng = (myLocation.lng + friend.longitude) / 2;
              
              const distIcon = L.divIcon({
                  className: 'dist-label',
                  html: `<div class="bg-black/90 text-brand-primary text-[8px] px-1.5 py-0.5 rounded-full border border-brand-primary/30 font-mono shadow-[0_0_10px_rgba(0,0,0,0.8)] backdrop-blur-md whitespace-nowrap">${dist < 1 ? (dist*1000).toFixed(0)+'m' : dist.toFixed(1)+'km'}</div>`,
                  iconSize: [40, 12],
                  iconAnchor: [20, 6]
              });

              L.marker([centerLat, centerLng], { icon: distIcon, zIndexOffset: -100 }).addTo(linesLayerRef.current!);
          }
      });
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <div className="h-full bg-zinc-950 flex flex-col relative overflow-hidden">
        
        <style>{`
            .leaflet-container { background: #050505 !important; }
            .leaflet-control-container .leaflet-routing-container-hide { display: none; }
        `}</style>

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 w-full z-[1000] p-4 pt- safe flex justify-between items-center pointer-events-none">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full text-white border border-white/10 pointer-events-auto hover:bg-brand-primary/20 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col items-center pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-brand-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <h1 className="text-xs font-bold text-brand-primary tracking-widest uppercase flex items-center gap-2 font-mono">
                    <Radio size={12} className="animate-pulse"/> BRAZIL_NET_V2
                </h1>
                {myLocation && <span className="text-[8px] text-zinc-400 font-mono tracking-tighter">LAT:{myLocation.lat.toFixed(4)} • LNG:{myLocation.lng.toFixed(4)}</span>}
            </div>
            <div className="w-10"></div> 
        </div>

        {/* Map Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0 outline-none" />

        {/* Loading Overlay */}
        {loading && (
            <div className="absolute inset-0 z-[1001] bg-black/90 flex flex-col items-center justify-center backdrop-blur-md">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <Loader2 size={48} className="text-brand-primary animate-spin relative z-10" />
                </div>
                <p className="text-brand-primary font-mono text-xs mt-4 tracking-widest animate-pulse">TRIANGULANDO SINAL...</p>
            </div>
        )}

        {/* Permission Error */}
        {permissionDenied && !loading && !myLocation && (
            <div className="absolute inset-0 z-[1001] bg-black/90 flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle size={40} className="text-red-500 mb-4" />
                <h3 className="text-white font-bold mb-2 font-mono">SEM SINAL DE SATÉLITE</h3>
                <p className="text-zinc-500 text-xs mb-6 max-w-xs">Não foi possível detectar sua localização atual e você não possui uma salva no perfil.</p>
                <button onClick={tryGPS} className="bg-brand-primary text-black px-6 py-2 rounded font-bold font-mono text-xs hover:bg-emerald-400">TENTAR NOVAMENTE</button>
            </div>
        )}

        {/* Controls Overlay (Bottom Right) */}
        <div className="absolute bottom-24 right-4 z-[999] flex flex-col gap-3">
             
             {/* Toggle Lines */}
             <button 
                onClick={() => setShowLines(!showLines)}
                className={`w-12 h-12 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all ${showLines ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-black/60 border-zinc-700 text-zinc-500'}`}
             >
                 {showLines ? <Eye size={20} /> : <EyeOff size={20} />}
             </button>

             {/* Zoom Controls */}
             <div className="flex flex-col rounded-lg overflow-hidden border border-zinc-700 bg-black/60 backdrop-blur-md">
                 <button onClick={handleZoomIn} className="w-12 h-12 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 border-b border-zinc-700 active:bg-brand-primary/20">
                     <Plus size={20} />
                 </button>
                 <button onClick={handleZoomOut} className="w-12 h-12 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-brand-primary/20">
                     <Minus size={20} />
                 </button>
             </div>

             {/* Locate Me (Forces GPS) */}
             <button 
                onClick={tryGPS}
                className="w-12 h-12 rounded-lg bg-black/60 backdrop-blur-md border border-brand-primary/30 flex items-center justify-center text-brand-primary hover:bg-brand-primary/10 transition-all active:scale-95 group"
             >
                 <LocateFixed size={20} className="group-hover:animate-spin" />
             </button>
        </div>

        {/* Grid Overlay Effect (Hacker Aesthetics) */}
        <div className="absolute inset-0 z-[500] pointer-events-none opacity-20 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute bottom-24 left-4 z-[999] pointer-events-none">
             <div className="bg-black/80 border border-brand-primary/20 px-3 py-2 rounded text-[9px] font-mono text-brand-primary/70 backdrop-blur-md shadow-lg">
                 NODES_ATIVOS: {friendsCount}<br/>
                 SEGURANÇA: CRIPTOGRAFADO<br/>
                 MODO: {myLocation && user?.latitude ? 'PERFIL_FIXO' : 'GPS_AUTO'}
             </div>
        </div>

    </div>
  );
};

export default MapScreen;
