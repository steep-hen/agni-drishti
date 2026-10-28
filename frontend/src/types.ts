export type ScreenTab = 'map' | 'episodes' | 'facilities' | 'analytics' | 'historical' | 'review' | 'auth';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';

export type UrgencyTier = 
  | 'TIER 1 - IMMEDIATE' 
  | 'TIER 2 - PRIORITY' 
  | 'TIER 3 - MONITOR' 
  | 'ROUTINE';

export type AnomalyClassification = 
  | 'INDUSTRIAL_LIKELY'
  | 'FOREST_FIRE_LIKELY'
  | 'INDUSTRIAL_ACTIVITY'
  | 'UNCERTAIN'
  | 'COAL_FIRE_SMOLDERING'
  | 'SENSOR_GLINT';

export interface HistoricalCandidate {
  candidate_id: string;
  neighbor_group_id: number;
  cell_count: number;
  total_detections: number;
  max_distinct_days: number;
  min_distinct_days: number;
  lat: number;
  lng: number;
  nearest_facility_id: string;
  nearest_facility_name: string;
  nearest_facility_type: string;
  nearest_facility_subtype: string;
  nearest_operator: string;
  nearest_state: string;
  nearest_district: string;
  nearest_distance_km: number;
  nearest_verification: string;
  detections_within_1km: number;
  detections_within_3km: number;
  detections_within_5km: number;
  pct_within_1km: number;
  pct_within_3km: number;
  pct_within_5km: number;
  source_class: string;
  review_category: string;
  classification_method: string;
  random_forest_trained: boolean;
  facility_proximity_is_causation: boolean;
}

export interface HistoricalMonthlyPoint {
  neighbor_group_id?: number;
  candidate_id?: string;
  year_month: string;
  year?: number;
  month?: number;
  detection_count: number;
  distinct_observation_days: number;
  mean_frp: number;
  median_frp?: number;
  max_frp: number;
  active_candidates?: number;
}

export interface HistoricalAnnualPoint {
  neighbor_group_id?: number;
  candidate_id?: string;
  year: number;
  detection_count: number;
  distinct_observation_days: number;
  active_months?: number;
  active_candidates?: number;
  mean_frp: number;
  median_frp?: number;
  max_frp: number;
  is_partial_year?: boolean;
}

export interface HistoricalDetection {
  lat: number;
  lng: number;
  acq_date: string;
  frp: number;
  satellite: string;
  confidence: string;
  daynight: string;
  neighbor_group_id: number;
  nearest_facility_name: string;
  nearest_distance_km: number;
}

export interface ThermalEpisode {
  id: string; // e.g. "EP-2026-04821"
  title: string; // "Bastar Dense Canopy Corridor, CG"
  districtState: string; // "Jagdalpur Div, CG"
  coordinates: {
    lat: number;
    lng: number;
    latStr: string;
    lngStr: string;
  };
  sensorPlatform: string; // "VIIRS SNPP 375m"
  firstDetectedUtc: string; // "11:14:02 UTC"
  timelineAge: string; // "Active 4h (3h 41m ago)"
  relativeTime: string; // "3h 41m ago"
  radiantHeatMw: number; // 78.4
  frpPeakMw: number;
  mlInference: string; // "UNCERTAIN (?)"
  confidence: number; // 44.5
  riskLevel: RiskLevel;
  urgencyTier: UrgencyTier;
  ppacProximityKm: number; // 8.4
  isCanopyBreach?: boolean;
  status: 'AWAITING VERIFICATION' | 'CONFIRMED' | 'RECLASSIFIED' | 'REJECTED_GLINT';
  groundTruthClassification?: string;
  notes?: string;
  directAlertSent?: boolean;
  
  // Detailed imagery & metadata
  topoData?: {
    frontAdvance: string; // "18 km/h WSW ADVANCE"
    perimeter: string; // "Perimeter: 14.2 km Active Front"
    elevation: string; // "Elev. 2450m Peak"
    landCoverMatrix: string; // "82% Dense Sal Forest"
    flameFrontWidth: string; // "Avg 120m Intensity Belt"
    imageUrl: string;
  };
  thermalData?: {
    temperatureRange: string; // "SLSTR TIR // 35°C - 900°C"
    contrast: string; // "+48.2 K Above Baseline"
    facilityBufferCheck: string; // "8.4 km (Clear of Refinery)"
    imageUrl: string;
  };
  lulcData?: {
    dominantClass: string;
    cropsPct: number;
    treesPct: number;
    urbanPct: number;
    rangelandPct: number;
  };
}

export interface IndustrialFacility {
  id: string; // "PPAC-REF-009-SEC4"
  name: string; // "Reliance Jamnagar Refinery Complex — Sector 4 Flaring Infrastructure"
  shortName: string; // "Reliance Jamnagar Refinery Complex — Sector 4"
  category: 'Refineries' | 'Thermal' | 'Steel' | 'Coal' | 'LNG';
  stateZone: string; // "Gujarat, West Zone"
  district: string; // "Jamnagar, Gujarat"
  coordinates: {
    lat: number;
    lng: number;
    latStr: string;
    lngStr: string;
  };
  bufferRadiusKm: number; // 4.8
  status: 'EXCEEDANCE' | 'NOMINAL' | 'SCHEDULED' | 'PERSISTENT';
  linkedEpisodesCount: number;
  baselineOperatingMw: number;
  peakFrp12mMw: number;
  nominalFrpCapMw: number;
  registeredStacks: string; // "14 Active / 2 Stby"
  bufferOverlaps: string; // "0 Wildfire"
  satelliteFeed: {
    orbitPass: string;
    fov: string;
    target: string;
    coreTemp: string;
    sensor: string;
    calibration: string;
    imageUrl: string;
  };
  cctvFeed: {
    title: string;
    exceedanceStatus: string;
    flameVelocity: string;
    stackHeight: string;
    analytics: string;
    plumeDispersion: string;
    imageUrl: string;
  };
  monthlyFRP: { month: string; value: number; limit: number }[];
  recentDetections: {
    id: string;
    timestampUtc: string;
    frpMw: number;
    sensor: string;
    classification: string;
    analystStatus: string;
    flagged?: boolean;
  }[];
}

export interface AnalystUser {
  name: string;
  callsign: string;
  idNumber: string;
  email: string;
  role: string;
  clearanceLevel: string;
  isAuthenticated: boolean;
}

