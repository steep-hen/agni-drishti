import React, { useState, useEffect } from 'react';
import { Building2, ChevronRight, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useTheme } from '../lib/theme';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { API } from '../lib/api';

type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  risk: string;
  category: string;
  frp: number;
  title: string;
};

interface MapDashboardScreenProps {
  onSelectEpisodeToReview: (id: string) => void;
  onOpenFacilityDossier: (facilityId?: string) => void;
  targetHotspot?: Hotspot | null;
  onClearTargetHotspot?: () => void;
}

// Controller to smoothly pan/zoom map to selected hotspot and ensure map tiles resize correctly
const MapPanController: React.FC<{ selectedHotspot: Hotspot | null }> = ({ selectedHotspot }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate map dimensions so Leaflet recalculates and fills container immediately
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    if (selectedHotspot) {
      map.flyTo([selectedHotspot.lat, selectedHotspot.lng], 13, { duration: 1.2 });
    }
  }, [selectedHotspot, map]);
  return null;
};

// Cached icons for performance - vibrant thermal markers with drop shadow and border
const iconCache = new Map<string, L.DivIcon>();

const createCustomIcon = (risk: string, category: string, isSelected: boolean) => {
  const key = `${risk}-${category}-${isSelected}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const isCritical = risk === 'CRITICAL';
  const isHigh = risk === 'HIGH';

  // Realistic thermal anomaly colors: red for critical, orange for high, blue for other
  const color = isCritical 
    ? '#ef4444' 
    : isHigh 
    ? '#f97316' 
    : '#3b82f6';

  const border = isSelected 
    ? '2.5px solid #ffffff' 
    : isCritical 
    ? '2px solid #ffffff' 
    : '1.5px solid #ffffff';

  const size = isSelected ? 14 : isCritical ? 10 : 8;
  const shadow = isSelected 
    ? 'box-shadow: 0 0 10px rgba(239,68,68,0.9), 0 2px 5px rgba(0,0,0,0.6);' 
    : isCritical
    ? 'box-shadow: 0 0 6px rgba(239,68,68,0.8), 0 1px 3px rgba(0,0,0,0.4);'
    : 'box-shadow: 0 1px 3px rgba(0,0,0,0.4);';

  const html = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${border};${shadow}"></div>`;

  const icon = L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
};

export const MapDashboardScreen: React.FC<MapDashboardScreenProps> = ({
  onSelectEpisodeToReview,
  onOpenFacilityDossier,
  targetHotspot,
  onClearTargetHotspot,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeLayer, setActiveLayer] = useState<'OSM' | 'SATELLITE' | 'CANVAS'>('OSM');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(targetHotspot || null);
  const [allHotspots, setAllHotspots] = useState<Hotspot[]>([]);

  useEffect(() => {
    if (targetHotspot) {
      setSelectedCategory('ALL');
      setSelectedHotspot(targetHotspot);
    }
  }, [targetHotspot]);

  useEffect(() => {
    fetch(`${API}/fires/map`)
      .then((r) => r.json())
      .then((data: Hotspot[]) => setAllHotspots(data))
      .catch(() => console.warn('Could not fetch map markers from API'));
  }, []);

  const filteredHotspots = selectedCategory === 'ALL'
    ? allHotspots
    : allHotspots.filter((h) => h.category === selectedCategory.toLowerCase());

  // Guarantee that selectedHotspot is always rendered as a marker on the map
  const hasSelectedMarker = selectedHotspot && filteredHotspots.some((h) => h.id === selectedHotspot.id);
  const displayedMarkers = selectedHotspot && !hasSelectedMarker
    ? [selectedHotspot, ...filteredHotspots]
    : filteredHotspots;

  const criticalCount = allHotspots.filter((h) => h.risk === 'CRITICAL').length;

  return (
    <div className="relative w-full h-[calc(100vh-3.25rem)] min-h-[640px] bg-background overflow-hidden flex flex-col select-none">
      
      {/* Top Map Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer Switcher */}
        <div className="pointer-events-auto flex items-center bg-card/95 backdrop-blur-md p-1 rounded-md border border-border shadow-md">
          {([
            { id: 'OSM' as const, label: 'Street Map (OSM)' },
            { id: 'SATELLITE' as const, label: 'Satellite' },
            { id: 'CANVAS' as const, label: isDark ? 'Dark Canvas' : 'Light Canvas' },
          ]).map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                activeLayer === layer.id
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {/* Category Filters */}
        <div className="pointer-events-auto flex items-center gap-1 bg-card/95 backdrop-blur-md p-1 rounded-md border border-border shadow-md text-xs">
          <span className="text-muted-foreground px-2 text-[11px] font-medium hidden sm:inline">Category:</span>
          {([
            { id: 'ALL', label: 'All', color: 'bg-primary text-primary-foreground' },
            { id: 'Wildfire', label: 'Wildfire', color: 'bg-amber-500 text-white', textCol: 'text-amber-400 hover:bg-amber-500/10' },
            { id: 'Refinery', label: 'Refinery', color: 'bg-sky-500 text-white', textCol: 'text-sky-400 hover:bg-sky-500/10' },
            { id: 'Thermal', label: 'Thermal', color: 'bg-orange-500 text-white', textCol: 'text-orange-400 hover:bg-orange-500/10' },
            { id: 'Mine', label: 'Mine', color: 'bg-purple-500 text-white', textCol: 'text-purple-400 hover:bg-purple-500/10' },
          ]).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors font-medium ${
                selectedCategory === cat.id
                  ? `${cat.color} font-semibold shadow-xs`
                  : cat.textCol || 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Metrics HUD Cards */}
      <div className="absolute top-16 left-4 z-[1000] space-y-2 pointer-events-none hidden md:block">
        <Card className="pointer-events-auto w-60 bg-card/95 backdrop-blur-md border-border border-t-2 border-t-red-500 shadow-xl">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">Critical Detections</span>
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-mono font-bold animate-pulse">P0</Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-red-500 mt-0.5">
              {criticalCount}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Southern Sector</span>
            <span className="text-amber-400 font-mono">375m VIIRS</span>
          </CardContent>
        </Card>

        <Card className="pointer-events-auto w-60 bg-card/95 backdrop-blur-md border-border border-t-2 border-t-sky-500 shadow-xl">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-sky-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                Monitored Sites
              </span>
              <Badge variant="info" className="text-[10px] h-4 px-1.5 font-mono font-bold">Cadastre</Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-0.5">
              208
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Thermal &amp; Refineries</span>
            <span className="text-emerald-400 font-mono">100% Online</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Leaflet Map Canvas */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[14.0, 79.0]}
          zoom={6} 
          zoomControl={false}
          className="w-full h-full bg-background"
        >
          {activeLayer === 'OSM' ? (
            <TileLayer
              key="osm-streets-tiles"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          ) : activeLayer === 'SATELLITE' ? (
            <TileLayer
              key="satellite-tiles"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          ) : (
            <TileLayer
              key={isDark ? 'dark-tiles' : 'light-tiles'}
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url={
                isDark
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                  : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
              }
              maxZoom={19}
            />
          )}

          <MapPanController selectedHotspot={selectedHotspot} />

          <MarkerClusterGroup chunkedLoading maxClusterRadius={60}>
            {displayedMarkers.map((h) => (
              <Marker
                key={h.id}
                position={[h.lat, h.lng]}
                icon={createCustomIcon(h.risk, h.category, selectedHotspot?.id === h.id)}
                eventHandlers={{
                  click: () => setSelectedHotspot(h),
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* Inspector Detail Card when marker selected */}
      {selectedHotspot && (
        <Card className="absolute bottom-6 right-4 lg:right-6 z-[1000] max-w-sm w-full bg-card/95 backdrop-blur-md border-border shadow-xl">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={selectedHotspot.risk === 'CRITICAL' ? 'default' : 'secondary'} className="font-mono text-[10px]">
                  {selectedHotspot.risk}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  {selectedHotspot.id}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedHotspot(null);
                  if (onClearTargetHotspot) onClearTargetHotspot();
                }}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <CardTitle className="text-xs font-semibold text-foreground pt-1 leading-snug">
              {selectedHotspot.title}
            </CardTitle>
            <div className="text-[11px] font-mono text-muted-foreground">
              {selectedHotspot.lat.toFixed(4)}° N, {selectedHotspot.lng.toFixed(4)}° E
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/50 p-2.5 rounded-md border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block">Radiant Power</span>
                <span className="font-mono font-medium text-foreground text-sm">
                  {selectedHotspot.frp} MW
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Category</span>
                <span className="font-medium text-foreground capitalize">
                  {selectedHotspot.category}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => onSelectEpisodeToReview(selectedHotspot.id)}
              >
                <span>Verify Episode</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenFacilityDossier(selectedHotspot.id)}
              >
                Facility Info
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
