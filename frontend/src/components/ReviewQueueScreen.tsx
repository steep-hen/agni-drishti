import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Clock, 
  Layers, 
  Check, 
  MapPin, 
  RefreshCw
} from 'lucide-react';
import { ThermalEpisode } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

interface ReviewQueueScreenProps {
  episodes: ThermalEpisode[];
  onConfirmEpisode: (id: string, classification: string, confidence: number, notes: string, directAlert: boolean) => void;
  onRejectGlint: (id: string) => void;
  onRequestSecondReview: (id: string) => void;
  onSelectEpisodeForMap?: (id: string) => void;
}

export const ReviewQueueScreen: React.FC<ReviewQueueScreenProps> = ({
  episodes,
  onConfirmEpisode,
  onRejectGlint,
  onRequestSecondReview,
  onSelectEpisodeForMap,
}) => {
  const [selectedId, setSelectedId] = useState<string>(episodes[0]?.id || '');
  const selectedEpisode = episodes.find((e) => e.id === selectedId) || episodes[0];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | '<60' | '60-75' | 'glint'>('all');

  const [classification, setClassification] = useState<string>(
    selectedEpisode?.groundTruthClassification || 'Wildfire — Active Front'
  );
  const [confidence, setConfidence] = useState<number>(95);
  const [directAlert, setDirectAlert] = useState<boolean>(true);
  const [assessmentNotes, setAssessmentNotes] = useState<string>(
    selectedEpisode?.notes || 'Thermal anomaly confirmed outside registered facility buffer. Coordinates cross-checked against satellite imagery.'
  );

  useEffect(() => {
    if (selectedEpisode) {
      setClassification(selectedEpisode.groundTruthClassification || 'Wildfire — Active Front');
      setAssessmentNotes(selectedEpisode.notes || `Thermal anomaly ${selectedEpisode.id} in ${selectedEpisode.districtState}. Verified.`);
      setConfidence(selectedEpisode.confidence > 70 ? Math.round(selectedEpisode.confidence) : 90);
    }
  }, [selectedId]);

  const [syncTimer, setSyncTimer] = useState<number>(60);
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncTimer((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredEpisodes = episodes.filter((ep) => {
    if (confidenceFilter === '<60') return ep.confidence < 60;
    if (confidenceFilter === '60-75') return ep.confidence >= 60 && ep.confidence <= 75;
    if (confidenceFilter === 'glint') return ep.confidence < 50 || ep.mlInference.toLowerCase().includes('glint');
    return true;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredEpisodes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEpisodes.map((e) => e.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmCurrent = () => {
    if (!selectedEpisode) return;
    onConfirmEpisode(selectedEpisode.id, classification, confidence, assessmentNotes, directAlert);
  };

  const confirmedCount = episodes.filter(
    (ep) => ep.status === 'CONFIRMED' || ep.groundTruthClassification?.includes('Confirmed')
  ).length;

  const falseDiscoveryPct = ((episodes.filter((ep) => ep.confidence < 50).length / Math.max(1, episodes.length)) * 100).toFixed(1);

  return (
    <div className="p-4 lg:p-8 max-w-[1680px] mx-auto space-y-6">
      {/* Title & KPI Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              Verification Pipeline
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Southern Zone
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Anomaly Verification Queue
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl mt-1">
            Review and classify detected thermal anomalies against high-resolution satellite imagery, land cover rasters, and industrial facility cadastres.
          </p>
        </div>

        {/* 3 Clean Monochrome Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="min-w-[130px] p-3 bg-card border-border">
            <div className="text-[11px] text-muted-foreground">Average Hold</div>
            <div className="text-lg font-semibold font-mono text-foreground mt-0.5">8m 42s</div>
            <div className="text-[10px] text-muted-foreground">Target &lt; 15m</div>
          </Card>

          <Card className="min-w-[130px] p-3 bg-card border-border">
            <div className="text-[11px] text-muted-foreground">Verified</div>
            <div className="text-lg font-semibold font-mono text-foreground mt-0.5">{confirmedCount}</div>
            <div className="text-[10px] text-muted-foreground">In Current Cycle</div>
          </Card>

          <Card className="min-w-[130px] p-3 bg-card border-border">
            <div className="text-[11px] text-muted-foreground">False Discovery</div>
            <div className="text-lg font-semibold font-mono text-foreground mt-0.5">{falseDiscoveryPct}%</div>
            <div className="text-[10px] text-muted-foreground">Solar Artifacts</div>
          </Card>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2.5 rounded-lg border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary px-2.5 py-1.5 rounded-md border border-border cursor-pointer text-xs transition-colors">
            <input 
              type="checkbox" 
              checked={selectedIds.length > 0 && selectedIds.length === filteredEpisodes.length}
              onChange={handleSelectAll}
              className="accent-foreground rounded"
            />
            <span className="text-foreground text-xs">
              Select All ({filteredEpisodes.length})
            </span>
          </label>

          <Button 
            variant="secondary"
            size="sm"
            disabled={selectedIds.length === 0}
            onClick={() => {
              selectedIds.forEach((id) => onConfirmEpisode(id, "industrial_activity", 90, "Batch verified.", false));
              setSelectedIds([]);
            }}
            className="gap-1.5 text-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Batch Confirm ({selectedIds.length})
          </Button>

          <Button 
            variant="outline"
            size="sm"
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(episodes, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `ANOMALY_EXPORT_${Date.now()}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </Button>
        </div>

        {/* Confidence Filter Tabs */}
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md border border-border text-xs">
          <span className="text-muted-foreground px-2 text-[11px] font-medium hidden sm:inline">Filter:</span>
          <button
            onClick={() => setConfidenceFilter('all')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              confidenceFilter === 'all'
                ? 'bg-background text-foreground font-medium shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({episodes.length})
          </button>
          <button
            onClick={() => setConfidenceFilter('<60')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              confidenceFilter === '<60'
                ? 'bg-background text-foreground font-medium shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            &lt; 60%
          </button>
          <button
            onClick={() => setConfidenceFilter('60-75')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              confidenceFilter === '60-75'
                ? 'bg-background text-foreground font-medium shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            60–75%
          </button>
          <button
            onClick={() => setConfidenceFilter('glint')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              confidenceFilter === 'glint'
                ? 'bg-background text-foreground font-medium shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Glint / Low
          </button>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Episodes List */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Pending Anomalies ({filteredEpisodes.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
              Sync {syncTimer}s
            </span>
          </div>

          <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1">
            {filteredEpisodes.map((ep) => {
              const isSelected = ep.id === selectedId;
              const isChecked = selectedIds.includes(ep.id);

              return (
                <Card
                  key={ep.id}
                  onClick={() => setSelectedId(ep.id)}
                  className={`p-3.5 transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-foreground/80 bg-secondary/40 shadow-sm'
                      : 'border-border bg-card hover:bg-secondary/20 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => toggleSelectOne(ep.id, e)}
                        onChange={() => {}}
                        className="accent-foreground rounded"
                      />
                      <span className="font-mono text-xs font-medium text-foreground">
                        {ep.id}
                      </span>
                      <Badge variant={ep.riskLevel === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                        {ep.riskLevel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Clock className="w-3 h-3" />
                      {ep.relativeTime}
                    </div>
                  </div>

                  <div className="mt-2">
                    <h3 className="text-xs font-medium text-foreground leading-snug line-clamp-1">
                      {ep.title}
                    </h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ep.districtState} • {ep.sensorPlatform}
                    </div>
                  </div>

                  {/* Radiance Progress Bar */}
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Radiance</span>
                      <span className="font-mono text-foreground font-medium">{ep.radiantHeatMw} MW</span>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-foreground h-full rounded-full"
                        style={{ width: `${Math.min(100, (ep.radiantHeatMw / 500) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Classification */}
                  <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-border">
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      {ep.mlInference}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {ep.confidence}% Certainty
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Dossier & Sign-off Panel */}
        <div className="lg:col-span-7">
          {selectedEpisode ? (
            <Card className="p-6 space-y-5 bg-card border-border shadow-sm">
              {/* Dossier Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedEpisode.id}
                    </Badge>
                    <Badge variant={selectedEpisode.riskLevel === 'CRITICAL' ? 'destructive' : 'secondary'}>
                      {selectedEpisode.riskLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {selectedEpisode.status}
                    </Badge>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedEpisode.title}
                  </h2>
                </div>

                {onSelectEpisodeForMap && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectEpisodeForMap(selectedEpisode.id)}
                    className="gap-1.5 text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Locate on Map
                  </Button>
                )}
              </div>

              {/* Coordinates & Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary/30 p-3 rounded-md border border-border text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Coordinates</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {selectedEpisode.coordinates.latStr}, {selectedEpisode.coordinates.lngStr}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Sensor</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {selectedEpisode.sensorPlatform}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Date Detected</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {selectedEpisode.firstDetectedUtc}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Region</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {selectedEpisode.districtState}
                  </div>
                </div>
              </div>

              {/* LULC Land Cover Context */}
              {selectedEpisode.lulcData && (
                <div className="bg-secondary/30 p-3 rounded-md border border-border text-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Land Cover Context (Esri 10m Rasters)
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      Dominant: {selectedEpisode.lulcData.dominantClass}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Cropland</div>
                      <div className="font-mono font-medium text-foreground mt-0.5">{selectedEpisode.lulcData.cropsPct}%</div>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Trees &amp; Veg</div>
                      <div className="font-mono font-medium text-foreground mt-0.5">{selectedEpisode.lulcData.treesPct}%</div>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Rangeland</div>
                      <div className="font-mono font-medium text-foreground mt-0.5">{selectedEpisode.lulcData.rangelandPct}%</div>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Built-up</div>
                      <div className="font-mono font-medium text-foreground mt-0.5">{selectedEpisode.lulcData.urbanPct}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dual Satellite / Optical & Thermal Imagery */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border overflow-hidden bg-secondary/20">
                  <div className="px-3 py-1.5 bg-secondary/50 border-b border-border flex items-center justify-between text-xs">
                    <span className="text-foreground">Optical Imagery</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Landsat-9 / Sentinel-2</span>
                  </div>
                  <div className="h-40 overflow-hidden relative">
                    <img 
                      src={selectedEpisode.topoData?.imageUrl || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80"}
                      alt="Optical view"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover grayscale contrast-125"
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-md px-2 py-1 rounded border border-border text-[11px] text-muted-foreground flex justify-between">
                      <span>Buffer: {selectedEpisode.ppacProximityKm?.toFixed(1) || '0.0'} km</span>
                      <span className="text-foreground font-mono">Plume Visible</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden bg-secondary/20">
                  <div className="px-3 py-1.5 bg-secondary/50 border-b border-border flex items-center justify-between text-xs">
                    <span className="text-foreground">Thermal Infrared</span>
                    <span className="text-[10px] text-muted-foreground font-mono">VIIRS 375m Band I4</span>
                  </div>
                  <div className="h-40 overflow-hidden relative">
                    <img 
                      src={selectedEpisode.thermalData?.imageUrl || "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=800&q=80"}
                      alt="Thermal IR"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover contrast-150 grayscale"
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-md px-2 py-1 rounded border border-border text-[11px] text-muted-foreground flex justify-between">
                      <span className="font-mono text-foreground font-medium">Peak: {selectedEpisode.radiantHeatMw} MW</span>
                      <span>SLSTR TIR</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyst Decision & Verification Form */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h4 className="text-xs font-medium text-foreground">
                    Analyst Classification Decision
                  </h4>
                  <Badge variant="outline" className="text-[10px]">Step 3 of 3</Badge>
                </div>

                {/* 1. Classification Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-foreground block">
                    Ground Truth Classification
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full bg-input border border-border text-foreground text-xs rounded-md p-2 focus:border-ring focus:outline-none"
                  >
                    <option value="Wildfire — Active Front">Wildfire — Active Forest / Shrub Front</option>
                    <option value="Industrial Flare — Permitted Facility Operation">Industrial Flare — Permitted Facility Operation</option>
                    <option value="Industrial Exceedance — Flare Anomaly Outside Baseline">Industrial Exceedance — Flare Anomaly Outside Baseline</option>
                    <option value="Crop Stubble / Agricultural Clearing">Crop Stubble / Agricultural Clearing</option>
                    <option value="Sensor Glint — Solar Artifact (Reject)">Sensor Glint — Solar Artifact (Reject)</option>
                  </select>
                </div>

                {/* 2. Confidence Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-foreground">Certainty Rating</span>
                    <span className="font-mono text-foreground font-medium">{confidence}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full accent-foreground h-1.5 bg-input rounded-md cursor-pointer"
                  />
                </div>

                {/* 3. Direct Alert Checkbox */}
                <label className="flex items-start gap-2.5 bg-card p-2.5 rounded-md border border-border cursor-pointer hover:border-zinc-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={directAlert}
                    onChange={(e) => setDirectAlert(e.target.checked)}
                    className="mt-0.5 accent-foreground rounded"
                  />
                  <div>
                    <span className="text-xs font-medium text-foreground block">
                      Dispatch Notification to District Emergency Authorities
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5 leading-relaxed">
                      Sends automated vector coordinates and thermal summary to relevant forest division and state disaster cell.
                    </span>
                  </div>
                </label>

                {/* 4. Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs text-foreground block">
                    Verification Notes &amp; Observations
                  </label>
                  <textarea
                    rows={2}
                    value={assessmentNotes}
                    onChange={(e) => setAssessmentNotes(e.target.value)}
                    className="w-full bg-input border border-border text-xs text-foreground rounded-md p-2 focus:border-ring focus:outline-none"
                    placeholder="Enter analytical justification or satellite observation..."
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={handleConfirmCurrent}
                    className="flex-1 gap-1.5 text-xs font-medium"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirm Classification
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => onRequestSecondReview(selectedEpisode.id)}
                    className="text-xs"
                  >
                    Escalate
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onRejectGlint(selectedEpisode.id)}
                    className="text-xs gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Mark as Glint
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              No anomaly selected
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
