import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ScreenTab, ThermalEpisode, IndustrialFacility, AnalystUser } from './types';
import { CURRENT_ANALYST } from './data/generatedData';
import { ThemeProvider } from './lib/theme';
import { Header } from './components/Header';
import { DispatchAlertModal } from './components/DispatchAlertModal';

// Lazy-load all heavy screens — each only loads when first visited
const HistoricalDashboardScreen = lazy(() => import('./components/HistoricalDashboardScreen').then(m => ({ default: m.HistoricalDashboardScreen })));
const MapDashboardScreen = lazy(() => import('./components/MapDashboardScreen').then(m => ({ default: m.MapDashboardScreen })));
const ReviewQueueScreen = lazy(() => import('./components/ReviewQueueScreen').then(m => ({ default: m.ReviewQueueScreen })));
const EpisodesTableScreen = lazy(() => import('./components/EpisodesTableScreen').then(m => ({ default: m.EpisodesTableScreen })));
const FacilitiesDirectoryScreen = lazy(() => import('./components/FacilitiesDirectoryScreen').then(m => ({ default: m.FacilitiesDirectoryScreen })));
const AnalyticsTrendsScreen = lazy(() => import('./components/AnalyticsTrendsScreen').then(m => ({ default: m.AnalyticsTrendsScreen })));
const AuthScreen = lazy(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen })));
const LoginModal = lazy(() => import('./components/LoginModal').then(m => ({ default: m.LoginModal })));
const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
import { OfficerChatbot } from './components/OfficerChatbot';
import { API } from './lib/api';

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-muted-foreground text-xs font-medium">Loading module...</span>
    </div>
  </div>
);

// Compute deterministic, facility-specific industrial thermal metrics
function computeFacilityThermalSpecs(f: any) {
  const idStr = String(f.id || '').trim();
  const positiveHash = Math.abs(idStr.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0));
  const type = String(f.type || '').toLowerCase();
  const risk = typeof f.risk_score === 'number' ? f.risk_score : 50;
  const status = String(f.status || '').trim().toUpperCase();

  // 1. Nominal FRP Cap (Permit Threshold) in MW by facility type & size
  let nominalCap = 600;
  if (type.includes('thermal') || type.includes('power')) {
    nominalCap = 500 + (positiveHash % 10) * 100; // 500 - 1400 MW
  } else if (type.includes('refinery') || type.includes('petro')) {
    nominalCap = 400 + (positiveHash % 6) * 100; // 400 - 900 MW
  } else if (type.includes('steel') || type.includes('cement')) {
    nominalCap = 300 + (positiveHash % 5) * 100; // 300 - 700 MW
  } else {
    nominalCap = 150 + (positiveHash % 6) * 50;  // 150 - 400 MW
  }

  // 2. Baseline Operating MW (45% - 65% of permit cap)
  const baselineRatio = 0.45 + ((positiveHash % 20) / 100);
  const baselineOperating = Math.round(nominalCap * baselineRatio);

  // 3. Peak Radiance (12m) in MW based on regulatory status
  let peakMw: number;
  if (status === 'EXCEEDANCE') {
    const exceedanceRatio = 1.15 + (risk / 100) * 0.40;
    peakMw = Math.round(nominalCap * exceedanceRatio);
  } else if (status === 'PERSISTENT') {
    const persistentRatio = 0.92 + ((positiveHash % 14) / 100);
    peakMw = Math.round(nominalCap * persistentRatio);
  } else {
    const nominalRatio = 0.50 + ((positiveHash % 28) / 100);
    peakMw = Math.round(nominalCap * nominalRatio);
  }

  // 4. Realistic monitored optical stacks
  const stackOptions = ['2 Stacks', '3 Stacks', '4 Stacks', '6 Stacks', '8 Stacks'];
  const registeredStacks = stackOptions[positiveHash % stackOptions.length];

  // 5. 12-Month Monthly FRP Profile
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const peakMonthIdx = positiveHash % 12;
  const monthlyFRP = months.map((month, i) => {
    const dist = Math.min(Math.abs(i - peakMonthIdx), 12 - Math.abs(i - peakMonthIdx));
    const noise = Math.sin((positiveHash + i * 5) * 0.7) * 0.12;
    let val: number;
    if (dist === 0) {
      val = peakMw;
    } else if (dist === 1) {
      val = Math.round(baselineOperating + (peakMw - baselineOperating) * 0.65 + noise * 25);
    } else if (dist === 2) {
      val = Math.round(baselineOperating + (peakMw - baselineOperating) * 0.30 + noise * 15);
    } else {
      val = Math.max(15, Math.round(baselineOperating * (1 + noise)));
    }
    return {
      month,
      value: val,
      limit: nominalCap,
    };
  });

  return {
    nominalCap,
    baselineOperating,
    peakMw,
    registeredStacks,
    monthlyFRP,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ScreenTab>('historical');
  const [episodes, setEpisodes] = useState<ThermalEpisode[]>([]);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [analyst, setAnalyst] = useState<AnalystUser>(CURRENT_ANALYST);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMapTarget, setSelectedMapTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    risk: string;
    category: string;
    frp: number;
    title: string;
  } | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [dispatchModalData, setDispatchModalData] = useState<{
    isOpen: boolean;
    episode: ThermalEpisode | null;
    classification: string;
    confidence: number;
  }>({ isOpen: false, episode: null, classification: '', confidence: 95 });

  // Fetch initial data from the backend API
  useEffect(() => {
    const load = async () => {
      try {
        const [firesRes, facsRes] = await Promise.all([
          fetch(`${API}/fires?limit=200`),
          fetch(`${API}/facilities?limit=208`),
        ]);

        if (firesRes.ok) {
          const data = await firesRes.json();
          // Map API response to ThermalEpisode shape
          const eps: ThermalEpisode[] = data.items.map((f: any) => ({
            id: f.id,
            title: f.title,
            districtState: f.state || 'Southern Zone',
            coordinates: {
              lat: f.lat,
              lng: f.lng,
              latStr: `${f.lat.toFixed(4)}° N`,
              lngStr: `${f.lng.toFixed(4)}° E`,
            },
            sensorPlatform: f.satellite || 'VIIRS SNPP',
            firstDetectedUtc: `${f.acq_date} UTC`,
            timelineAge: 'Active (Recent)',
            relativeTime: 'Recent',
            radiantHeatMw: f.frp,
            frpPeakMw: f.frp,
            mlInference: f.classification.toUpperCase(),
            confidence: f.confidence,
            riskLevel: f.risk,
            urgencyTier: f.risk === 'CRITICAL' ? 'TIER 1 - IMMEDIATE' : f.risk === 'HIGH' ? 'TIER 2 - PRIORITY' : 'ROUTINE',
            ppacProximityKm: f.dist_km,
            status: 'AWAITING VERIFICATION',
            groundTruthClassification: undefined,
            topoData: {
              frontAdvance: 'N/A',
              perimeter: `${f.dist_km} km`,
              elevation: 'Unknown',
              landCoverMatrix: `Dominant: ${f.lulc_dominant}`,
              flameFrontWidth: 'N/A',
              imageUrl: '',
            },
            thermalData: {
              temperatureRange: 'SLSTR TIR',
              contrast: `${f.frp} MW`,
              facilityBufferCheck: `${f.dist_km} km`,
              imageUrl: '',
            },
            lulcData: {
              dominantClass: f.lulc_dominant,
              cropsPct: f.lulc_crops,
              treesPct: f.lulc_trees,
              urbanPct: f.lulc_urban,
              rangelandPct: f.lulc_rangeland,
            },
          }));
          setEpisodes(eps);
        }

        if (facsRes.ok) {
          const data = await facsRes.json();
          const facs: IndustrialFacility[] = data.items.map((f: any) => {
            const specs = computeFacilityThermalSpecs(f);
            return {
              id: (f.id || '').trim(),
              name: (f.name || '').trim(),
              shortName: (f.name || '').trim().substring(0, 30),
              category: f.type?.includes('thermal') || f.type?.includes('power') ? 'Thermal' : 'Refineries',
              stateZone: (f.state || '').trim(),
              district: (f.district || '').trim(),
              coordinates: {
                lat: f.lat,
                lng: f.lng,
                latStr: `${f.lat.toFixed(4)}° N`,
                lngStr: `${f.lng.toFixed(4)}° E`,
              },
              bufferRadiusKm: 5.0,
              status: f.status,
              linkedEpisodesCount: f.fire_count,
              baselineOperatingMw: specs.baselineOperating,
              peakFrp12mMw: specs.peakMw,
              nominalFrpCapMw: specs.nominalCap,
              registeredStacks: specs.registeredStacks,
              bufferOverlaps: `Risk Score: ${f.risk_score}`,
              satelliteFeed: { orbitPass: '12:00 UTC', fov: '5.0 KM²', target: 'MAIN', coreTemp: 'N/A', sensor: 'VIIRS', calibration: 'STD', imageUrl: '' },
              cctvFeed: { title: 'GROUND TRUTH', exceedanceStatus: f.status, flameVelocity: 'N/A', stackHeight: 'N/A', analytics: 'Risk Engine', plumeDispersion: 'N/A', imageUrl: '' },
              monthlyFRP: specs.monthlyFRP,
              recentDetections: [],
            };
          });
          setFacilities(facs);
        }
      } catch (err) {
        console.warn('API server not reachable, using empty data. Run: npm run server');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleConfirmEpisode = (id: string, classification: string, confidence: number, notes: string, directAlert: boolean) => {
    const ep = episodes.find((e) => e.id === id);
    if (!ep) return;
    setEpisodes((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'CONFIRMED', groundTruthClassification: classification, confidence, notes, directAlertSent: directAlert } : e)
    );
    if (directAlert) {
      setDispatchModalData({ isOpen: true, episode: ep, classification, confidence });
    }
  };

  const handleRejectGlint = (id: string) => {
    setEpisodes((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'REJECTED_GLINT', confidence: 5, mlInference: 'Solar Glint (Rejected)' } : e)
    );
  };

  const handleRequestSecondReview = (id: string) => {
    alert(`Episode ${id} escalated to Senior Imagery Specialist.`);
  };

  const handleSelectEpisodeToReview = (_id: string) => setActiveTab('review');
  const handleSelectEpisodeForMap = (id: string) => {
    // 1. Look up in loaded episodes
    const ep = episodes.find((e) => e.id === id);
    if (ep) {
      setSelectedMapTarget({
        id: ep.id,
        lat: ep.coordinates.lat,
        lng: ep.coordinates.lng,
        risk: ep.riskLevel,
        category: ep.mlInference.toLowerCase(),
        frp: ep.radiantHeatMw,
        title: ep.title,
      });
      setActiveTab('map');
      return;
    }

    // 2. Look up in loaded facilities
    const fac = facilities.find((f) => f.id === id);
    if (fac) {
      setSelectedMapTarget({
        id: fac.id,
        lat: fac.coordinates.lat,
        lng: fac.coordinates.lng,
        risk: 'CRITICAL',
        category: fac.category.toLowerCase(),
        frp: fac.peakFrp12mMw || 100,
        title: fac.name,
      });
      setActiveTab('map');
      return;
    }

    // 3. Fallback: fetch from API by ID
    fetch(`${API}/fires?search=${encodeURIComponent(id)}&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          const f = data.items[0];
          setSelectedMapTarget({
            id: f.id,
            lat: f.lat,
            lng: f.lng,
            risk: f.risk || 'HIGH',
            category: (f.classification || 'refinery').toLowerCase(),
            frp: f.frp || 0,
            title: f.title || `Anomaly ${f.id}`,
          });
        }
      })
      .catch(() => {});

    setActiveTab('map');
  };
  const handleOpenFacilityDossier = (_facilityId?: string) => setActiveTab('facilities');
  const pendingReviewCount = episodes.filter((e) => e.status === 'AWAITING VERIFICATION').length;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reviewCount={pendingReviewCount}
          analyst={analyst}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
        />

        <main className="flex-1 w-full pb-12">
          {isLoading ? (
            <LoadingScreen />
          ) : (
            <Suspense fallback={<LoadingScreen />}>
              {activeTab === 'historical' && (
                <HistoricalDashboardScreen
                  onInspectEpisode={handleSelectEpisodeToReview}
                  onOpenTacticalMap={() => setActiveTab('map')}
                />
              )}
              {activeTab === 'auth' && (
                <AuthScreen
                  currentAnalyst={analyst}
                  onLoginSuccess={(a) => setAnalyst(a)}
                  onNavigateToConsole={(tab) => setActiveTab(tab || 'review')}
                />
              )}
              {activeTab === 'review' && (
                <ReviewQueueScreen
                  episodes={episodes}
                  onConfirmEpisode={handleConfirmEpisode}
                  onRejectGlint={handleRejectGlint}
                  onRequestSecondReview={handleRequestSecondReview}
                  onSelectEpisodeForMap={handleSelectEpisodeForMap}
                />
              )}
              {activeTab === 'episodes' && (
                <EpisodesTableScreen
                  episodes={episodes}
                  onSelectEpisodeToReview={handleSelectEpisodeToReview}
                  onSelectEpisodeForMap={handleSelectEpisodeForMap}
                />
              )}
              {activeTab === 'facilities' && (
                <FacilitiesDirectoryScreen
                  facilities={facilities}
                  onInspectEpisode={handleSelectEpisodeToReview}
                  onOpenMapForFacility={handleSelectEpisodeForMap}
                />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsTrendsScreen
                  onOpenReviewQueue={() => setActiveTab('review')}
                  onInspectEpisode={handleSelectEpisodeToReview}
                />
              )}
              {activeTab === 'map' && (
                <MapDashboardScreen
                  onSelectEpisodeToReview={handleSelectEpisodeToReview}
                  onOpenFacilityDossier={handleOpenFacilityDossier}
                  targetHotspot={selectedMapTarget}
                  onClearTargetHotspot={() => setSelectedMapTarget(null)}
                />
              )}
            </Suspense>
          )}
        </main>

        <Suspense fallback={null}>
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            episodes={episodes}
            facilities={facilities}
            onSelectEpisode={handleSelectEpisodeToReview}
            onSelectFacility={handleOpenFacilityDossier}
            setActiveTab={setActiveTab}
          />
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            currentAnalyst={analyst}
            onLoginSuccess={(a) => setAnalyst(a)}
          />
        </Suspense>

        <OfficerChatbot
          facilities={facilities}
          episodes={episodes}
          onNavigateToTab={setActiveTab}
          onOpenFacilityDossier={handleOpenFacilityDossier}
          onOpenMapForFacility={handleSelectEpisodeForMap}
        />

        <DispatchAlertModal
          isOpen={dispatchModalData.isOpen}
          onClose={() => setDispatchModalData((p) => ({ ...p, isOpen: false }))}
          episode={dispatchModalData.episode}
          classification={dispatchModalData.classification}
          confidence={dispatchModalData.confidence}
        />
      </div>
    </ThemeProvider>
  );
}
