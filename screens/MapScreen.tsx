
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchFriendsLocations, updateUserProfileMeta, calculateDistance } from '../services/dataService';
import { User } from '../types';
import { ArrowLeft, LocateFixed, MapPin, Plus, Minus, Eye, EyeOff, Radio, Loader2, AlertTriangle } from 'lucide-react';
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
      // Init Map
      if (mapContainerRef.current && !mapInstanceRef.current) {
          try {
              const map = L.map(mapContainerRef.current, {
                  zoomControl: false, 
                  attributionControl: false,
                  center: [-14.2350, -51.9253], 
                  zoom: 4,
                  minZoom: 3,
                  maxZoom: 18,
                  zoomAnimation: true
              });

              // Glass/Dark Map Style
              L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                  className: 'hacker-map-tiles',
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

      initializeLocationStrategy();

      // Clean up Leaflet instance to prevent memory leaks
      return () => {
          if (mapInstanceRef.current) {
              mapInstanceRef.current.remove();
              mapInstanceRef.current = null;
              friendsLayerRef.current = null;
              linesLayerRef.current = null;
          }
      };
  }, []);

  useEffect(() => {
      if (linesLayerRef.current && mapInstanceRef.current) {
          linesLayerRef.current.clearLayers();
          if (showLines) {
             drawConnectionLines();
          }
      }
  }, [showLines, myLocation]);

  const initializeLocationStrategy = async () => {
      setLoading(true);
      if (user?.latitude && user?.longitude) {
          const lat = user.latitude;
          const lng = user.longitude;
          updateMyMapPosition(lat, lng);
          setLoading(false);
      } else {
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
          const myIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div class="relative flex items-center justify-center w-12 h-12">
                    <div class="absolute w-full h-full bg-brand-primary/20 rounded-full radar-pulse"></div>
                    <div class="absolute w-4 h-4 bg-brand-primary rounded-full border-2 border-zinc-950 shadow-[0_0_20px_#10b981] z-10"></div>
                </div>
              `,
              iconSize: [48, 48],
              iconAnchor: [24, 24]
          });

          if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([lat, lng]);
          } else {
              userMarkerRef.current = L.marker([lat, lng], { icon: myIcon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
          }
          mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
      }
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
              const friendIcon = L.divIcon({
                  className: 'friend-marker',
                  html: `
                    <div class="relative group cursor-pointer flex flex-col items-center">
                        <div class="w-12 h-12 rounded-full p-1 bg-zinc-950/60 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden relative z-10 transition-transform hover:scale-110 hover:border-brand-primary/50">
                            <img src="${friend.avatar_url}" class="w-full h-full rounded-full object-cover" />
                        </div>
                        <div class="mt-1 px-2 py-0.5 bg-black/80 backdrop-blur text-[9px] text-white font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 whitespace-nowrap">
                            ${friend.name?.split(' ')[0]}
                        </div>
                    </div>
                  `,
                  iconSize: [48, 64],
                  iconAnchor: [24, 24]
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

      friends.forEach(friend => {
          if (friend.latitude && friend.longitude) {
              const dist = calculateDistance(myLocation.lat, myLocation.lng, friend.latitude, friend.longitude);
              const latlngs = [[myLocation.lat, myLocation.lng], [friend.latitude, friend.longitude]];

              L.polyline(latlngs as any, {
                  color: '#10b981', 
                  weight: 1.5,
                  opacity: 0.4,
                  className: 'connection-line-flow' 
              }).addTo(linesLayerRef.current!);

              const centerLat = (myLocation.lat + friend.latitude) / 2;
              const centerLng = (myLocation.lng + friend.longitude) / 2;
              
              const distIcon = L.divIcon({
                  className: 'dist-label',
                  html: `<div class="bg-black/80 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded-full border border-white/5 backdrop-blur-sm whitespace-nowrap shadow-lg font-mono tracking-wider">${dist < 1 ? (dist*1000).toFixed(0)+'m' : dist.toFixed(1)+'km'}</div>`,
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
        <style>{`.leaflet-container { background: #09090b !important; } .leaflet-control-container .leaflet-routing-container-hide { display: none; }`}</style>

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
             <button onClick={() => setShowLines(!showLines)} className={`w-12 h-12 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all ${showLines ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-black/60 border-zinc-700 text-zinc-500'}`}>
                 {showLines ? <Eye size={20} /> : <EyeOff size={20} />}
             </button>

             <div className="flex flex-col rounded-lg overflow-hidden border border-zinc-700 bg-black/60 backdrop-blur-md">
                 <button onClick={handleZoomIn} className="w-12 h-12 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 border-b border-zinc-700 active:bg-brand-primary/20"><Plus size={20} /></button>
                 <button onClick={handleZoomOut} className="w-12 h-12 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-brand-primary/20"><Minus size={20} /></button>
             </div>

             <button onClick={tryGPS} className="w-12 h-12 rounded-lg bg-black/60 backdrop-blur-md border border-brand-primary/30 flex items-center justify-center text-brand-primary hover:bg-brand-primary/10 transition-all active:scale-95 group">
                 <LocateFixed size={20} className="group-hover:animate-spin" />
             </button>
        </div>

        {/* Grid Overlay Effect */}
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
