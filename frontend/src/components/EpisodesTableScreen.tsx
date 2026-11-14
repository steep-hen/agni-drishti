import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  Flame, 
  Radio, 
  Satellite, 
  SlidersHorizontal, 
  ChevronRight,
  Eye,
  CheckCircle2,
  X,
  MapPin
} from 'lucide-react';
import { ThermalEpisode } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface EpisodesTableScreenProps {
  episodes: ThermalEpisode[];
  onSelectEpisodeToReview: (id: string) => void;
  onSelectEpisodeForMap: (id: string) => void;
}

export const EpisodesTableScreen: React.FC<EpisodesTableScreenProps> = ({
  episodes,
  onSelectEpisodeToReview,
  onSelectEpisodeForMap,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [nearFacilityOnly, setNearFacilityOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailModalEpisode, setDetailModalEpisode] = useState<ThermalEpisode | null>(null);

  const filtered = episodes.filter((ep) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = 
        ep.id.toLowerCase().includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        ep.districtState.toLowerCase().includes(q) ||
        ep.coordinates.latStr.toLowerCase().includes(q) ||
        ep.coordinates.lngStr.toLowerCase().includes(q) ||
        ep.sensorPlatform.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedState !== 'ALL') {
      const s = selectedState.toLowerCase();
      if (!ep.districtState.toLowerCase().includes(s)) return false;
    }

    if (selectedRisk !== 'ALL') {
      if (ep.riskLevel !== selectedRisk) return false;
    }

    if (selectedClassification !== 'ALL') {
      if (selectedClassification === 'INDUSTRIAL_LIKELY' && !ep.mlInference.toLowerCase().includes('refinery') && !ep.mlInference.toLowerCase().includes('industrial')) return false;
      if (selectedClassification === 'FOREST_FIRE_LIKELY' && !ep.mlInference.toLowerCase().includes('forest') && !ep.title.toLowerCase().includes('canopy')) return false;
      if (selectedClassification === 'UNCERTAIN' && !ep.mlInference.toLowerCase().includes('uncertain')) return false;
    }

    if (nearFacilityOnly) {
      if (ep.ppacProximityKm >= 5.0) return false;
    }

    return true;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((e) => e.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const criticalCount = episodes.filter((e) => e.riskLevel === 'CRITICAL').length;
  const highCount = episodes.filter((e) => e.riskLevel === 'HIGH').length;

  return (
    <div className="p-4 lg:p-8 max-w-[1680px] mx-auto space-y-6">
      {/* Title & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              Detections Archive
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {episodes.length} Records
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Thermal Anomaly Detections
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl mt-1">
            Aggregated spatiotemporal clusters from NASA VIIRS 375m and MODIS 1km sensor swaths cross-referenced with LULC and facility baselines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedIds.length === 0}
            className="text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Batch Action ({selectedIds.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(episodes, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `THERMAL_ANOMALIES_${Date.now()}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Primary Satellite</span>
            <Satellite className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-lg font-semibold font-mono text-foreground mt-1">
            VIIRS / SNPP
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            375m payload active
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Critical Events</span>
            <Flame className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-lg font-semibold font-mono text-foreground mt-1">
            {criticalCount} Critical
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {highCount} High Priority
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Verified Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-lg font-semibold font-mono text-foreground mt-1">
            86.2% Confirmed
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Human-in-the-loop review
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Agency Relays</span>
            <Radio className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-lg font-semibold font-mono text-foreground mt-1">
            Active Uplink
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Disaster ops dispatch
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3.5 bg-card border-border space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, coordinates, district, or facility..."
              className="pl-9 h-8 text-xs"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="w-full h-8 bg-input border border-border rounded-md px-2.5 text-xs text-foreground focus:border-ring focus:outline-none"
            >
              <option value="ALL">All Classifications</option>
              <option value="INDUSTRIAL_LIKELY">Industrial Likely</option>
              <option value="FOREST_FIRE_LIKELY">Forest Fire Likely</option>
              <option value="UNCERTAIN">Uncertain / Glint</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full h-8 bg-input border border-border rounded-md px-2.5 text-xs text-foreground focus:border-ring focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Telangana">Telangana</option>
              <option value="Andhra">Andhra Pradesh</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Kerala">Kerala</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center justify-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
              <input 
                type="checkbox"
                checked={nearFacilityOnly}
                onChange={(e) => setNearFacilityOnly(e.target.checked)}
                className="accent-foreground rounded"
              />
              <span>&lt; 5km facility</span>
            </label>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedRisk('ALL');
                setSelectedClassification('ALL');
                setSelectedState('ALL');
                setNearFacilityOnly(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-7"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Risk Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
          <span className="text-[11px] text-muted-foreground mr-1.5">Risk Level:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((r) => {
            const isActive = selectedRisk === r;
            return (
              <button
                key={r}
                onClick={() => setSelectedRisk(r)}
                className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Main Table */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-[11px] text-muted-foreground">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    className="accent-foreground rounded"
                  />
                </th>
                <th className="p-3">Episode ID</th>
                <th className="p-3">Location &amp; Coordinates</th>
                <th className="p-3">Detected</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Radiance</th>
                <th className="p-3">Risk Level</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((ep) => {
                const isChecked = selectedIds.includes(ep.id);

                return (
                  <tr 
                    key={ep.id}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                    onClick={() => setDetailModalEpisode(ep)}
                  >
                    <td className="p-3 text-center" onClick={(e) => toggleSelectOne(ep.id, e)}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-foreground rounded"
                      />
                    </td>

                    <td className="p-3 font-mono font-medium text-foreground">
                      <span>{ep.id}</span>
                      <div className="text-[10px] text-muted-foreground font-mono">{ep.sensorPlatform}</div>
                    </td>

                    <td className="p-3">
                      <div className="text-foreground line-clamp-1">{ep.title}</div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {ep.coordinates.latStr}, {ep.coordinates.lngStr} • {ep.districtState}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-muted-foreground">
                      <div className="text-foreground">{ep.firstDetectedUtc}</div>
                      <div className="text-[10px] text-muted-foreground">{ep.timelineAge}</div>
                    </td>

                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ep.mlInference}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {ep.confidence}% Certainty
                      </div>
                    </td>

                    <td className="p-3 font-mono font-medium text-foreground">
                      {ep.radiantHeatMw} MW
                    </td>

                    <td className="p-3">
                      <Badge variant={ep.riskLevel === 'CRITICAL' ? 'destructive' : 'secondary'}>
                        {ep.riskLevel}
                      </Badge>
                    </td>

                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Locate on Tactical Map"
                          onClick={() => onSelectEpisodeForMap(ep.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Inspect Details"
                          onClick={() => setDetailModalEpisode(ep)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectEpisodeToReview(ep.id)}
                          className="h-7 text-[11px] px-2"
                        >
                          Verify
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-secondary/20 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{filtered.length}</strong> of <strong className="text-foreground">{episodes.length}</strong> anomalies
          </span>

          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className="h-6 px-2 text-xs font-mono">1</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground font-mono">2</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground font-mono">3</Button>
          </div>
        </div>
      </Card>

      {/* Episode Inspection Modal */}
      {detailModalEpisode && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-xl w-full p-6 space-y-4 bg-card border-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {detailModalEpisode.id}
                </Badge>
                <h3 className="text-sm font-semibold text-foreground">{detailModalEpisode.title}</h3>
              </div>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setDetailModalEpisode(null)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-secondary/30 p-3 rounded-md border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block">Coordinates</span>
                <span className="font-mono font-medium text-foreground">
                  {detailModalEpisode.coordinates.latStr}, {detailModalEpisode.coordinates.lngStr}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Sensor Platform</span>
                <span className="font-mono font-medium text-foreground">
                  {detailModalEpisode.sensorPlatform}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Radiative Power</span>
                <span className="font-mono font-medium text-foreground">
                  {detailModalEpisode.radiantHeatMw} MW Peak
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Facility Buffer</span>
                <span className="font-mono font-medium text-foreground">
                  {detailModalEpisode.ppacProximityKm?.toFixed(1) || '0.0'} km distance
                </span>
              </div>
            </div>

            {/* Satellite Image Preview */}
            <div className="relative h-44 rounded-md overflow-hidden border border-border bg-secondary/20">
              <img 
                src={detailModalEpisode.topoData?.imageUrl || detailModalEpisode.thermalData?.imageUrl || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80"}
                alt="Satellite preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover grayscale contrast-125"
              />
              <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded border border-border text-xs text-muted-foreground flex justify-between">
                <span>Inference: <strong className="text-foreground">{detailModalEpisode.mlInference}</strong></span>
                <span className="font-mono text-foreground">{detailModalEpisode.confidence}% Confidence</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelectEpisodeForMap(detailModalEpisode.id);
                  setDetailModalEpisode(null);
                }}
              >
                <MapPin className="w-3.5 h-3.5 mr-1" />
                Locate on Map
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onSelectEpisodeToReview(detailModalEpisode.id);
                  setDetailModalEpisode(null);
                }}
                className="gap-1.5"
              >
                <span>Open in Review Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
