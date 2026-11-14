import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Calendar, 
  Compass, 
  Activity, 
  Satellite, 
  Video, 
  X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { IndustrialFacility } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Input } from './ui/input';

const facilityReticleIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
      <div style="position:absolute;width:20px;height:20px;border:2px solid #ef4444;border-radius:50%;box-shadow:0 0 10px rgba(239,68,68,0.9);background:rgba(239,68,68,0.15);"></div>
      <div style="position:absolute;width:4px;height:4px;background:#ffffff;border-radius:50%;"></div>
      <div style="position:absolute;width:28px;height:1.5px;background:rgba(239,68,68,0.85);"></div>
      <div style="position:absolute;height:28px;width:1.5px;background:rgba(239,68,68,0.85);"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const MiniMapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
};

interface FacilitiesDirectoryScreenProps {
  facilities: IndustrialFacility[];
  onInspectEpisode: (episodeId: string) => void;
  onOpenMapForFacility: (facilityId: string) => void;
}

// ── Dynamic 12-month FRP generator ──────────────────────────────────────────
function generateMonthlyFRP(facility: IndustrialFacility): { month: string; frp: number }[] {
  // If the facility has loaded monthlyFRP, use it directly
  if (facility.monthlyFRP && facility.monthlyFRP.length > 0) {
    return facility.monthlyFRP.map(m => ({ month: m.month, frp: m.value }));
  }

  // Fallback: Seed from facility id so the shape is deterministic but unique per facility
  const seed = Math.abs(facility.id.trim().split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  const cap = facility.nominalFrpCapMw || 600;
  const base = facility.baselineOperatingMw || Math.round(cap * 0.55);
  const peak = facility.peakFrp12mMw || Math.round(cap * 1.25);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const peakIdx = seed % 12;

  return months.map((month, i) => {
    const dist = Math.min(Math.abs(i - peakIdx), 12 - Math.abs(i - peakIdx));
    let val: number;
    if (dist === 0) {
      val = peak;
    } else if (dist === 1) {
      val = Math.round(base + (peak - base) * 0.65);
    } else if (dist === 2) {
      val = Math.round(base + (peak - base) * 0.30);
    } else {
      const v = Math.sin((seed + i * 5) * 0.7) * 0.12;
      val = Math.max(20, Math.round(base * (1 + v)));
    }
    return { month, frp: val };
  });
}

// Map frp value → SVG Y coordinate (SVG viewBox height 120, data area rows 10–110)
function frpToY(frp: number, maxFrp: number): number {
  const pct = Math.min(frp / maxFrp, 1.2); // allow slight overflow
  return Math.round(110 - pct * 100);
}

export const FacilitiesDirectoryScreen: React.FC<FacilitiesDirectoryScreenProps> = ({
  facilities,
  onInspectEpisode,
  onOpenMapForFacility,
}) => {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(facilities[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || facilities[0];

  const filteredFacilities = facilities.filter((f) => {
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.district.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 lg:p-8 max-w-[1680px] mx-auto space-y-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              Infrastructure Cadastre
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {facilities.length} Monitored Sites
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Industrial Facility Buffer Registry
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl mt-1">
            Geospatial geofencing mapping thermal emissions to registered power stations, oil refineries, and heavy industrial facilities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setGeofenceModalOpen(true)}
            className="text-xs"
          >
            <Compass className="w-3.5 h-3.5 mr-1.5" />
            Buffer Settings
          </Button>
          <Button 
            size="sm"
            onClick={() => setScheduleModalOpen(true)}
            className="text-xs"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Schedule Flare Purge
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Facilities List */}
        <div className="lg:col-span-4 space-y-2.5">
          <Card className="p-3.5 bg-card border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Facility Cadastre
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {filteredFacilities.length} Found
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search facility name, sector, ID..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1">
              {['ALL', 'Refineries', 'Thermal', 'Steel', 'Coal'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Card>

          {/* List Cards */}
          <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
            {filteredFacilities.map((fac) => {
              const isSelected = fac.id === selectedFacilityId;

              return (
                <Card
                  key={fac.id}
                  onClick={() => setSelectedFacilityId(fac.id)}
                  className={`p-3.5 transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-l-4 border-l-orange-500 border-orange-500/50 bg-orange-500/5 shadow-md shadow-orange-500/10'
                      : 'border-border bg-card/80 hover:bg-secondary/40 hover:border-border/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-sky-400">
                      {fac.id}
                    </span>
                    <Badge 
                      variant={fac.status === 'EXCEEDANCE' ? 'destructive' : 'success'}
                      className="text-[10px] h-4 px-1.5 font-bold tracking-wide shadow-xs"
                    >
                      {fac.status}
                    </Badge>
                  </div>

                  <h3 className="text-xs font-semibold text-foreground mt-1.5 leading-snug line-clamp-1">
                    {fac.name}
                  </h3>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {fac.stateZone} • <span className="text-emerald-400 font-mono">{fac.bufferRadiusKm} km</span> Buffer
                  </div>

                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground">
                      Anomalies: <strong className="text-red-400 font-bold">{fac.linkedEpisodesCount}</strong>
                    </span>
                    <span className="text-sky-400 font-medium">
                      Cap: {fac.nominalFrpCapMw} MW
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Facility Dossier */}
        <div className="lg:col-span-8">
          {selectedFacility ? (
            <Card className="p-6 space-y-5 bg-card border-border shadow-sm">
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedFacility.id}
                    </Badge>
                    <Badge variant={selectedFacility.status === 'EXCEEDANCE' ? 'destructive' : 'secondary'}>
                      {selectedFacility.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {selectedFacility.category}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedFacility.name}
                  </h2>
                  <div className="text-xs font-mono text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-foreground">{selectedFacility.coordinates.latStr}, {selectedFacility.coordinates.lngStr}</span>
                    <span>•</span>
                    <span>{selectedFacility.district}, {selectedFacility.stateZone}</span>
                    <span>•</span>
                    <span>{selectedFacility.bufferRadiusKm} km Geofence</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenMapForFacility(selectedFacility.id)}
                    className="gap-1.5 text-xs border-sky-500/40 text-sky-400 hover:bg-sky-500/15 hover:border-sky-500 font-semibold transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Locate on Tactical Map
                  </Button>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-sky-500/5 p-3 rounded-md border border-border border-l-3 border-l-sky-500 shadow-xs">
                  <div className="text-[10px] text-sky-400/90 font-medium uppercase tracking-wider">Permit FRP Cap</div>
                  <div className="text-xl font-bold font-mono text-sky-400 mt-0.5">
                    {selectedFacility.nominalFrpCapMw} MW
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    Baseline: {selectedFacility.baselineOperatingMw} MW
                  </div>
                </div>

                <div className="bg-purple-500/5 p-3 rounded-md border border-border border-l-3 border-l-purple-500 shadow-xs">
                  <div className="text-[10px] text-purple-400/90 font-medium uppercase tracking-wider">Monitored Stacks</div>
                  <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
                    {selectedFacility.registeredStacks}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Optical Verification
                  </div>
                </div>

                <div className="bg-amber-500/5 p-3 rounded-md border border-border border-l-3 border-l-amber-500 shadow-xs">
                  <div className="text-[10px] text-amber-400/90 font-medium uppercase tracking-wider">Peak Radiance (12m)</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                    {selectedFacility.peakFrp12mMw} MW
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    Historical VIIRS Peak
                  </div>
                </div>

                <div className="bg-red-500/5 p-3 rounded-md border border-border border-l-3 border-l-red-500 shadow-xs">
                  <div className="text-[10px] text-red-400/90 font-medium uppercase tracking-wider">Risk Evaluation</div>
                  <div className="text-xl font-bold font-mono text-red-400 mt-0.5">
                    {selectedFacility.bufferOverlaps}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Composite Threat Index
                  </div>
                </div>
              </div>

              {/* Dual Visual Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-border overflow-hidden bg-secondary/20">
                  <div className="px-3 py-1.5 bg-secondary/40 border-b border-border flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Satellite className="w-3.5 h-3.5" />
                      Satellite Imagery
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {selectedFacility.satelliteFeed?.orbitPass || '12:00 UTC'} • Earth Observation
                    </span>
                  </div>
                  <div className="h-40 overflow-hidden relative bg-muted">
                    <MapContainer
                      key={`fac-satellite-${selectedFacility.id}-${selectedFacility.coordinates.lat}-${selectedFacility.coordinates.lng}`}
                      center={[selectedFacility.coordinates.lat, selectedFacility.coordinates.lng]}
                      zoom={15}
                      zoomControl={false}
                      attributionControl={false}
                      dragging={true}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                      className="w-full h-full z-0 cursor-grab"
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                      />
                      <MiniMapResizer />
                      <Marker
                        position={[selectedFacility.coordinates.lat, selectedFacility.coordinates.lng]}
                        icon={facilityReticleIcon}
                      />
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-md px-2.5 py-1 rounded border border-border text-[11px] text-muted-foreground flex justify-between z-[400] pointer-events-none">
                      <span>Sensor: {selectedFacility.satelliteFeed?.sensor || 'VIIRS SNPP'}</span>
                      <span className="text-foreground font-mono">FOV: {selectedFacility.satelliteFeed?.fov || '5.0 KM²'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border overflow-hidden bg-secondary/20">
                  <div className="px-3 py-1.5 bg-secondary/40 border-b border-border flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      Ground Truth Camera Feed
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Camera 04</span>
                  </div>
                  <div className="h-40 overflow-hidden relative">
                    <img 
                      src={selectedFacility.cctvFeed.imageUrl}
                      alt="Facility ground truth"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover grayscale contrast-125"
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-md px-2.5 py-1 rounded border border-border text-[11px] text-muted-foreground flex justify-between">
                      <span>Plume: {selectedFacility.cctvFeed.plumeDispersion}</span>
                      <span className="text-foreground font-mono">Status: {selectedFacility.cctvFeed.exceedanceStatus}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 12-Month FRP Trend Chart — dynamic per facility */}
              {(() => {
                const monthlyData = generateMonthlyFRP(selectedFacility);
                const permitThreshold = selectedFacility.nominalFrpCapMw || 600;
                const peakVal = Math.max(...monthlyData.map(d => d.frp));
                const axisMax = Math.max(peakVal * 1.25, permitThreshold * 1.1);
                const thresholdY = frpToY(permitThreshold, axisMax);
                const peakMonth = monthlyData.reduce((a, b) => a.frp > b.frp ? a : b);
                const peakIdx = monthlyData.indexOf(peakMonth);
                const xs = monthlyData.map((_, i) => 50 + i * 83);
                const ys = monthlyData.map(d => frpToY(d.frp, axisMax));
                const polyPoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
                // area fill gradient
                const areaPoints = `${xs[0]},110 ` + xs.map((x, i) => `${x},${ys[i]}`).join(' ') + ` ${xs[xs.length-1]},110`;
                return (
                  <div className="p-4 rounded-md border border-border bg-secondary/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-orange-400" />
                        12-Month Thermal Radiance Profile (MW)
                      </span>
                      <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1 text-orange-400">
                          <span className="w-2.5 h-0.5 bg-orange-400 inline-block" />
                          Mean FRP
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="w-2.5 h-0.5 bg-red-400 inline-block" style={{borderTop:'2px dashed'}} />
                          Permit Cap ({permitThreshold} MW)
                        </span>
                      </div>
                    </div>

                    <div className="h-36 w-full pt-1">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 125">
                        <defs>
                          <linearGradient id={`frp-grad-${selectedFacility.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Gridlines */}
                        {[0, 25, 50, 75, 100].map(pct => {
                          const gy = 110 - pct;
                          return (
                            <line key={pct} x1="0" y1={gy} x2="1000" y2={gy}
                              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                          );
                        })}

                        {/* Y-axis value labels */}
                        {[0, 0.5, 1].map(frac => {
                          const val = Math.round(axisMax * frac);
                          const gy = frpToY(axisMax * frac, axisMax);
                          return (
                            <text key={frac} x="4" y={gy + 3}
                              fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">
                              {val}
                            </text>
                          );
                        })}

                        {/* Permit threshold line */}
                        <line x1="0" y1={thresholdY} x2="1000" y2={thresholdY}
                          stroke="#f87171" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.85" />
                        <text x="12" y={thresholdY - 4}
                          fill="#f87171" fontSize="8" fontFamily="monospace">
                          Cap: {permitThreshold} MW
                        </text>

                        {/* Area fill */}
                        <polygon points={areaPoints} fill={`url(#frp-grad-${selectedFacility.id})`} />

                        {/* FRP line */}
                        <polyline fill="none" stroke="#f97316" strokeWidth="2.5"
                          strokeLinejoin="round" strokeLinecap="round" points={polyPoints} />

                        {/* Data dots */}
                        {xs.map((x, i) => (
                          <circle key={i} cx={x} cy={ys[i]} r="3"
                            fill="#f97316" stroke="var(--card)" strokeWidth="1.5" />
                        ))}

                        {/* Peak annotation */}
                        <circle cx={xs[peakIdx]} cy={ys[peakIdx]} r="5"
                          fill="#f97316" stroke="var(--card)" strokeWidth="2" />
                        <text
                          x={xs[peakIdx] > 850 ? xs[peakIdx] - 95 : xs[peakIdx] - 10}
                          y={ys[peakIdx] - 8}
                          fill="#fb923c" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                          Peak: {peakMonth.frp} MW
                        </text>

                        {/* Month labels */}
                        {monthlyData.map((d, i) => (
                          <text key={d.month} x={xs[i]} y="122"
                            textAnchor="middle" fill="var(--muted-foreground)"
                            fontSize="9" fontFamily="monospace">
                            {d.month}
                          </text>
                        ))}
                      </svg>
                    </div>
                  </div>
                );
              })()}
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              No facility selected
            </Card>
          )}
        </div>
      </div>

      {/* Flare Schedule Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-card border-border shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule Industrial Flare Purge
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setScheduleModalOpen(false)} className="h-6 w-6">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">Facility Name</label>
                <Input disabled value={selectedFacility?.name} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground block mb-1">Start Time</label>
                  <Input type="datetime-local" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Expected Peak (MW)</label>
                  <Input type="number" defaultValue={selectedFacility?.peakFrp12mMw || 650} />
                </div>
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Operational Permit Ref</label>
                <Input placeholder="PPAC-MAINT-PURGE-2026-B" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                alert("Flare schedule logged in Cadastre.");
                setScheduleModalOpen(false);
              }}>Save Schedule</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Geofence Modal */}
      {geofenceModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-card border-border shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Compass className="w-4 h-4" />
                Buffer Geofence Configuration
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setGeofenceModalOpen(false)} className="h-6 w-6">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">Buffer Radius (km)</label>
                <Input type="number" step="0.1" defaultValue={selectedFacility?.bufferRadiusKm || 5.0} />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Nominal FRP Cap (MW)</label>
                <Input type="number" defaultValue={selectedFacility?.nominalFrpCapMw || 200} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setGeofenceModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                alert("Buffer geofence polygon updated.");
                setGeofenceModalOpen(false);
              }}>Update Geofence</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
