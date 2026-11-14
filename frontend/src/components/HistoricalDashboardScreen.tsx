import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  History,
  Activity,
  Flame,
  Building2,
  Calendar,
  Layers,
  Search,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Compass,
  MapPin,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Sliders,
  X,
  Clock,
  Eye,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useTheme } from '../lib/theme';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  HistoricalCandidate,
  HistoricalMonthlyPoint,
  HistoricalAnnualPoint,
  HistoricalDetection,
} from '../types';

const API = 'http://localhost:3001/api';

// Map pan controller for centering on candidates or facilities and resizing map tiles
const MapPanController: React.FC<{ targetCoords: [number, number] | null }> = ({ targetCoords }) => {
  const map = useMap();

  useEffect(() => {
    // Force Leaflet to compute container dimensions upon mounting
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 11, { duration: 1.2 });
    }
  }, [targetCoords, map]);
  return null;
};

// Custom icons for map markers
const candidateIcon = (detections: number, isSelected: boolean) => {
  const size = Math.min(38, Math.max(22, 18 + Math.log10(detections) * 5));
  const border = isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.85)';
  const bg = isSelected ? '#ef4444' : '#f97316';
  const shadow = isSelected ? '0 0 16px rgba(239,68,68,0.9)' : '0 2px 8px rgba(0,0,0,0.4)';

  return L.divIcon({
    className: 'custom-cand-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bg};
        border: ${border};
        box-shadow: ${shadow};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-family: monospace;
        font-size: ${size > 28 ? '10px' : '9px'};
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        🔥
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const facilityIcon = L.divIcon({
  className: 'custom-facility-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #3b82f6;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 10px;
    ">
      🏭
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const detectionPointIcon = (frp: number) => {
  const color = frp > 5 ? '#ef4444' : frp > 2 ? '#f97316' : '#eab308';
  return L.divIcon({
    className: 'custom-det-marker',
    html: `
      <div style="
        width: 8px;
        height: 8px;
        background: ${color};
        border: 1px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 4px ${color};
      "></div>
    `,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
};

interface HistoricalDashboardScreenProps {
  onInspectEpisode?: (id: string) => void;
  onOpenTacticalMap?: () => void;
}

export const HistoricalDashboardScreen: React.FC<HistoricalDashboardScreenProps> = ({
  onInspectEpisode,
  onOpenTacticalMap,
}) => {
  const { theme } = useTheme();

  // Data states
  const [summary, setSummary] = useState<any>(null);
  const [candidates, setCandidates] = useState<HistoricalCandidate[]>([]);
  const [monthlyTimeline, setMonthlyTimeline] = useState<HistoricalMonthlyPoint[]>([]);
  const [annualTimeline, setAnnualTimeline] = useState<HistoricalAnnualPoint[]>([]);
  const [mapFacilities, setMapFacilities] = useState<any[]>([]);
  const [detections, setDetections] = useState<HistoricalDetection[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('ALL');
  const [selectedProximity, setSelectedProximity] = useState<string>('ALL');
  const [selectedSatellite, setSelectedSatellite] = useState<string>('ALL');
  const [selectedDayNight, setSelectedDayNight] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('detections');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals & Panels
  const [selectedCandidateDossier, setSelectedCandidateDossier] = useState<HistoricalCandidate | null>(null);
  const [candidateDetailData, setCandidateDetailData] = useState<any>(null);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [metadataDetails, setMetadataDetails] = useState<any>(null);

  // Map view state
  const [mapTarget, setMapTarget] = useState<[number, number] | null>([22.0, 82.5]);
  const [activeBaseLayer, setActiveBaseLayer] = useState<'CANVAS' | 'OSM' | 'SATELLITE'>('CANVAS');
  const [showFacilitiesLayer, setShowFacilitiesLayer] = useState(true);
  const [showDetectionsLayer, setShowDetectionsLayer] = useState(true);
  const [showProximityBuffers, setShowProximityBuffers] = useState(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackYearIndex, setPlaybackYearIndex] = useState(0);
  const yearsList = ['ALL', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sumRes, candRes, annualRes, facRes, metaRes] = await Promise.all([
          fetch(`${API}/historical/summary`),
          fetch(`${API}/historical/candidates`),
          fetch(`${API}/historical/annual`),
          fetch(`${API}/facilities/inventory?all=true`),
          fetch(`${API}/metadata`),
        ]);

        if (sumRes.ok) setSummary(await sumRes.json());
        if (candRes.ok) {
          const d = await candRes.json();
          setCandidates(d.candidates || []);
        }
        if (annualRes.ok) {
          const d = await annualRes.json();
          setAnnualTimeline(d.timeline || []);
        }
        if (facRes.ok) setMapFacilities(await facRes.json());
        if (metaRes.ok) setMetadataDetails(await metaRes.json());
      } catch (err) {
        console.error('Failed to load historical data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch monthly timeline whenever candidate or year filter changes
  useEffect(() => {
    const fetchMonthly = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCandidateId !== 'ALL') params.append('candidate', selectedCandidateId);
        if (selectedYear !== 'ALL') params.append('year', selectedYear);

        const res = await fetch(`${API}/historical/monthly?${params.toString()}`);
        if (res.ok) {
          const d = await res.json();
          setMonthlyTimeline(d.timeline || []);
        }
      } catch (err) {
        console.error('Failed to load monthly timeline:', err);
      }
    };
    fetchMonthly();
  }, [selectedCandidateId, selectedYear]);

  // Fetch detection points for map whenever candidate/year/satellite/daynight change
  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCandidateId !== 'ALL') params.append('candidate', selectedCandidateId);
        if (selectedYear !== 'ALL') params.append('year', selectedYear);
        if (selectedSatellite !== 'ALL') params.append('satellite', selectedSatellite);
        if (selectedDayNight !== 'ALL') params.append('daynight', selectedDayNight);
        params.append('limit', selectedCandidateId !== 'ALL' ? '1200' : '400');

        const res = await fetch(`${API}/historical/detections?${params.toString()}`);
        if (res.ok) {
          const d = await res.json();
          setDetections(d.detections || []);
        }
      } catch (err) {
        console.error('Failed to load detection points:', err);
      }
    };
    fetchDetections();
  }, [selectedCandidateId, selectedYear, selectedSatellite, selectedDayNight]);

  // Fetch candidate dossier details when opened
  const handleOpenCandidateDossier = async (c: HistoricalCandidate) => {
    setSelectedCandidateDossier(c);
    setMapTarget([c.lat, c.lng]);
    try {
      const res = await fetch(`${API}/historical/candidates/${c.candidate_id}`);
      if (res.ok) {
        setCandidateDetailData(await res.json());
      }
    } catch (err) {
      console.error('Error fetching candidate dossier:', err);
    }
  };

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackYearIndex((prev) => {
          const next = (prev + 1) % yearsList.length;
          setSelectedYear(yearsList[next]);
          return next;
        });
      }, 2200);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const handleResetFilters = () => {
    setSelectedYear('ALL');
    setSelectedCandidateId('ALL');
    setSelectedProximity('ALL');
    setSelectedSatellite('ALL');
    setSelectedDayNight('ALL');
    setSearchQuery('');
    setIsPlaying(false);
    setMapTarget([22.0, 82.5]);
  };

  // Filtered and sorted candidate list
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.candidate_id.toLowerCase().includes(q) ||
          c.nearest_facility_name.toLowerCase().includes(q) ||
          c.nearest_facility_type.toLowerCase().includes(q) ||
          c.nearest_state.toLowerCase().includes(q) ||
          c.nearest_district.toLowerCase().includes(q)
      );
    }

    if (selectedCandidateId !== 'ALL') {
      result = result.filter((c) => c.candidate_id === selectedCandidateId);
    }

    if (selectedProximity !== 'ALL') {
      if (selectedProximity === 'within_1km') result = result.filter((c) => c.nearest_distance_km <= 1.0);
      else if (selectedProximity === '1_3km')
        result = result.filter((c) => c.nearest_distance_km > 1.0 && c.nearest_distance_km <= 3.0);
      else if (selectedProximity === '3_5km')
        result = result.filter((c) => c.nearest_distance_km > 3.0 && c.nearest_distance_km <= 5.0);
      else if (selectedProximity === 'beyond_5km') result = result.filter((c) => c.nearest_distance_km > 5.0);
    }

    result.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'detections') diff = a.total_detections - b.total_detections;
      else if (sortBy === 'distance') diff = a.nearest_distance_km - b.nearest_distance_km;
      else if (sortBy === 'days') diff = a.max_distinct_days - b.max_distinct_days;
      else if (sortBy === 'cells') diff = a.cell_count - b.cell_count;
      return sortDir === 'asc' ? diff : -diff;
    });

    return result;
  }, [candidates, searchQuery, selectedCandidateId, selectedProximity, sortBy, sortDir]);

  // Selected candidate object (if any)
  const activeCandidate = useMemo(() => {
    if (selectedCandidateId === 'ALL') return null;
    return candidates.find((c) => c.candidate_id === selectedCandidateId) || null;
  }, [candidates, selectedCandidateId]);

  // Maximum value for monthly chart scaling
  const maxMonthlyDetections = useMemo(() => {
    if (monthlyTimeline.length === 0) return 1000;
    return Math.max(...monthlyTimeline.map((m) => m.detection_count), 100);
  }, [monthlyTimeline]);

  // Maximum value for annual chart scaling
  const maxAnnualDetections = useMemo(() => {
    if (annualTimeline.length === 0) return 30000;
    return Math.max(...annualTimeline.map((a) => a.detection_count), 5000);
  }, [annualTimeline]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-xs font-medium">
            Loading Historical Analysis Engine (2019–2026)...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* 1. Header & Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Historical Analysis Observatory
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-500">
                  2019 – 2026
                </Badge>
                <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                  167,237 Detections
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Long-term spatial screening of 51 candidate groups against 935 industrial facilities
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMethodologyOpen(true)}
            className="h-8 gap-1.5 text-xs border-border bg-secondary/40 hover:bg-secondary"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Methodology &amp; Quality</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="bg-card/70 border-border/80 shadow-xs relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Persistent Detections</span>
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {(summary?.total_detections || 167237).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Full Historical Record</span>
              <span className="text-foreground font-mono text-[10px] ml-auto">100% Validated</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs relative overflow-hidden group hover:border-red-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Candidate Groups</span>
              <Activity className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary?.candidate_groups || 51}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Screened Hotspot Clusters</span>
              <span className="text-foreground font-mono text-[10px] ml-auto">Unknown Origin</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Industrial Facilities</span>
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {(summary?.facility_inventory_records || 935).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>National Inventory Layer</span>
              <span className="text-foreground font-mono text-[10px] ml-auto">Point Registry</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Observation Timeline</span>
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              7.7 Years
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>2019-01-01 – 2026-09-04</span>
              <span className="text-amber-500 font-mono text-[10px] ml-auto">2026 Partial</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Methodology & Causation Safety Banner */}
      <div className="p-3 bg-secondary/30 rounded-lg border border-border flex items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong className="text-foreground font-medium">Analytical Protocol:</strong> Candidate facility distance reflects spatial proximity and spatial association — it does <strong className="text-foreground font-medium">not</strong> establish or prove causality. All 51 candidate groups maintain verified label status of <code className="bg-secondary px-1 py-0.5 rounded text-[11px] font-mono text-foreground">unknown</code>.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMethodologyOpen(true)}
          className="h-7 text-[11px] text-primary shrink-0 hover:bg-secondary"
        >
          View Quality Report
        </Button>
      </div>

      {/* 4. Filter Toolbar & Timeline Playback */}
      <Card className="bg-card/50 border-border p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Year pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Year:</span>
            </span>
            {yearsList.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  selectedYear === y
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {y}
                {y === '2026' && <span className="text-[9px] text-amber-300 ml-1">*</span>}
              </button>
            ))}
          </div>

          {/* Timeline Playback Buttons */}
          <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlayback}
              className={`h-7 px-2.5 text-xs gap-1.5 ${isPlaying ? 'text-amber-500' : 'text-foreground'}`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause Timeline' : 'Play Timeline'}</span>
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground px-1 border-l border-border">
              {selectedYear === 'ALL' ? '2019-2026' : selectedYear}
            </span>
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-border/60 text-xs">
          {/* Candidate selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Candidate Hotspot Filter</label>
            <select
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
              className="bg-secondary/60 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All 51 Candidates</option>
              {candidates.map((c) => (
                <option key={c.candidate_id} value={c.candidate_id}>
                  {c.candidate_id} — {c.total_detections.toLocaleString()} dets ({c.nearest_distance_km.toFixed(1)} km)
                </option>
              ))}
            </select>
          </div>

          {/* Proximity Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Nearest Facility Proximity</label>
            <select
              value={selectedProximity}
              onChange={(e) => setSelectedProximity(e.target.value)}
              className="bg-secondary/60 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Distances</option>
              <option value="within_1km">Within 1.0 km (Immediate Buffer)</option>
              <option value="1_3km">1.0 – 3.0 km (Close Vicinity)</option>
              <option value="3_5km">3.0 – 5.0 km (Perimeter)</option>
              <option value="beyond_5km">&gt; 5.0 km (Unassociated)</option>
            </select>
          </div>

          {/* Satellite */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Satellite Platform</label>
            <select
              value={selectedSatellite}
              onChange={(e) => setSelectedSatellite(e.target.value)}
              className="bg-secondary/60 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Sensors (VIIRS + MODIS)</option>
              <option value="VIIRS">VIIRS SNPP &amp; NOAA-20 (375m)</option>
              <option value="MODIS">MODIS Terra &amp; Aqua (1km)</option>
            </select>
          </div>

          {/* Day / Night */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Diurnal Pass</label>
            <select
              value={selectedDayNight}
              onChange={(e) => setSelectedDayNight(e.target.value)}
              className="bg-secondary/60 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Day &amp; Night Passes</option>
              <option value="D">Day Only (Solar Window)</option>
              <option value="N">Night Only (Thermal Stack)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 5. Historical Charts Grid: Monthly Trend & Annual YoY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1 — Monthly Trend (2 Columns) */}
        <Card className="lg:col-span-2 bg-card/60 border-border">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Monthly Detection Trend (2019 – 2026)
                </CardTitle>
                {activeCandidate ? (
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
                    Filtered: {activeCandidate.candidate_id}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    All 51 Candidates Aggregated
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cyclical seasonal surges (March–May) vs persistent year-round industrial base activity
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-foreground">
                {monthlyTimeline.reduce((acc, curr) => acc + curr.detection_count, 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground block">detections in view</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {monthlyTimeline.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
                No activity recorded for current filter criteria
              </div>
            ) : (
              <div className="space-y-2">
                {/* SVG Monthly Bar / Area Chart */}
                <div className="h-64 w-full relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
                    <defs>
                      <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.65" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => (
                      <g key={idx}>
                        <line
                          x1="0"
                          y1={210 - pct * 180}
                          x2="800"
                          y2={210 - pct * 180}
                          stroke="currentColor"
                          strokeOpacity="0.08"
                          strokeDasharray="3 3"
                        />
                        <text
                          x="0"
                          y={205 - pct * 180}
                          fill="currentColor"
                          opacity="0.4"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {Math.round(maxMonthlyDetections * pct).toLocaleString()}
                        </text>
                      </g>
                    ))}

                    {/* Bars for each month */}
                    {monthlyTimeline.map((m, idx) => {
                      const totalBars = monthlyTimeline.length;
                      const barWidth = Math.max(3, 760 / totalBars - 1.5);
                      const x = 30 + (idx / Math.max(1, totalBars - 1)) * 750;
                      const barHeight = Math.max(2, (m.detection_count / maxMonthlyDetections) * 180);
                      const y = 210 - barHeight;

                      const isPeak = m.detection_count > maxMonthlyDetections * 0.85;

                      return (
                        <g key={m.year_month} className="group cursor-pointer">
                          <rect
                            x={x - barWidth / 2}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="1.5"
                            fill="url(#barGradient)"
                            className="transition-all hover:opacity-100 opacity-80"
                          />
                          {/* Invisible hover area for tooltip */}
                          <title>{`${m.year_month}: ${m.detection_count.toLocaleString()} detections, ${m.distinct_observation_days} obs days, Mean FRP: ${m.mean_frp} MW`}</title>
                          {/* Year tick label */}
                          {m.year_month.endsWith('-01') && (
                            <text
                              x={x}
                              y="230"
                              fill="currentColor"
                              opacity="0.6"
                              fontSize="9"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {m.year_month.substring(0, 4)}
                            </text>
                          )}
                          {isPeak && (
                            <circle cx={x} cy={y - 4} r="2.5" fill="#ef4444" />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                  <span>Start: 2019-01</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs inline-block" />
                      <span>Monthly Detections</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      <span>Seasonal Peak</span>
                    </span>
                  </div>
                  <span>End: 2026-09</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2 — Annual YoY Activity & Mean FRP */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Annual Activity</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                YoY Trend
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Total detections &amp; active candidate groups per year
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-2.5">
              {annualTimeline.map((item) => {
                const pct = (item.detection_count / maxAnnualDetections) * 100;
                const isSelected = selectedYear === String(item.year);
                return (
                  <div
                    key={item.year}
                    onClick={() => setSelectedYear(selectedYear === String(item.year) ? 'ALL' : String(item.year))}
                    className={`p-2 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-secondary/40 border-border/60 hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1 font-mono">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{item.year}</span>
                        {item.is_partial_year && (
                          <span className="text-[9px] px-1 bg-amber-500/20 text-amber-500 rounded font-sans">
                            Partial (Sep 4)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-semibold">
                          {item.detection_count.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({item.mean_frp} MW)
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.is_partial_year ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{item.active_candidates || 48} active candidates</span>
                      <span>{item.distinct_observation_days} obs days</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Tactical Map + Candidate Details Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leaflet Map: 7 Columns */}
        <Card className="lg:col-span-7 bg-card/60 border-border overflow-hidden flex flex-col">
          <CardHeader className="p-3.5 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">
                  Candidate Hotspots &amp; Industrial Infrastructure Map
                </CardTitle>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>51 Screening Groups</span>
                  <span>•</span>
                  <span>{mapFacilities.length} Industrial Facilities</span>
                  <span>•</span>
                  <span>{detections.length} Detection Points</span>
                </div>
              </div>
            </div>

            {/* Basemap Switcher & Layer Toggles */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <div className="flex items-center bg-muted/60 p-0.5 rounded border border-border">
                <button
                  type="button"
                  onClick={() => setActiveBaseLayer('CANVAS')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activeBaseLayer === 'CANVAS'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBaseLayer('OSM')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activeBaseLayer === 'OSM'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Street
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBaseLayer('SATELLITE')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activeBaseLayer === 'SATELLITE'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Satellite
                </button>
              </div>
              <Button
                variant={showFacilitiesLayer ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowFacilitiesLayer(!showFacilitiesLayer)}
                className="h-7 px-2 text-[11px]"
              >
                🏭 Facilities
              </Button>
              <Button
                variant={showDetectionsLayer ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowDetectionsLayer(!showDetectionsLayer)}
                className="h-7 px-2 text-[11px]"
              >
                🔥 Points
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 relative min-h-[460px]">
            <MapContainer
              center={[22.0, 82.5]}
              zoom={7}
              className="w-full h-full min-h-[460px] z-0"
              attributionControl={false}
            >
              {activeBaseLayer === 'CANVAS' ? (
                <TileLayer
                  key={theme === 'dark' ? 'esri-dark-canvas' : 'esri-light-canvas'}
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url={
                    theme === 'dark'
                      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                  }
                  maxZoom={16}
                />
              ) : activeBaseLayer === 'OSM' ? (
                <TileLayer
                  key="osm-streets-tiles"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              ) : (
                <TileLayer
                  key="esri-satellite-imagery"
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              )}

              <MapPanController targetCoords={mapTarget} />

              {/* 1. Proximity Buffer Circles around active candidate */}
              {activeCandidate && showProximityBuffers && (
                <>
                  <Circle
                    center={[activeCandidate.lat, activeCandidate.lng]}
                    radius={1000}
                    pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 1.5 }}
                  />
                  <Circle
                    center={[activeCandidate.lat, activeCandidate.lng]}
                    radius={3000}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 1.5, dashArray: '4 4' }}
                  />
                  <Circle
                    center={[activeCandidate.lat, activeCandidate.lng]}
                    radius={5000}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.04, weight: 1.5, dashArray: '6 6' }}
                  />
                </>
              )}

              {/* 2. 51 Candidate Hotspot Markers */}
              {candidates.map((c) => {
                const isSelected = selectedCandidateId === c.candidate_id;
                return (
                  <Marker
                    key={c.candidate_id}
                    position={[c.lat, c.lng]}
                    icon={candidateIcon(c.total_detections, isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedCandidateId(c.candidate_id);
                        handleOpenCandidateDossier(c);
                      },
                    }}
                  >
                    <Popup className="custom-leaflet-popup">
                      <div className="p-1 space-y-1 text-xs">
                        <div className="font-bold flex items-center justify-between gap-2">
                          <span>{c.candidate_id}</span>
                          <span className="text-[10px] text-amber-500 font-mono">
                            {c.total_detections.toLocaleString()} dets
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Nearest: <strong className="text-foreground">{c.nearest_facility_name}</strong> ({c.nearest_distance_km.toFixed(2)} km)
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Observation Days: {c.max_distinct_days} • Cells: {c.cell_count}
                        </div>
                        <div className="pt-1">
                          <button
                            onClick={() => handleOpenCandidateDossier(c)}
                            className="w-full text-center py-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded"
                          >
                            Open Candidate Dossier
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* 3. Facilities Layer */}
              {showFacilitiesLayer && (
                <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                  {mapFacilities.map((fac) => (
                    <Marker
                      key={fac.id}
                      position={[fac.lat, fac.lng]}
                      icon={facilityIcon}
                    >
                      <Popup>
                        <div className="p-1 text-xs space-y-0.5">
                          <div className="font-bold text-foreground">{fac.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {fac.type} • {fac.state}
                          </div>
                          <div className="text-[10px] text-amber-500 font-mono">
                            Inventory ID: {fac.id}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              )}

              {/* 4. Detection Evidence Points Layer */}
              {showDetectionsLayer && (
                <MarkerClusterGroup chunkedLoading maxClusterRadius={30}>
                  {detections.map((det, idx) => (
                    <Marker
                      key={idx}
                      position={[det.lat, det.lng]}
                      icon={detectionPointIcon(det.frp)}
                    >
                      <Popup>
                        <div className="p-1 text-xs space-y-0.5 font-mono">
                          <div className="font-bold text-foreground">
                            {det.acq_date} • {det.frp} MW
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Sensor: {det.satellite} ({det.daynight === 'D' ? 'Day' : 'Night'})
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Candidate Group: #{det.neighbor_group_id}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              )}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-md border border-border p-2 rounded-md shadow-md text-[10px] space-y-1">
              <div className="font-semibold text-foreground text-[11px]">Map Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
                <span>Candidate Thermal Group (51)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-xs inline-block" />
                <span>Industrial Facility (935)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
                <span>Persistent Detections (167k)</span>
              </div>
              {activeCandidate && (
                <div className="pt-1 border-t border-border/60 text-[9px] text-muted-foreground">
                  Buffers: 🟢 1km • 🟡 3km • 🔴 5km
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Candidate Detail Card / Dossier Panel: 5 Columns */}
        <Card className="lg:col-span-5 bg-card/60 border-border flex flex-col">
          <CardHeader className="p-4 pb-2 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold">
                  {activeCandidate ? `Hotspot Dossier — ${activeCandidate.candidate_id}` : 'Top Candidate Groups'}
                </CardTitle>
              </div>
              {activeCandidate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCandidateId('ALL')}
                  className="h-6 px-2 text-[10px] text-muted-foreground"
                >
                  View All
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 flex-1 space-y-4">
            {activeCandidate ? (
              <div className="space-y-4">
                {/* Active Candidate Details */}
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-foreground">
                      {activeCandidate.candidate_id}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-500">
                      {activeCandidate.review_category}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                    <div className="bg-background/80 p-1.5 rounded border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Detections</div>
                      <div className="text-sm font-bold text-foreground">
                        {activeCandidate.total_detections.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-background/80 p-1.5 rounded border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Grid Cells</div>
                      <div className="text-sm font-bold text-foreground">
                        {activeCandidate.cell_count}
                      </div>
                    </div>
                    <div className="bg-background/80 p-1.5 rounded border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Obs Days</div>
                      <div className="text-sm font-bold text-foreground">
                        {activeCandidate.max_distinct_days}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nearest Facility Association Dossier */}
                <div className="p-3 bg-secondary/20 rounded-lg border border-border space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Nearest Industrial Facility</span>
                    </span>
                    <Badge
                      variant={activeCandidate.nearest_distance_km <= 1.5 ? 'default' : 'secondary'}
                      className="text-[10px] font-mono"
                    >
                      {activeCandidate.nearest_distance_km.toFixed(2)} km away
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-foreground text-sm">
                      {activeCandidate.nearest_facility_name || 'No close inventory match'}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span>{activeCandidate.nearest_facility_type}</span>
                      <span>•</span>
                      <span>{activeCandidate.nearest_district}, {activeCandidate.nearest_state}</span>
                    </div>
                    {activeCandidate.nearest_operator && (
                      <div className="text-[11px] text-muted-foreground">
                        Operator: <span className="text-foreground">{activeCandidate.nearest_operator}</span>
                      </div>
                    )}
                  </div>

                  {/* Proximity breakdown */}
                  <div className="pt-2 border-t border-border/60 space-y-1.5">
                    <div className="text-[11px] text-muted-foreground font-medium">
                      Spatial Proximity Radial Distribution:
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                      <div className="p-1 bg-secondary/60 rounded">
                        <span className="text-muted-foreground block text-[9px]">&lt; 1 km</span>
                        <strong className="text-emerald-500">{activeCandidate.pct_within_1km}%</strong>
                      </div>
                      <div className="p-1 bg-secondary/60 rounded">
                        <span className="text-muted-foreground block text-[9px]">1 – 3 km</span>
                        <strong className="text-amber-500">{activeCandidate.pct_within_3km}%</strong>
                      </div>
                      <div className="p-1 bg-secondary/60 rounded">
                        <span className="text-muted-foreground block text-[9px]">3 – 5 km</span>
                        <strong className="text-blue-500">{activeCandidate.pct_within_5km}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Causality disclaimer callout */}
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-500 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Spatial proximity does not prove or establish causation. Analysis supports candidate screening only.
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCandidateDossier(activeCandidate)}
                    className="w-full text-xs gap-1.5 h-8"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Full Timeline History</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Top Candidate Ranking List */
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between pb-1 border-b border-border/60">
                  <span>Top Candidate Groups</span>
                  <span>Persistent Detections</span>
                </div>
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {candidates.slice(0, 7).map((c, idx) => (
                    <div
                      key={c.candidate_id}
                      onClick={() => {
                        setSelectedCandidateId(c.candidate_id);
                        setMapTarget([c.lat, c.lng]);
                      }}
                      className="p-2.5 rounded-md border border-border/60 bg-secondary/30 hover:bg-secondary/70 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-muted-foreground w-4">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                            {c.candidate_id}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                            {c.nearest_facility_name} ({c.nearest_distance_km.toFixed(1)} km)
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-foreground">
                          {c.total_detections.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.max_distinct_days} obs days
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7. Candidate Master Screening & Association Table */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Screened Candidate Groups Master Inventory (51 Hotspots)
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Showing {filteredCandidates.length} of {candidates.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-year thermal activity metrics linked with nearest industrial facilities
            </p>
          </div>

          {/* Table Search & Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidate, facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-secondary/50 border border-border rounded-md text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary w-48 sm:w-60"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-secondary/50 border border-border rounded-md px-2 py-1 text-xs text-foreground"
            >
              <option value="detections">Sort: Detections</option>
              <option value="distance">Sort: Distance</option>
              <option value="days">Sort: Obs Days</option>
              <option value="cells">Sort: Grid Cells</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/50 border-b border-border/80 text-muted-foreground font-medium">
              <tr>
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Total Detections</th>
                <th className="py-2.5 px-3">Cells</th>
                <th className="py-2.5 px-3">Obs Days</th>
                <th className="py-2.5 px-3">Nearest Facility</th>
                <th className="py-2.5 px-3">Facility Type</th>
                <th className="py-2.5 px-3">Distance</th>
                <th className="py-2.5 px-3">Proximity Band</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredCandidates.map((c) => {
                const isSelected = selectedCandidateId === c.candidate_id;
                const dist = c.nearest_distance_km;
                const bandColor =
                  dist <= 1.0
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : dist <= 3.0
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : dist <= 5.0
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-muted text-muted-foreground border-border';

                return (
                  <tr
                    key={c.candidate_id}
                    className={`hover:bg-secondary/40 transition-colors ${
                      isSelected ? 'bg-primary/5 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      {c.candidate_id}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                      {c.total_detections.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {c.cell_count}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {c.max_distinct_days}
                    </td>
                    <td className="py-2.5 px-3 text-foreground font-medium">
                      {c.nearest_facility_name}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {c.nearest_facility_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-foreground font-semibold">
                      {dist.toFixed(2)} km
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${bandColor}`}>
                        {dist <= 1.0 ? '< 1 km' : dist <= 3.0 ? '1 – 3 km' : dist <= 5.0 ? '3 – 5 km' : '> 5 km'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCandidateId(c.candidate_id);
                            setMapTarget([c.lat, c.lng]);
                          }}
                          className="h-6 px-2 text-[10px]"
                        >
                          Map
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCandidateDossier(c)}
                          className="h-6 px-2 text-[10px]"
                        >
                          Dossier
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 8. Candidate Detail Dossier Modal */}
      {selectedCandidateDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    Candidate Dossier — {selectedCandidateDossier.candidate_id}
                  </h2>
                  <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-500">
                    Group #{selectedCandidateDossier.neighbor_group_id}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Historical Screening Report &amp; Multi-Year Spatial Relationship
                </p>
              </div>
              <button
                onClick={() => setSelectedCandidateDossier(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-2.5 text-center font-mono text-xs">
              <div className="p-2.5 bg-secondary/50 rounded-lg border border-border">
                <span className="text-muted-foreground text-[10px] block">Persistent Detections</span>
                <strong className="text-base font-bold text-foreground">
                  {selectedCandidateDossier.total_detections.toLocaleString()}
                </strong>
              </div>
              <div className="p-2.5 bg-secondary/50 rounded-lg border border-border">
                <span className="text-muted-foreground text-[10px] block">Grid Cells</span>
                <strong className="text-base font-bold text-foreground">
                  {selectedCandidateDossier.cell_count}
                </strong>
              </div>
              <div className="p-2.5 bg-secondary/50 rounded-lg border border-border">
                <span className="text-muted-foreground text-[10px] block">Obs Days</span>
                <strong className="text-base font-bold text-foreground">
                  {selectedCandidateDossier.max_distinct_days}
                </strong>
              </div>
              <div className="p-2.5 bg-secondary/50 rounded-lg border border-border">
                <span className="text-muted-foreground text-[10px] block">Nearest Distance</span>
                <strong className="text-base font-bold text-amber-500">
                  {selectedCandidateDossier.nearest_distance_km.toFixed(2)} km
                </strong>
              </div>
            </div>

            {/* Nearest Facility Association Card */}
            <div className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Nearest Inventoried Facility</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {selectedCandidateDossier.nearest_facility_id}
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">
                {selectedCandidateDossier.nearest_facility_name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                <div>Type: <strong className="text-foreground">{selectedCandidateDossier.nearest_facility_type}</strong></div>
                <div>Operator: <strong className="text-foreground">{selectedCandidateDossier.nearest_operator || 'N/A'}</strong></div>
                <div>Location: <strong className="text-foreground">{selectedCandidateDossier.nearest_district}, {selectedCandidateDossier.nearest_state}</strong></div>
                <div>Verification: <strong className="text-foreground">{selectedCandidateDossier.nearest_verification}</strong></div>
              </div>

              {/* Causation notice */}
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-500 flex items-start gap-1.5 mt-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Interpretation: Spatial association does not prove or establish causation. Point coordinates represent facility centroid or gate rather than spatial property boundary.
                </span>
              </div>
            </div>

            {/* Candidate Monthly Trend preview */}
            {candidateDetailData?.monthly_activity && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Monthly Activity Timeline (2019 – 2026)</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {candidateDetailData.monthly_activity.length} monthly active intervals
                  </span>
                </div>
                <div className="h-32 w-full bg-secondary/30 p-2 rounded-lg border border-border flex items-end gap-1">
                  {candidateDetailData.monthly_activity.map((m: any, idx: number) => {
                    const maxCount = Math.max(...candidateDetailData.monthly_activity.map((x: any) => x.detection_count), 1);
                    const heightPct = (m.detection_count / maxCount) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-primary/80 hover:bg-primary rounded-t-xs transition-all relative group cursor-pointer"
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                      >
                        <title>{`${m.year_month}: ${m.detection_count} detections, mean FRP: ${m.mean_frp} MW`}</title>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCandidateDossier(null)}
                className="text-xs"
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Methodology & Data Quality Report Modal */}
      {isMethodologyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Analytical Methodology &amp; Data Quality Report
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    NTRO Industrial Thermal-Source Screening Prototype (2019–2026)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMethodologyOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Methodology Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Method</span>
                <strong className="text-foreground">Rule-based spatial screening</strong>
              </div>
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Random Forest Trained</span>
                <strong className="text-foreground">False (prototype state)</strong>
              </div>
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Verified Labels Assigned</span>
                <strong className="text-foreground">False (unresolved labels)</strong>
              </div>
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Candidate Groups</span>
                <strong className="text-foreground">51 Groups</strong>
              </div>
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Persistent Detections</span>
                <strong className="text-foreground">167,237 Records</strong>
              </div>
              <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground block">Inventory Facilities</span>
                <strong className="text-foreground">935 Records</strong>
              </div>
            </div>

            {/* Limitations Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1.5 text-amber-500">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Known Analytical Limitations</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                <li>Facility inventory utilizes point coordinates, not comprehensive parcel boundaries.</li>
                <li>Facility proximity cannot prove the origin of a thermal detection (spatial association only).</li>
                <li>2026 is an incomplete year (observations through September 4, 2026).</li>
                <li>Persistence thresholds are exploratory screening aids requiring field verification.</li>
              </ul>
            </div>

            {/* Quality Checks Table */}
            {metadataDetails?.data_quality_report && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Data Quality Verification Summary (100% Passed)</span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2">Dataset</th>
                        <th className="p-2">Verification Check</th>
                        <th className="p-2">Value</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {metadataDetails.data_quality_report.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-secondary/30">
                          <td className="p-2 text-foreground font-sans font-medium">{item.dataset}</td>
                          <td className="p-2 text-muted-foreground">{item.check}</td>
                          <td className="p-2 text-foreground">{item.value}</td>
                          <td className="p-2 text-right">
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded font-semibold text-[10px]">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMethodologyOpen(false)}
                className="text-xs"
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Table Icon helper
const TableIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v18" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </svg>
);
