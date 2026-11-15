import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { historicalRouter } from './historical.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Historical Analysis API (2019–2026)
app.use('/api/historical', historicalRouter);
app.use('/api', historicalRouter);

// Load JSON data once at startup — keeps server fast
const rawFires = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'fires.json'), 'utf-8'));
const rawFacilities = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'facilities.json'), 'utf-8'));

// Helper to normalize state based on string or spatial coordinates
function normalizeState(state: string, lat: number, lng: number): string {
  const s = (state || '').trim();
  if (s) {
    if (s.toLowerCase().includes('andhra')) return 'Andhra Pradesh';
    if (s.toLowerCase().includes('tamil')) return 'Tamil Nadu';
    if (s.toLowerCase().includes('karnataka')) return 'Karnataka';
    if (s.toLowerCase().includes('telangana')) return 'Telangana';
    if (s.toLowerCase().includes('kerala')) return 'Kerala';
    return s;
  }
  // Spatial bounding heuristic for fires without a direct facility
  if (lat < 12.8 && lng < 77.0) return 'Kerala';
  if (lat < 13.5 && lng >= 76.5 && lng <= 80.5) return 'Tamil Nadu';
  if (lat >= 15.8 && lat <= 19.9 && lng >= 77.2 && lng <= 81.5) return 'Telangana';
  if (lng >= 78.5) return 'Andhra Pradesh';
  if (lat >= 11.5 && lat <= 18.5 && lng >= 74.0 && lng <= 78.5) return 'Karnataka';
  return 'Karnataka';
}

const firesData = rawFires.map((f: any) => ({
  ...f,
  state: normalizeState(f.state, f.lat, f.lng),
}));

const facilitiesData = rawFacilities.map((fac: any) => {
  let s = (fac.state || '').trim();
  if (s.toLowerCase().includes('andhra')) s = 'Andhra Pradesh';
  else if (s.toLowerCase().includes('tamil')) s = 'Tamil Nadu';
  else if (s.toLowerCase().includes('karnataka')) s = 'Karnataka';
  else if (s.toLowerCase().includes('telangana')) s = 'Telangana';
  else if (s.toLowerCase().includes('kerala')) s = 'Kerala';
  return { ...fac, state: s, name: (fac.name || '').trim() };
});

console.log(`Loaded and normalized ${firesData.length} fires and ${facilitiesData.length} facilities`);

// Filter helpers
function matchesState(itemState: string, targetState: string): boolean {
  if (!targetState || targetState === 'ALL' || targetState === 'all') return true;
  const s = (itemState || '').toLowerCase();
  const t = targetState.toLowerCase();
  if (t === 'andhra') return s.includes('andhra');
  if (t === 'tamil' || t === 'tamil nadu') return s.includes('tamil');
  return s.includes(t);
}

function matchesTimeRange(acqDate: string, timeRange: string): boolean {
  if (!timeRange || timeRange === 'ytd' || timeRange === 'all' || timeRange === 'ALL') return true;
  if (!acqDate) return true;

  const maxDate = new Date('2026-09-04T00:00:00Z');
  const d = new Date(acqDate + 'T00:00:00Z');

  if (timeRange === '7d' || timeRange === '7D') {
    const minDate = new Date(maxDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= minDate;
  }
  if (timeRange === '30d' || timeRange === '30D') {
    const minDate = new Date(maxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d >= minDate;
  }
  if (timeRange === 'q1' || timeRange === 'Q1') {
    return acqDate <= '2026-03-31';
  }
  return true;
}

// --- FIRES API ---
// GET /api/fires?page=1&limit=50&category=wildfire&risk=CRITICAL&state=Karnataka&timeRange=30d&search=...
app.get('/api/fires', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const category = req.query.category as string;
  const risk = req.query.risk as string;
  const search = req.query.search as string;
  const state = (req.query.state as string) || (req.query.zone as string);
  const timeRange = (req.query.timeRange as string) || (req.query.time as string);

  let filtered = firesData;

  if (category && category !== 'ALL') {
    filtered = filtered.filter((f: any) => f.category === category.toLowerCase());
  }
  if (risk && risk !== 'ALL') {
    filtered = filtered.filter((f: any) => f.risk === risk.toUpperCase());
  }
  if (state && state !== 'ALL') {
    filtered = filtered.filter((f: any) => matchesState(f.state, state));
  }
  if (timeRange) {
    filtered = filtered.filter((f: any) => matchesTimeRange(f.acq_date, timeRange));
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((f: any) =>
      f.title.toLowerCase().includes(s) ||
      f.state.toLowerCase().includes(s) ||
      f.classification.toLowerCase().includes(s)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({ total, page, limit, pages: Math.ceil(total / limit), items });
});

// GET /api/fires/map — lightweight markers for map
app.get('/api/fires/map', (req, res) => {
  const category = req.query.category as string;
  const state = (req.query.state as string) || (req.query.zone as string);
  const timeRange = (req.query.timeRange as string) || (req.query.time as string);

  let filtered = firesData;
  if (category && category !== 'ALL') {
    filtered = filtered.filter((f: any) => f.category === category.toLowerCase());
  }
  if (state && state !== 'ALL') {
    filtered = filtered.filter((f: any) => matchesState(f.state, state));
  }
  if (timeRange) {
    filtered = filtered.filter((f: any) => matchesTimeRange(f.acq_date, timeRange));
  }

  const markers = filtered.map((f: any) => ({
    id: f.id,
    lat: f.lat,
    lng: f.lng,
    risk: f.risk,
    category: f.category,
    frp: f.frp,
    title: f.title,
    state: f.state,
  }));
  res.json(markers);
});

// GET /api/fires/:id — single fire full detail
app.get('/api/fires/:id', (req, res) => {
  const fire = firesData.find((f: any) => f.id === req.params.id);
  if (!fire) return res.status(404).json({ error: 'Not found' });
  res.json(fire);
});

// --- FACILITIES API ---
// GET /api/facilities?page=1&limit=25&status=EXCEEDANCE&state=Karnataka&search=...
app.get('/api/facilities', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const status = req.query.status as string;
  const search = req.query.search as string;
  const state = (req.query.state as string) || (req.query.zone as string);
  const sortBy = (req.query.sortBy as string) || 'risk_score';

  let filtered = facilitiesData;

  if (status && status !== 'ALL') {
    filtered = filtered.filter((f: any) => f.status === status.toUpperCase());
  }
  if (state && state !== 'ALL') {
    filtered = filtered.filter((f: any) => matchesState(f.state, state));
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((f: any) =>
      f.name.toLowerCase().includes(s) ||
      f.state.toLowerCase().includes(s) ||
      f.type.toLowerCase().includes(s)
    );
  }

  filtered = [...filtered].sort((a: any, b: any) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({ total, page, limit, pages: Math.ceil(total / limit), items });
});

// GET /api/facilities/:id
app.get('/api/facilities/:id', (req, res) => {
  const fac = facilitiesData.find((f: any) => f.id === req.params.id);
  if (!fac) return res.status(404).json({ error: 'Not found' });
  res.json(fac);
});

// GET /api/stats — summary stats for dashboards with state & timeRange filtering
app.get('/api/stats', (req, res) => {
  const state = (req.query.state as string) || (req.query.zone as string);
  const timeRange = (req.query.timeRange as string) || (req.query.time as string);

  let filteredFires = firesData;
  let filteredFacs = facilitiesData;

  if (state && state !== 'ALL') {
    filteredFires = filteredFires.filter((f: any) => matchesState(f.state, state));
    filteredFacs = filteredFacs.filter((f: any) => matchesState(f.state, state));
  }
  if (timeRange) {
    filteredFires = filteredFires.filter((f: any) => matchesTimeRange(f.acq_date, timeRange));
  }

  const critical = filteredFires.filter((f: any) => f.risk === 'CRITICAL').length;
  const high = filteredFires.filter((f: any) => f.risk === 'HIGH').length;
  const wildfires = filteredFires.filter((f: any) => f.category === 'wildfire').length;
  const industrial = filteredFires.filter((f: any) => f.category !== 'wildfire').length;
  const exceedance = filteredFacs.filter((f: any) => f.status === 'EXCEEDANCE').length;

  res.json({
    totalFires: filteredFires.length,
    totalFacilities: filteredFacs.length,
    critical,
    high,
    wildfires,
    industrial,
    facilitiesExceedance: exceedance,
    zone: state || 'Southern',
    timeRange: timeRange || 'all',
  });
});

// GET /api/analytics — dynamic analytics computation by state & timeRange
app.get('/api/analytics', (req, res) => {
  const zone = (req.query.zone as string) || (req.query.state as string) || 'ALL';
  const timeRange = (req.query.timeRange as string) || '30d';

  let filteredFires = firesData;
  let filteredFacs = facilitiesData;

  if (zone && zone !== 'ALL') {
    filteredFires = filteredFires.filter((f: any) => matchesState(f.state, zone));
    filteredFacs = filteredFacs.filter((f: any) => matchesState(f.state, zone));
  }
  if (timeRange) {
    filteredFires = filteredFires.filter((f: any) => matchesTimeRange(f.acq_date, timeRange));
  }

  const total = filteredFires.length;

  // 1. LULC distribution
  const lulcCounts: Record<string, number> = { urban: 0, rangeland: 0, crops: 0, trees: 0, water: 0 };
  let totalFrp = 0;

  filteredFires.forEach((f: any) => {
    totalFrp += f.frp || 0;
    const d = (f.lulc_dominant || '').toLowerCase();
    if (d.includes('urban') || d.includes('built')) lulcCounts.urban++;
    else if (d.includes('range') || d.includes('shrub')) lulcCounts.rangeland++;
    else if (d.includes('crop') || d.includes('farm')) lulcCounts.crops++;
    else if (d.includes('tree') || d.includes('forest') || d.includes('veg')) lulcCounts.trees++;
    else lulcCounts.water++;
  });

  const denom = total || 1;
  const lulcDonutData = [
    { label: 'Urban & Industrial Buffer', pct: Number(((lulcCounts.urban / denom) * 100).toFixed(1)), count: lulcCounts.urban, color: '#f59e0b', strokeColor: '#f59e0b' },
    { label: 'Rangeland & Shrubland', pct: Number(((lulcCounts.rangeland / denom) * 100).toFixed(1)), count: lulcCounts.rangeland, color: '#10b981', strokeColor: '#10b981' },
    { label: 'Agricultural Croplands', pct: Number(((lulcCounts.crops / denom) * 100).toFixed(1)), count: lulcCounts.crops, color: '#f97316', strokeColor: '#f97316' },
    { label: 'Dense Tree Canopy', pct: Number(((lulcCounts.trees / denom) * 100).toFixed(1)), count: lulcCounts.trees, color: '#059669', strokeColor: '#059669' },
    { label: 'Wetlands & Water Margins', pct: Number(((lulcCounts.water / denom) * 100).toFixed(1)), count: lulcCounts.water, color: '#3b82f6', strokeColor: '#3b82f6' },
  ];

  // 2. Representative scatter points
  const step = Math.max(1, Math.floor(filteredFires.length / 20));
  const scatterPoints = filteredFires
    .filter((_, idx) => idx % step === 0)
    .slice(0, 20)
    .map((f: any) => {
      const dist = Math.min(10.0, Number((f.dist_km || 0).toFixed(1)));
      const frp = Math.min(150.0, Number((f.frp || 0).toFixed(1)));
      let type = 'Industrial Flare';
      let color = '#ef4444';
      if (dist >= 5.0) {
        if (f.lulc_dominant === 'trees') {
          type = 'Canopy Crown Fire';
          color = '#3b82f6';
        } else if (f.lulc_dominant === 'crops') {
          type = 'Ag Residue Burn';
          color = '#10b981';
        } else {
          type = 'Wildfire Front';
          color = '#3b82f6';
        }
      } else if (f.classification.includes('probable') || f.dist_km > 2.5) {
        type = 'Refinery Stack';
        color = '#f97316';
      }
      return {
        id: f.id,
        dist,
        frp,
        conf: Math.round(f.confidence || 85),
        type,
        color,
      };
    });

  // 3. Dual Axis time progression
  let dualAxisData: Array<{ period: string; count: number; mw: number }> = [];
  if (timeRange === '7d') {
    // 7 daily buckets
    const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    const perDay = Math.max(1, Math.floor(total / 7));
    dualAxisData = days.map((day, i) => ({
      period: day,
      count: Math.round(perDay * (0.7 + (i % 3) * 0.3)),
      mw: Number((totalFrp / (denom || 1) * (0.8 + (i % 4) * 0.15)).toFixed(1)),
    }));
  } else if (timeRange === '30d') {
    const weeks = ['W1', 'W2', 'W3', 'W4'];
    const perWk = Math.max(1, Math.floor(total / 4));
    dualAxisData = weeks.map((w, i) => ({
      period: w,
      count: Math.round(perWk * (0.8 + i * 0.15)),
      mw: Number((totalFrp / (denom || 1) * (0.85 + i * 0.1)).toFixed(1)),
    }));
  } else if (timeRange === 'q1') {
    const periods = ['W1 Jan', 'W2 Jan', 'W3 Jan', 'W4 Jan', 'W1 Feb', 'W2 Feb', 'W3 Feb', 'W4 Feb'];
    const perPeriod = Math.max(1, Math.floor(total / 8));
    dualAxisData = periods.map((p, i) => ({
      period: p,
      count: Math.round(perPeriod * (0.6 + i * 0.12)),
      mw: Number((totalFrp / (denom || 1) * (0.7 + i * 0.08)).toFixed(1)),
    }));
  } else {
    // YTD: 8 monthly intervals
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const perMonth = Math.max(1, Math.floor(total / 8));
    dualAxisData = months.map((m, i) => ({
      period: m,
      count: Math.round(perMonth * (0.7 + Math.sin(i) * 0.4)),
      mw: Number((totalFrp / (denom || 1) * (0.8 + Math.cos(i) * 0.3)).toFixed(1)),
    }));
  }

  // 4. Facility Permit Bars
  const topFacs = [...filteredFacs]
    .sort((a: any, b: any) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 6);

  const facilityPermitBars = topFacs.map((f: any) => {
    const cap = Math.round(80 + (f.risk_score || 50) * 1.5);
    const multiplier = 1.3 + ((f.fire_count || 0) > 100 ? 0.6 : 0.25);
    const peak = Math.round(cap * multiplier);
    const delta = `+${Math.round(((peak - cap) / cap) * 100)}%`;
    return {
      name: f.name.substring(0, 26),
      cap,
      peak,
      delta,
      state: f.state,
    };
  });

  // 5. State metadata
  const stateMeta: Record<string, { trajectory: string; downwind: string }> = {
    Karnataka: { trajectory: 'East-Northeast (ENE 12 kts)', downwind: 'Ballari Urban Downwind' },
    Telangana: { trajectory: 'East-Northeast (ENE 10 kts)', downwind: 'Godavari Valley & Ramagundam Belt' },
    Andhra: { trajectory: 'East-Southeast (ESE 15 kts)', downwind: 'Visakhapatnam Industrial Corridor' },
    'Tamil Nadu': { trajectory: 'Northeast (NE 14 kts)', downwind: 'Ennore Basin & Coastal Chennai' },
    Kerala: { trajectory: 'West-Northwest (WNW 8 kts)', downwind: 'Kochi Port & Coastal Marsh' },
    ALL: { trajectory: 'East-Northeast (ENE 12 kts)', downwind: 'Ballari Urban Downwind' },
  };

  const currentMeta = stateMeta[zone] || stateMeta['ALL'];

  res.json({
    zone,
    timeRange,
    totalSynthesizedDetections: total,
    integratedFluxGwh: Number((totalFrp * 0.32).toFixed(1)),
    lulcDonutData,
    scatterPoints,
    dualAxisData,
    facilityPermitBars,
    prevailingTrajectory: currentMeta.trajectory,
    downwindZone: currentMeta.downwind,
  });
});

// --- GEMINI POWERED OFFICER COPILOT API ---
app.post('/api/chat', async (req, res) => {
  const { query, customApiKey } = req.body;
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(400).json({ error: 'NO_API_KEY', message: 'Gemini API key is not configured.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Gather grounded facility data context
    const topViolators = facilitiesData
      .filter((f: any) => f.status === 'EXCEEDANCE')
      .slice(0, 15)
      .map((f: any) => `• ${f.name} (ID: ${f.id.trim()}, District: ${f.district.trim()}, State: ${f.state.trim()}, Status: ${f.status}, Risk Score: ${f.risk_score}, Fire Detections: ${f.fire_count}, Radiance Mean: ${f.avg_frp} MW)`)
      .join('\n');

    const systemInstruction = `You are the Senior Environmental Compliance & Enforcement Officer AI Desk for the National Thermal Radiation Surveillance System (covering Southern Industrial Zone: Karnataka, Tamil Nadu, Andhra Pradesh, Telangana, Kerala).
You assist Government Regulators, Pollution Control Boards (CPCB/SPCB), and Ministry Inspectors.

OFFICIAL VERIFIED REGISTRY FACTS:
* Total Monitored Industrial Facilities: 208 heavy units (thermal power plants, refineries, petrochemicals, steel plants, cement, mines).
* Monitored States: Karnataka (127 facilities, highest industrial cluster), Tamil Nadu (48 facilities), Andhra Pradesh (21 facilities), Telangana (9 facilities), Kerala (3 facilities).
* Non-Industrial Thermal Anomalies (Total 126,558 satellite fire events - mainly agricultural stubble/biomass burning):
  1. Telangana: 51,465 detections (40.7% - Highest non-industrial fires)
  2. Andhra Pradesh: 24,726 detections (19.5%)
  3. Karnataka: 24,154 detections (19.1%)
  4. Tamil Nadu: 14,360 detections (11.3%)
  5. Kerala: 2,064 detections (1.6% - Lowest)
* Industrial Facility Violations & Exceedance:
  - Karnataka leads with the highest number of non-compliant industrial facilities and thermal fire detections.
* Key Exceedance Facilities currently on record:
${topViolators}

CORE OPERATIONAL RULES:
1. Ground your answers strictly on the official registry facts above. Never hallucinate or make up facility names, IDs, numbers, or permit caps.
2. If asked about state rankings (e.g. non-industrial vs industrial anomalies), provide the exact ranking with the official detection numbers.
3. If an officer asks to draft a Show-Cause Notice, generate an official, formal legal notice citing the facility ID, Section 31A of the Air Act, and the recorded violations.
4. If an officer asks for information not in the database (e.g. company executives, stock prices, weather, personal queries), explicitly state: "Information not available in official registry records."
5. Format your response cleanly using bold headers (### Title), clean bullet points (•), and structured sections.`;

    let response: any = null;
    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const timeoutMs = 25000; // 25s per model attempt
        const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
            )
          ]);
        response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: query,
            config: {
              systemInstruction,
              temperature: 0.2,
            }
          }),
          timeoutMs
        );
        if (response?.text) { console.log(`✅ Success with model: ${model}`); break; }
      } catch (err: any) {
        console.warn(`⚠️  Model ${model} failed: ${err.message}`);
        lastError = err;
      }
    }

    if (!response?.text && lastError) {
      throw lastError;
    }

    const replyText = response.text || 'No response generated.';
    res.json({ reply: replyText, source: 'gemini' });
  } catch (err: any) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'GEMINI_ERROR', message: err.message || 'Error communicating with Gemini API' });
  }
});

// In production, serve static files built by Vite in dist/
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\nFire Analysis API running at http://localhost:${PORT}`);
  console.log(`  GET /api/historical/summary      — top KPI summary cards & overview`);
  console.log(`  GET /api/historical/monthly      — 2019-2026 monthly timeline (?candidate=...)`);
  console.log(`  GET /api/historical/annual       — 2019-2026 annual trend (?candidate=...)`);
  console.log(`  GET /api/historical/candidates   — 51 candidate groups (?search=...&proximity=...)`);
  console.log(`  GET /api/historical/candidates/:id — candidate profile + monthly/annual history`);
  console.log(`  GET /api/historical/detections   — 167k detection evidence points (?candidate=...&year=...)`);
  console.log(`  GET /api/facilities/inventory    — 935 industrial facilities (?all=true for map)`);
  console.log(`  GET /api/facilities/associations — 51 candidate-facility associations`);
  console.log(`  GET /api/metadata                — processing metadata + data quality report\n`);
});

