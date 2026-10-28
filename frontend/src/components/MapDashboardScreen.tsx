import React, { useState, useEffect } from 'react';
import { Building2, ChevronRight, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useTheme } from '../lib/theme';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const API = 'http://localhost:3001/api';

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
}

// Controller to smoothly pan/zoom map to selected hotspot
const MapPanController: React.FC<{ selectedHotspot: Hotspot | null }> = ({ selectedHotspot }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedHotspot) {
      map.flyTo([selectedHotspot.lat, selectedHotspot.lng], 10, { duration: 1.2 });
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
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeLayer, setActiveLayer] = useState<'NORMAL' | 'SATELLITE' | 'CANVAS'>('NORMAL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [allHotspots, setAllHotspots] = useState<Hotspot[]>([]);

  useEffect(() => {
    fetch(`${API}/fires/map`)
      .then((r) => r.json())
      .then((data: Hotspot[]) => setAllHotspots(data))
      .catch(() => console.warn('Could not fetch map markers from API'));
  }, []);

  const filteredHotspots = selectedCategory === 'ALL'
    ? allHotspots
    : allHotspots.filter((h) => h.category === selectedCategory.toLowerCase());

  const criticalCount = allHotspots.filter((h) => h.risk === 'CRITICAL').length;

  return (
    <div className="relative w-full h-[calc(100vh-3.25rem)] min-h-[640px] bg-background overflow-hidden flex flex-col select-none">
      
      {/* Top Map Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer Switcher */}
        <div className="pointer-events-auto flex items-center bg-card/95 backdrop-blur-md p-1 rounded-md border border-border shadow-md">
          {([
            { id: 'NORMAL' as const, label: 'Standard Map' },
            { id: 'SATELLITE' as const, label: 'Satellite Imagery' },
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
          {['ALL', 'Wildfire', 'Refinery', 'Thermal', 'Mine'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Metrics HUD Cards */}
      <div className="absolute top-16 left-4 z-[1000] space-y-2 pointer-events-none hidden md:block">
        <Card className="pointer-events-auto w-60 bg-card/95 backdrop-blur-md border-border shadow-md">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Critical Detections</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">P0</Badge>
            </div>
            <div className="text-2xl font-semibold font-mono text-foreground mt-0.5">
              {criticalCount}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px] text-muted-foreground">
            Southern Sector • 375m Resolution
          </CardContent>
        </Card>

        <Card className="pointer-events-auto w-60 bg-card/95 backdrop-blur-md border-border shadow-md">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Monitored Sites
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">Cadastre</Badge>
            </div>
            <div className="text-2xl font-semibold font-mono text-foreground mt-0.5">
              208
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px] text-muted-foreground">
            Thermal Power &amp; Refineries
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
          {activeLayer === 'NORMAL' ? (
            <TileLayer
              key="normal-streets-tiles"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
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
            {filteredHotspots.map((h) => (
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
                onClick={() => setSelectedHotspot(null)}
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
