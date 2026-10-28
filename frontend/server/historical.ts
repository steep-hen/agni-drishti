import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { Router } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

export const historicalRouter = Router();

// Robust CSV parser handling quotes, commas, and line endings
function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = splitLine(rawLine);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }
  return rows;
}

// 1. Load Data Files
console.log('Loading historical datasets from', ROOT_DATA_DIR);

const candidateMasterRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'historical', 'candidate_analytics_master.csv'), 'utf-8')
);
const annualRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'historical', 'annual_candidate_activity.csv'), 'utf-8')
);
const monthlyRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'historical', 'monthly_candidate_activity.csv'), 'utf-8')
);
const associationsRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'facilities', 'candidate_facility_associations.csv'), 'utf-8')
);
const facilityInventoryRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'facilities', 'facility_inventory.csv'), 'utf-8')
);
const dataQualityRaw = parseCSV(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'metadata', 'data_quality_report.csv'), 'utf-8')
);
const metadataRaw = JSON.parse(
  fs.readFileSync(path.join(ROOT_DATA_DIR, 'metadata', 'processing_metadata.json'), 'utf-8')
);

// Open indexed SQLite for 167,237 detections
const dbPath = path.join(ROOT_DATA_DIR, 'historical', 'detections.db');
let detectionsDb: DatabaseSync | null = null;
if (fs.existsSync(dbPath)) {
  detectionsDb = new DatabaseSync(dbPath);
  console.log('Opened detections.db SQLite database successfully');
} else {
  console.warn('detections.db not found at', dbPath);
}

// Format candidates
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

const candidates: HistoricalCandidate[] = candidateMasterRaw.map((row) => ({
  candidate_id: row.candidate_id || `CAND_${String(row.neighbor_group_id).padStart(3, '0')}`,
  neighbor_group_id: parseInt(row.neighbor_group_id, 10),
  cell_count: parseInt(row.cell_count, 10) || 1,
  total_detections: parseInt(row.total_detections, 10) || 0,
  max_distinct_days: parseInt(row.max_distinct_days, 10) || 0,
  min_distinct_days: parseInt(row.min_distinct_days, 10) || 0,
  lat: parseFloat(row.representative_latitude) || 0,
  lng: parseFloat(row.representative_longitude) || 0,
  nearest_facility_id: row.nearest_canonical_facility_id,
  nearest_facility_name: row.nearest_facility_name,
  nearest_facility_type: row.nearest_facility_type,
  nearest_facility_subtype: row.nearest_facility_subtype,
  nearest_operator: row.nearest_operator,
  nearest_state: row.nearest_state,
  nearest_district: row.nearest_district,
  nearest_distance_km: parseFloat(row.nearest_facility_distance_km) || 0,
  nearest_verification: row.nearest_verification_status,
  detections_within_1km: parseInt(row.detections_within_1km, 10) || 0,
  detections_within_3km: parseInt(row.detections_within_3km, 10) || 0,
  detections_within_5km: parseInt(row.detections_within_5km, 10) || 0,
  pct_within_1km: parseFloat(row.pct_within_1km) || 0,
  pct_within_3km: parseFloat(row.pct_within_3km) || 0,
  pct_within_5km: parseFloat(row.pct_within_5km) || 0,
  source_class: row.source_class || 'unknown',
  review_category: row.review_category || 'persistent_source_unresolved',
  classification_method: row.classification_method || 'rule_based_screening',
  random_forest_trained: row.random_forest_trained === 'True',
  facility_proximity_is_causation: false,
}));

// Format Monthly
export interface MonthlyRecord {
  neighbor_group_id: number;
  candidate_id: string;
  year_month: string;
  year: number;
  month: number;
  detection_count: number;
  distinct_observation_days: number;
  mean_frp: number;
  median_frp: number;
  max_frp: number;
}

const monthlyData: MonthlyRecord[] = monthlyRaw.map((row) => {
  const gid = parseInt(row.neighbor_group_id, 10);
  const ym = row.year_month;
  const [yStr, mStr] = ym.split('-');
  return {
    neighbor_group_id: gid,
    candidate_id: `CAND_${String(gid).padStart(3, '0')}`,
    year_month: ym,
    year: parseInt(yStr, 10),
    month: parseInt(mStr, 10),
    detection_count: parseInt(row.detection_count, 10) || 0,
    distinct_observation_days: parseInt(row.distinct_observation_days, 10) || 0,
    mean_frp: parseFloat(row.mean_frp) || 0,
    median_frp: parseFloat(row.median_frp) || 0,
    max_frp: parseFloat(row.max_frp) || 0,
  };
});

// Format Annual
export interface AnnualRecord {
  neighbor_group_id: number;
  candidate_id: string;
  year: number;
  detection_count: number;
  distinct_observation_days: number;
  active_months: number;
  mean_frp: number;
  median_frp: number;
  max_frp: number;
}

const annualData: AnnualRecord[] = annualRaw.map((row) => {
  const gid = parseInt(row.neighbor_group_id, 10);
  return {
    neighbor_group_id: gid,
    candidate_id: `CAND_${String(gid).padStart(3, '0')}`,
    year: parseInt(row.year, 10),
    detection_count: parseInt(row.detection_count, 10) || 0,
    distinct_observation_days: parseInt(row.distinct_observation_days, 10) || 0,
    active_months: parseInt(row.active_months, 10) || 0,
    mean_frp: parseFloat(row.mean_frp) || 0,
    median_frp: parseFloat(row.median_frp) || 0,
    max_frp: parseFloat(row.max_frp) || 0,
  };
});

// Format Facility Inventory
export interface InventoryFacility {
  id: string;
  name: string;
  type: string;
  subtype: string;
  operator: string;
  state: string;
  district: string;
  lat: number;
  lng: number;
  capacity_mw: string;
  primary_fuel: string;
  commissioning_year: string;
  verification_status: string;
}

const inventoryFacilities: InventoryFacility[] = facilityInventoryRaw.map((row) => ({
  id: row.canonical_facility_id,
  name: row.facility_name,
  type: row.facility_type,
  subtype: row.facility_subtype,
  operator: row.operator,
  state: row.state,
  district: row.district,
  lat: parseFloat(row.latitude) || 0,
  lng: parseFloat(row.longitude) || 0,
  capacity_mw: row.capacity_mw,
  primary_fuel: row.primary_fuel,
  commissioning_year: row.commissioning_year,
  verification_status: row.verification_status,
}));

// Precompute overall monthly timeline (2019-01 through 2026-09)
const monthlyAggregateMap = new Map<
  string,
  {
    year_month: string;
    detection_count: number;
    distinct_observation_days: number;
    sum_frp: number;
    max_frp: number;
    active_candidates: Set<number>;
  }
>();

monthlyData.forEach((m) => {
  let entry = monthlyAggregateMap.get(m.year_month);
  if (!entry) {
    entry = {
      year_month: m.year_month,
      detection_count: 0,
      distinct_observation_days: 0,
      sum_frp: 0,
      max_frp: 0,
      active_candidates: new Set(),
    };
    monthlyAggregateMap.set(m.year_month, entry);
  }
  entry.detection_count += m.detection_count;
  entry.distinct_observation_days = Math.max(entry.distinct_observation_days, m.distinct_observation_days);
  entry.sum_frp += m.mean_frp * m.detection_count;
  entry.max_frp = Math.max(entry.max_frp, m.max_frp);
  entry.active_candidates.add(m.neighbor_group_id);
});

const monthlyAggregateTimeline = Array.from(monthlyAggregateMap.values())
  .sort((a, b) => a.year_month.localeCompare(b.year_month))
  .map((e) => ({
    year_month: e.year_month,
    detection_count: e.detection_count,
    distinct_observation_days: e.distinct_observation_days,
    mean_frp: Number((e.sum_frp / Math.max(1, e.detection_count)).toFixed(2)),
    max_frp: Number(e.max_frp.toFixed(2)),
    active_candidates: e.active_candidates.size,
  }));

// Precompute overall annual timeline (2019 through 2026)
const annualAggregateMap = new Map<
  number,
  {
    year: number;
    detection_count: number;
    distinct_observation_days: number;
    sum_frp: number;
    max_frp: number;
    active_candidates: Set<number>;
  }
>();

annualData.forEach((a) => {
  let entry = annualAggregateMap.get(a.year);
  if (!entry) {
    entry = {
      year: a.year,
      detection_count: 0,
      distinct_observation_days: 0,
      sum_frp: 0,
      max_frp: 0,
      active_candidates: new Set(),
    };
    annualAggregateMap.set(a.year, entry);
  }
  entry.detection_count += a.detection_count;
  entry.distinct_observation_days = Math.max(entry.distinct_observation_days, a.distinct_observation_days);
  entry.sum_frp += a.mean_frp * a.detection_count;
  entry.max_frp = Math.max(entry.max_frp, a.max_frp);
  entry.active_candidates.add(a.neighbor_group_id);
});

const annualAggregateTimeline = Array.from(annualAggregateMap.values())
  .sort((a, b) => a.year - b.year)
  .map((e) => ({
    year: e.year,
    detection_count: e.detection_count,
    distinct_observation_days: e.distinct_observation_days,
    mean_frp: Number((e.sum_frp / Math.max(1, e.detection_count)).toFixed(2)),
    max_frp: Number(e.max_frp.toFixed(2)),
    active_candidates: e.active_candidates.size,
    is_partial_year: e.year === 2026,
  }));

// --- ROUTER ENDPOINTS ---

// 1. GET /api/historical/summary
historicalRouter.get('/summary', (_req, res) => {
  const topCandidates = [...candidates]
    .sort((a, b) => b.total_detections - a.total_detections)
    .slice(0, 8)
    .map((c) => ({
      candidate_id: c.candidate_id,
      neighbor_group_id: c.neighbor_group_id,
      total_detections: c.total_detections,
      cell_count: c.cell_count,
      max_distinct_days: c.max_distinct_days,
      nearest_facility_name: c.nearest_facility_name,
      nearest_distance_km: c.nearest_distance_km,
      nearest_facility_type: c.nearest_facility_type,
    }));

  res.json({
    total_detections: metadataRaw.persistent_cell_detections || 167237,
    candidate_groups: metadataRaw.candidate_groups || 51,
    facility_inventory_records: metadataRaw.facility_inventory_records || 935,
    temporal_scope: metadataRaw.temporal_scope || { start: '2019-01-01', end: '2026-09-04' },
    source_class_policy: metadataRaw.source_class_policy,
    distance_interpretation: metadataRaw.distance_interpretation,
    random_forest_trained: metadataRaw.random_forest_trained,
    verified_source_labels_assigned: metadataRaw.verified_source_labels_assigned,
    top_candidates: topCandidates,
    annual_overview: annualAggregateTimeline,
    known_limitations: metadataRaw.known_limitations,
  });
});

// 2. GET /api/historical/monthly
historicalRouter.get('/monthly', (req, res) => {
  const candidate = (req.query.candidate as string) || (req.query.candidate_id as string);
  const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

  if (candidate) {
    const candNorm = candidate.toUpperCase().trim();
    const gid = candNorm.startsWith('CAND_')
      ? parseInt(candNorm.replace('CAND_', ''), 10)
      : parseInt(candNorm, 10);

    let rows = monthlyData.filter((m) => m.neighbor_group_id === gid || m.candidate_id === candNorm);
    if (year) {
      rows = rows.filter((m) => m.year === year);
    }
    rows.sort((a, b) => a.year_month.localeCompare(b.year_month));

    return res.json({
      candidate_id: `CAND_${String(gid).padStart(3, '0')}`,
      neighbor_group_id: gid,
      count: rows.length,
      timeline: rows,
    });
  }

  // Otherwise return overall aggregate timeline
  let timeline = monthlyAggregateTimeline;
  if (year) {
    timeline = timeline.filter((t) => t.year_month.startsWith(String(year)));
  }

  res.json({
    temporal_scope: { start: '2019-01-01', end: '2026-09-04' },
    months_count: timeline.length,
    timeline,
  });
});

// 3. GET /api/historical/annual
historicalRouter.get('/annual', (req, res) => {
  const candidate = (req.query.candidate as string) || (req.query.candidate_id as string);

  if (candidate) {
    const candNorm = candidate.toUpperCase().trim();
    const gid = candNorm.startsWith('CAND_')
      ? parseInt(candNorm.replace('CAND_', ''), 10)
      : parseInt(candNorm, 10);

    const rows = annualData
      .filter((a) => a.neighbor_group_id === gid || a.candidate_id === candNorm)
      .sort((a, b) => a.year - b.year);

    return res.json({
      candidate_id: `CAND_${String(gid).padStart(3, '0')}`,
      neighbor_group_id: gid,
      timeline: rows,
    });
  }

  res.json({
    temporal_scope: { start: '2019', end: '2026' },
    timeline: annualAggregateTimeline,
  });
});

// 4. GET /api/historical/candidates
historicalRouter.get('/candidates', (req, res) => {
  const search = (req.query.search as string)?.toLowerCase();
  const state = req.query.state as string;
  const proximity = req.query.proximity as string;
  const sortBy = (req.query.sortBy as string) || 'detections';
  const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

  let filtered = [...candidates];

  if (search) {
    filtered = filtered.filter(
      (c) =>
        c.candidate_id.toLowerCase().includes(search) ||
        c.nearest_facility_name.toLowerCase().includes(search) ||
        c.nearest_facility_type.toLowerCase().includes(search) ||
        c.nearest_state.toLowerCase().includes(search) ||
        c.nearest_district.toLowerCase().includes(search)
    );
  }

  if (state && state !== 'ALL') {
    filtered = filtered.filter((c) => c.nearest_state.toLowerCase().includes(state.toLowerCase()));
  }

  if (proximity) {
    if (proximity === 'within_1km') filtered = filtered.filter((c) => c.nearest_distance_km <= 1.0);
    else if (proximity === '1_3km')
      filtered = filtered.filter((c) => c.nearest_distance_km > 1.0 && c.nearest_distance_km <= 3.0);
    else if (proximity === '3_5km')
      filtered = filtered.filter((c) => c.nearest_distance_km > 3.0 && c.nearest_distance_km <= 5.0);
    else if (proximity === 'beyond_5km') filtered = filtered.filter((c) => c.nearest_distance_km > 5.0);
  }

  filtered.sort((a, b) => {
    let diff = 0;
    if (sortBy === 'detections') diff = a.total_detections - b.total_detections;
    else if (sortBy === 'distance') diff = a.nearest_distance_km - b.nearest_distance_km;
    else if (sortBy === 'days') diff = a.max_distinct_days - b.max_distinct_days;
    else if (sortBy === 'cells') diff = a.cell_count - b.cell_count;
    else if (sortBy === 'id') diff = a.neighbor_group_id - b.neighbor_group_id;
    return diff * sortDir;
  });

  res.json({
    total: filtered.length,
    candidates: filtered,
  });
});

// 5. GET /api/historical/candidates/:id
historicalRouter.get('/candidates/:id', (req, res) => {
  const param = req.params.id.toUpperCase().trim();
  const gid = param.startsWith('CAND_') ? parseInt(param.replace('CAND_', ''), 10) : parseInt(param, 10);

  const candidate = candidates.find((c) => c.neighbor_group_id === gid || c.candidate_id === param);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const monthlyHistory = monthlyData
    .filter((m) => m.neighbor_group_id === gid)
    .sort((a, b) => a.year_month.localeCompare(b.year_month));

  const annualHistory = annualData
    .filter((a) => a.neighbor_group_id === gid)
    .sort((a, b) => a.year - b.year);

  const nearestFacility = inventoryFacilities.find((f) => f.id === candidate.nearest_facility_id);

  const association = associationsRaw.find((a) => parseInt(a.neighbor_group_id, 10) === gid);

  res.json({
    candidate,
    monthly_activity: monthlyHistory,
    annual_activity: annualHistory,
    nearest_facility: nearestFacility || {
      id: candidate.nearest_facility_id,
      name: candidate.nearest_facility_name,
      type: candidate.nearest_facility_type,
      operator: candidate.nearest_operator,
      state: candidate.nearest_state,
      district: candidate.nearest_district,
    },
    association_record: association || null,
    causation_disclaimer:
      'Nearest inventoried facility is a spatial proximity relationship; proximity does not prove or establish causation.',
  });
});

// 6. GET /api/historical/detections (fast query via detections.db)
historicalRouter.get('/detections', (req, res) => {
  if (!detectionsDb) {
    return res.status(503).json({ error: 'Detections SQLite database not available' });
  }

  const candidate = req.query.candidate as string;
  const year = req.query.year as string;
  const month = req.query.month as string;
  const daynight = req.query.daynight as string;
  const satellite = req.query.satellite as string;
  const minFrp = req.query.min_frp ? parseFloat(req.query.min_frp as string) : undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 500, 3000);

  const conditions: string[] = [];
  const params: any[] = [];

  if (candidate && candidate !== 'ALL') {
    const candNorm = candidate.toUpperCase().trim();
    const gid = candNorm.startsWith('CAND_')
      ? parseInt(candNorm.replace('CAND_', ''), 10)
      : parseInt(candNorm, 10);
    conditions.push('neighbor_group_id = ?');
    params.push(gid);
  }

  if (year && year !== 'ALL') {
    conditions.push("substr(acq_date, 1, 4) = ?");
    params.push(year);
  }

  if (month && month !== 'ALL') {
    // e.g. 2024-05
    conditions.push("substr(acq_date, 1, 7) = ?");
    params.push(month);
  }

  if (daynight && daynight !== 'ALL') {
    conditions.push('daynight = ?');
    params.push(daynight.toUpperCase());
  }

  if (satellite && satellite !== 'ALL') {
    conditions.push('satellite_clean LIKE ?');
    params.push(`%${satellite}%`);
  }

  if (minFrp !== undefined && !isNaN(minFrp)) {
    conditions.push('frp >= ?');
    params.push(minFrp);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT 
      latitude as lat, 
      longitude as lng, 
      acq_date, 
      frp, 
      satellite_clean as satellite, 
      confidence, 
      daynight, 
      neighbor_group_id, 
      nearest_facility_name, 
      nearest_distance_km
    FROM detections
    ${whereClause}
    ORDER BY acq_date DESC
    LIMIT ?
  `;
  params.push(limit);

  try {
    const stmt = detectionsDb.prepare(query);
    const rows = stmt.all(...params);
    res.json({
      count: rows.length,
      limit,
      detections: rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET /api/facilities/inventory
historicalRouter.get('/facilities/inventory', (req, res) => {
  const search = (req.query.search as string)?.toLowerCase();
  const state = req.query.state as string;
  const type = req.query.type as string;
  const all = req.query.all === 'true';

  let filtered = [...inventoryFacilities];

  if (search) {
    filtered = filtered.filter(
      (f) =>
        f.name.toLowerCase().includes(search) ||
        f.state.toLowerCase().includes(search) ||
        f.type.toLowerCase().includes(search) ||
        f.district.toLowerCase().includes(search)
    );
  }

  if (state && state !== 'ALL') {
    filtered = filtered.filter((f) => f.state.toLowerCase().includes(state.toLowerCase()));
  }

  if (type && type !== 'ALL') {
    filtered = filtered.filter((f) => f.type.toLowerCase().includes(type.toLowerCase()));
  }

  if (all) {
    // Lightweight payload for map layer
    return res.json(
      filtered.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        state: f.state,
        lat: f.lat,
        lng: f.lng,
      }))
    );
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    items,
  });
});

// 8. GET /api/facilities/associations
historicalRouter.get('/facilities/associations', (_req, res) => {
  res.json({
    total: associationsRaw.length,
    associations: associationsRaw,
  });
});

// 9. GET /api/metadata
historicalRouter.get('/metadata', (_req, res) => {
  res.json({
    processing_metadata: metadataRaw,
    data_quality_report: dataQualityRaw,
  });
});
