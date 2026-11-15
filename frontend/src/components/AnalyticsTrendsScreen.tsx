import React, { useState, useEffect, useMemo } from 'react';
import { 
  Cpu, 
  Satellite, 
  Download, 
  Activity, 
  Layers, 
  ChevronRight,
  ShieldAlert,
  Clock,
  Flame,
  Sun,
  TrendingUp,
  BarChart3,
  PieChart,
  Filter,
  Sparkles,
  AlertTriangle,
  Building2,
  TreePine,
  Compass,
  Wind,
  Maximize2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

type AnalyticsViewMode = 'ALL_GRAPHS' | 'TEMPORAL' | 'SPATIAL_LULC' | 'EXCEEDANCE' | 'AI_METRICS';

interface AnalyticsTrendsScreenProps {
  onOpenReviewQueue: () => void;
  onInspectEpisode?: (id: string) => void;
}

// Pre-synthesized spatial profiles based on full NASA FIRMS & OSM registry
const ZONE_PROFILES: Record<string, {
  name: string;
  baseCounts: Record<string, number>;
  baseFlux: Record<string, number>;
  lulcPct: Record<string, { urban: number; rangeland: number; crops: number; trees: number; water: number }>;
  facilities: Array<{ name: string; cap: number; peak: number; delta: string; state: string }>;
  trajectory: string;
  downwind: string;
  radar: Array<{ dir: string; r: number; x: number; y: number }>;
  scatterSeed: Array<{ id: string; dist: number; frp: number; conf: number; type: string; color: string }>;
}> = {
  ALL: {
    name: 'Southern Zone (All States)',
    baseCounts: { '7d': 60, '30d': 187, 'q1': 3035, 'ytd': 5646 },
    baseFlux: { '7d': 19.8, '30d': 61.2, 'q1': 971.2, 'ytd': 1842.6 },
    lulcPct: {
      '7d':  { urban: 81.7, rangeland: 3.3, crops: 13.3, trees: 1.7, water: 0.0 },
      '30d': { urban: 80.7, rangeland: 7.0, crops: 10.2, trees: 2.1, water: 0.0 },
      'q1':  { urban: 41.6, rangeland: 32.6, crops: 14.9, trees: 10.6, water: 0.3 },
      'ytd': { urban: 38.8, rangeland: 26.9, crops: 18.9, trees: 15.1, water: 0.3 },
    },
    facilities: [
      { name: 'JSW Vijayanagar', cap: 150, peak: 340, delta: '+126%', state: 'Karnataka' },
      { name: 'Wadi Cement Plant', cap: 80, peak: 185, delta: '+131%', state: 'Karnataka' },
      { name: 'Tatipaka Refinery', cap: 120, peak: 260, delta: '+116%', state: 'Andhra' },
      { name: 'Tuticorin STPS', cap: 180, peak: 290, delta: '+61%', state: 'Tamil Nadu' },
      { name: 'Bellary Thermal', cap: 200, peak: 310, delta: '+55%', state: 'Karnataka' },
      { name: 'Ramagundam OCP-III', cap: 160, peak: 350, delta: '+118%', state: 'Telangana' },
    ],
    trajectory: 'East-Northeast (ENE 12 kts)',
    downwind: 'Ballari Urban Downwind',
    radar: [
      { dir: 'N', r: 45, x: 150, y: 55 },
      { dir: 'NE', r: 85, x: 210, y: 70 },
      { dir: 'E', r: 70, x: 220, y: 130 },
      { dir: 'SE', r: 50, x: 185, y: 175 },
      { dir: 'S', r: 35, x: 150, y: 165 },
      { dir: 'SW', r: 40, x: 115, y: 170 },
      { dir: 'W', r: 55, x: 80, y: 130 },
      { dir: 'NW', r: 60, x: 95, y: 75 },
    ],
    scatterSeed: [
      { id: 'EP-01', dist: 0.8, frp: 114.2, conf: 96, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'EP-02', dist: 1.4, frp: 88.5, conf: 94, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'EP-03', dist: 2.1, frp: 95.0, conf: 92, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'EP-04', dist: 2.8, frp: 62.4, conf: 89, type: 'Refinery Stack', color: '#f97316' },
      { id: 'EP-05', dist: 3.5, frp: 48.0, conf: 85, type: 'Refinery Stack', color: '#f97316' },
      { id: 'EP-06', dist: 4.2, frp: 54.2, conf: 88, type: 'Buffer Flaring', color: '#f97316' },
      { id: 'EP-07', dist: 5.4, frp: 72.0, conf: 91, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'EP-08', dist: 6.2, frp: 86.4, conf: 95, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'EP-09', dist: 7.1, frp: 128.0, conf: 98, type: 'Canopy Crown Fire', color: '#3b82f6' },
      { id: 'EP-10', dist: 8.5, frp: 45.6, conf: 82, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'EP-11', dist: 0.5, frp: 142.0, conf: 99, type: 'Super Flare Stack', color: '#ef4444' },
      { id: 'EP-12', dist: 1.1, frp: 135.0, conf: 99, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'EP-13', dist: 3.1, frp: 28.5, conf: 74, type: 'Coal Smolder', color: '#8b5cf6' },
      { id: 'EP-14', dist: 8.9, frp: 64.2, conf: 87, type: 'Ag Residue Burn', color: '#10b981' },
    ],
  },
  Karnataka: {
    name: 'Karnataka Zone',
    baseCounts: { '7d': 48, '30d': 150, 'q1': 1814, 'ytd': 2879 },
    baseFlux: { '7d': 15.4, '30d': 48.0, 'q1': 580.5, 'ytd': 921.3 },
    lulcPct: {
      '7d':  { urban: 93.8, rangeland: 2.1, crops: 4.1, trees: 0.0, water: 0.0 },
      '30d': { urban: 94.0, rangeland: 1.3, crops: 4.7, trees: 0.0, water: 0.0 },
      'q1':  { urban: 63.1, rangeland: 16.0, crops: 18.1, trees: 2.5, water: 0.3 },
      'ytd': { urban: 68.5, rangeland: 12.3, crops: 17.1, trees: 1.8, water: 0.3 },
    },
    facilities: [
      { name: 'JSW Vijayanagar', cap: 150, peak: 340, delta: '+126%', state: 'Karnataka' },
      { name: 'Danapur BMM Plant', cap: 90, peak: 165, delta: '+83%', state: 'Karnataka' },
      { name: 'Bellary Janki Thermal', cap: 200, peak: 310, delta: '+55%', state: 'Karnataka' },
      { name: 'Rajashree Cement', cap: 85, peak: 170, delta: '+100%', state: 'Karnataka' },
      { name: 'Wadi Cement Plant', cap: 80, peak: 185, delta: '+131%', state: 'Karnataka' },
      { name: 'Raichur Thermal Power', cap: 210, peak: 295, delta: '+40%', state: 'Karnataka' },
    ],
    trajectory: 'East-Northeast (ENE 12 kts)',
    downwind: 'Ballari Steel Urban Fringe',
    radar: [
      { dir: 'N', r: 35, x: 150, y: 70 },
      { dir: 'NE', r: 90, x: 215, y: 65 },
      { dir: 'E', r: 75, x: 225, y: 125 },
      { dir: 'SE', r: 40, x: 180, y: 170 },
      { dir: 'S', r: 25, x: 150, y: 155 },
      { dir: 'SW', r: 30, x: 125, y: 160 },
      { dir: 'W', r: 50, x: 90, y: 130 },
      { dir: 'NW', r: 55, x: 100, y: 80 },
    ],
    scatterSeed: [
      { id: 'KA-01', dist: 0.6, frp: 128.4, conf: 98, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'KA-02', dist: 1.2, frp: 98.2, conf: 95, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'KA-03', dist: 1.9, frp: 112.0, conf: 96, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'KA-04', dist: 2.7, frp: 68.4, conf: 88, type: 'Refinery Stack', color: '#f97316' },
      { id: 'KA-05', dist: 3.4, frp: 52.0, conf: 84, type: 'Buffer Flaring', color: '#f97316' },
      { id: 'KA-06', dist: 4.5, frp: 42.1, conf: 81, type: 'Buffer Flaring', color: '#f97316' },
      { id: 'KA-07', dist: 6.0, frp: 58.2, conf: 89, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'KA-08', dist: 7.5, frp: 44.0, conf: 83, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'KA-09', dist: 8.8, frp: 38.5, conf: 79, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'KA-10', dist: 0.3, frp: 148.0, conf: 99, type: 'Super Flare Stack', color: '#ef4444' },
    ],
  },
  Telangana: {
    name: 'Telangana Zone',
    baseCounts: { '7d': 3, '30d': 12, 'q1': 622, 'ytd': 1439 },
    baseFlux: { '7d': 1.1, '30d': 4.2, 'q1': 199.0, 'ytd': 460.5 },
    lulcPct: {
      '7d':  { urban: 0.0, rangeland: 85.0, crops: 15.0, trees: 0.0, water: 0.0 },
      '30d': { urban: 0.0, rangeland: 83.3, crops: 16.7, trees: 0.0, water: 0.0 },
      'q1':  { urban: 1.6, rangeland: 70.9, crops: 10.6, trees: 16.9, water: 0.0 },
      'ytd': { urban: 1.1, rangeland: 48.8, crops: 22.4, trees: 27.4, water: 0.3 },
    },
    facilities: [
      { name: 'Kakatiya TPP', cap: 140, peak: 285, delta: '+103%', state: 'Telangana' },
      { name: 'Ramagundam OCP-III', cap: 160, peak: 350, delta: '+118%', state: 'Telangana' },
      { name: 'Ramagundam OCP-II', cap: 130, peak: 245, delta: '+88%', state: 'Telangana' },
      { name: 'Suryapet HPCL Terminal', cap: 90, peak: 160, delta: '+77%', state: 'Telangana' },
      { name: 'Kothagudem Thermal', cap: 180, peak: 290, delta: '+61%', state: 'Telangana' },
      { name: 'Ramagundam Depot', cap: 75, peak: 130, delta: '+73%', state: 'Telangana' },
    ],
    trajectory: 'East-Northeast (ENE 10 kts)',
    downwind: 'Godavari Valley & Ramagundam Belt',
    radar: [
      { dir: 'N', r: 30, x: 150, y: 75 },
      { dir: 'NE', r: 80, x: 205, y: 75 },
      { dir: 'E', r: 85, x: 230, y: 120 },
      { dir: 'SE', r: 60, x: 195, y: 165 },
      { dir: 'S', r: 30, x: 150, y: 160 },
      { dir: 'SW', r: 25, x: 130, y: 165 },
      { dir: 'W', r: 40, x: 100, y: 130 },
      { dir: 'NW', r: 45, x: 110, y: 85 },
    ],
    scatterSeed: [
      { id: 'TG-01', dist: 1.1, frp: 86.4, conf: 92, type: 'Coal Smolder', color: '#8b5cf6' },
      { id: 'TG-02', dist: 1.8, frp: 74.0, conf: 90, type: 'Coal Smolder', color: '#8b5cf6' },
      { id: 'TG-03', dist: 2.5, frp: 95.0, conf: 94, type: 'Refinery Stack', color: '#f97316' },
      { id: 'TG-04', dist: 5.8, frp: 94.2, conf: 93, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'TG-05', dist: 6.9, frp: 124.0, conf: 97, type: 'Canopy Crown Fire', color: '#3b82f6' },
      { id: 'TG-06', dist: 7.8, frp: 88.0, conf: 91, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'TG-07', dist: 8.6, frp: 52.4, conf: 85, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'TG-08', dist: 9.4, frp: 46.0, conf: 82, type: 'Ag Residue Burn', color: '#10b981' },
    ],
  },
  Andhra: {
    name: 'Andhra Pradesh Zone',
    baseCounts: { '7d': 5, '30d': 18, 'q1': 382, 'ytd': 852 },
    baseFlux: { '7d': 1.6, '30d': 5.8, 'q1': 122.2, 'ytd': 272.6 },
    lulcPct: {
      '7d':  { urban: 25.0, rangeland: 50.0, crops: 25.0, trees: 0.0, water: 0.0 },
      '30d': { urban: 22.2, rangeland: 44.4, crops: 22.2, trees: 11.2, water: 0.0 },
      'q1':  { urban: 13.4, rangeland: 46.9, crops: 6.0, trees: 33.5, water: 0.2 },
      'ytd': { urban: 8.2, rangeland: 40.0, crops: 17.6, trees: 34.0, water: 0.2 },
    },
    facilities: [
      { name: 'Tatipaka Refinery', cap: 120, peak: 260, delta: '+116%', state: 'Andhra' },
      { name: 'Vizag TPP', cap: 175, peak: 320, delta: '+82%', state: 'Andhra' },
      { name: 'Visakhapatnam Refinery', cap: 220, peak: 390, delta: '+77%', state: 'Andhra' },
      { name: 'Sitapuram Power', cap: 95, peak: 175, delta: '+84%', state: 'Andhra' },
      { name: 'Visakh White Oil Depot', cap: 85, peak: 150, delta: '+76%', state: 'Andhra' },
      { name: 'Rayalaseema Thermal', cap: 160, peak: 255, delta: '+59%', state: 'Andhra' },
    ],
    trajectory: 'East-Southeast (ESE 15 kts)',
    downwind: 'Visakhapatnam Industrial Corridor',
    radar: [
      { dir: 'N', r: 40, x: 150, y: 65 },
      { dir: 'NE', r: 65, x: 195, y: 80 },
      { dir: 'E', r: 85, x: 230, y: 120 },
      { dir: 'SE', r: 90, x: 225, y: 180 },
      { dir: 'S', r: 45, x: 150, y: 175 },
      { dir: 'SW', r: 35, x: 120, y: 165 },
      { dir: 'W', r: 40, x: 100, y: 130 },
      { dir: 'NW', r: 50, x: 105, y: 85 },
    ],
    scatterSeed: [
      { id: 'AP-01', dist: 0.7, frp: 132.0, conf: 97, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'AP-02', dist: 1.5, frp: 92.4, conf: 93, type: 'Refinery Stack', color: '#f97316' },
      { id: 'AP-03', dist: 2.3, frp: 81.0, conf: 90, type: 'Refinery Stack', color: '#f97316' },
      { id: 'AP-04', dist: 5.5, frp: 76.5, conf: 91, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'AP-05', dist: 6.8, frp: 118.0, conf: 96, type: 'Canopy Crown Fire', color: '#3b82f6' },
      { id: 'AP-06', dist: 7.9, frp: 85.0, conf: 92, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'AP-07', dist: 8.7, frp: 48.0, conf: 84, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'AP-08', dist: 9.3, frp: 39.5, conf: 80, type: 'Ag Residue Burn', color: '#10b981' },
    ],
  },
  'Tamil Nadu': {
    name: 'Tamil Nadu Zone',
    baseCounts: { '7d': 11, '30d': 25, 'q1': 188, 'ytd': 388 },
    baseFlux: { '7d': 3.5, '30d': 8.0, 'q1': 60.2, 'ytd': 124.2 },
    lulcPct: {
      '7d':  { urban: 36.4, rangeland: 0.0, crops: 54.5, trees: 9.1, water: 0.0 },
      '30d': { urban: 32.0, rangeland: 8.0, crops: 44.0, trees: 16.0, water: 0.0 },
      'q1':  { urban: 20.7, rangeland: 39.9, crops: 16.5, trees: 21.8, water: 1.1 },
      'ytd': { urban: 26.5, rangeland: 29.1, crops: 24.2, trees: 18.6, water: 1.6 },
    },
    facilities: [
      { name: 'Tuticorin STPS', cap: 180, peak: 290, delta: '+61%', state: 'Tamil Nadu' },
      { name: 'Manali Petrochemicals', cap: 110, peak: 225, delta: '+104%', state: 'Tamil Nadu' },
      { name: 'NTPL Tuticorin Thermal', cap: 150, peak: 240, delta: '+60%', state: 'Tamil Nadu' },
      { name: 'North Chennai Thermal', cap: 190, peak: 275, delta: '+44%', state: 'Tamil Nadu' },
      { name: 'Melamaruthur Plant', cap: 70, peak: 135, delta: '+92%', state: 'Tamil Nadu' },
      { name: 'Neyveli Lignite TPS', cap: 210, peak: 330, delta: '+57%', state: 'Tamil Nadu' },
    ],
    trajectory: 'Northeast (NE 14 kts)',
    downwind: 'Ennore Basin & Coastal Chennai',
    radar: [
      { dir: 'N', r: 50, x: 150, y: 50 },
      { dir: 'NE', r: 95, x: 225, y: 60 },
      { dir: 'E', r: 70, x: 220, y: 130 },
      { dir: 'SE', r: 40, x: 185, y: 175 },
      { dir: 'S', r: 25, x: 150, y: 160 },
      { dir: 'SW', r: 35, x: 120, y: 165 },
      { dir: 'W', r: 45, x: 95, y: 130 },
      { dir: 'NW', r: 50, x: 105, y: 80 },
    ],
    scatterSeed: [
      { id: 'TN-01', dist: 0.9, frp: 108.5, conf: 95, type: 'Industrial Flare', color: '#ef4444' },
      { id: 'TN-02', dist: 1.6, frp: 84.0, conf: 91, type: 'Refinery Stack', color: '#f97316' },
      { id: 'TN-03', dist: 2.8, frp: 62.0, conf: 87, type: 'Buffer Flaring', color: '#f97316' },
      { id: 'TN-04', dist: 5.2, frp: 68.0, conf: 90, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'TN-05', dist: 6.4, frp: 96.0, conf: 95, type: 'Canopy Crown Fire', color: '#3b82f6' },
      { id: 'TN-06', dist: 7.6, frp: 74.0, conf: 89, type: 'Wildfire Front', color: '#3b82f6' },
      { id: 'TN-07', dist: 8.4, frp: 52.0, conf: 86, type: 'Ag Residue Burn', color: '#10b981' },
      { id: 'TN-08', dist: 9.1, frp: 41.0, conf: 81, type: 'Ag Residue Burn', color: '#10b981' },
    ],
  },
};

export const AnalyticsTrendsScreen: React.FC<AnalyticsTrendsScreenProps> = ({
  onOpenReviewQueue,
}) => {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('ALL_GRAPHS');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'q1' | 'ytd'>('30d');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // Interactive Hover States
  const [hoveredDonutSlice, setHoveredDonutSlice] = useState<number | null>(0);
  const [hoveredScatterPoint, setHoveredScatterPoint] = useState<{ id: string; frp: number; dist: number; type: string } | null>(null);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{ day: string; time: string; count: number } | null>(null);

  // Active Zone Profile
  const profile = ZONE_PROFILES[selectedZone] || ZONE_PROFILES['ALL'];

  // Total count for current filter
  const totalCount = profile.baseCounts[timeRange] ?? 187;
  const integratedFlux = profile.baseFlux[timeRange] ?? 61.2;

  // LULC Donut distribution
  const lulcDonutData = useMemo(() => {
    const p = profile.lulcPct[timeRange] || profile.lulcPct['30d'];
    return [
      { label: 'Urban & Industrial Buffer', pct: p.urban, count: Math.round((p.urban / 100) * totalCount), color: '#f59e0b', strokeColor: '#f59e0b' },
      { label: 'Rangeland & Shrubland', pct: p.rangeland, count: Math.round((p.rangeland / 100) * totalCount), color: '#10b981', strokeColor: '#10b981' },
      { label: 'Agricultural Croplands', pct: p.crops, count: Math.round((p.crops / 100) * totalCount), color: '#f97316', strokeColor: '#f97316' },
      { label: 'Dense Tree Canopy', pct: p.trees, count: Math.round((p.trees / 100) * totalCount), color: '#059669', strokeColor: '#059669' },
      { label: 'Wetlands & Water Margins', pct: p.water, count: Math.round((p.water / 100) * totalCount), color: '#3b82f6', strokeColor: '#3b82f6' },
    ];
  }, [profile, timeRange, totalCount]);

  // Scatter points
  const scatterPoints = useMemo(() => {
    return profile.scatterSeed;
  }, [profile]);

  // Dual-Axis Timeline Data
  const dualAxisData = useMemo(() => {
    if (timeRange === '7d') {
      const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
      const perDay = Math.max(1, Math.floor(totalCount / 7));
      return days.map((d, i) => ({
        period: d,
        count: Math.round(perDay * (0.7 + (i % 3) * 0.28)),
        mw: Number((18 + (i % 4) * 6.5).toFixed(1)),
      }));
    } else if (timeRange === '30d') {
      const weeks = ['W1', 'W2', 'W3', 'W4'];
      const perWk = Math.max(1, Math.floor(totalCount / 4));
      return weeks.map((w, i) => ({
        period: w,
        count: Math.round(perWk * (0.8 + i * 0.14)),
        mw: Number((24 + i * 7.2).toFixed(1)),
      }));
    } else if (timeRange === 'q1') {
      const periods = ['W1 Jan', 'W2 Jan', 'W3 Jan', 'W4 Jan', 'W1 Feb', 'W2 Feb', 'W3 Feb', 'W4 Feb'];
      const perP = Math.max(1, Math.floor(totalCount / 8));
      return periods.map((p, i) => ({
        period: p,
        count: Math.round(perP * (0.65 + i * 0.11)),
        mw: Number((22 + i * 3.8).toFixed(1)),
      }));
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      const perM = Math.max(1, Math.floor(totalCount / 8));
      return months.map((m, i) => ({
        period: m,
        count: Math.round(perM * (0.7 + Math.sin(i * 0.8) * 0.35)),
        mw: Number((20 + Math.cos(i * 0.7) * 12 + 10).toFixed(1)),
      }));
    }
  }, [timeRange, totalCount]);

  // Heatmap Matrix
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeSlots = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];

  const heatmapMatrix: number[][] = useMemo(() => {
    // Proportional base scaled dynamically to current state's share of detections in the selected time horizon
    const maxHorizonCount = ZONE_PROFILES['ALL'].baseCounts[timeRange] || 5646;
    const scale = totalCount / maxHorizonCount;
    const base = [
      [45, 38, 120, 280, 180, 75],
      [52, 42, 140, 310, 195, 82],
      [48, 39, 155, 340, 210, 88],
      [55, 46, 148, 325, 205, 84],
      [62, 50, 162, 360, 230, 95],
      [70, 58, 185, 390, 245, 105],
      [65, 52, 175, 375, 220, 92],
    ];
    return base.map(row => row.map(v => Math.max(1, Math.round(v * scale))));
  }, [timeRange, totalCount]);

  // Facilities
  const facilityPermitBars = profile.facilities;

  // Radar points
  const radarPoints = profile.radar;

  // Max values for dynamic chart scaling
  const maxDualCount = Math.max(...dualAxisData.map(d => d.count), 1);
  const maxDualMw = Math.max(...dualAxisData.map(d => d.mw), 1);
  const maxHeatmapVal = Math.max(...heatmapMatrix.flat(), 1);

  // Dynamic SVG path for dual-axis spline
  const splinePath = useMemo(() => {
    const len = dualAxisData.length;
    return dualAxisData
      .map((d, idx) => {
        const cx = 50 + idx * ((470 - 50) / Math.max(1, len - 1));
        const cy = 170 - (d.mw / (maxDualMw * 1.2 || 1)) * 140;
        return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)},${cy.toFixed(1)}`;
      })
      .join(' ');
  }, [dualAxisData, maxDualMw]);

  const handleExportData = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      zone: selectedZone,
      timeRange,
      totalSynthesizedDetections: totalCount,
      integratedFluxGwh: integratedFlux,
      facilityExceedance: facilityPermitBars,
      scatterBufferAnalysis: scatterPoints,
      dualAxisTrends: dualAxisData,
      lulcMatrix: lulcDonutData,
      prevailingTrajectory: profile.trajectory,
      downwindZone: profile.downwind,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agni-drishti-${selectedZone.toLowerCase()}-${timeRange}-analytics.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1680px] mx-auto space-y-6">
      {/* Header & Global Horizon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-xs">
              ⚡ Advanced Visual Intelligence
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono font-semibold bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-xs">
              Multi-Chart Matrix v3.0
            </Badge>
            <Badge variant="outline" className="text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-xs">
              {totalCount.toLocaleString()} Detections Synthesized
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Geospatial Analytics &amp; Visual Intelligence
          </h1>
          <p className="text-xs text-muted-foreground max-w-3xl mt-1">
            Integrated multi-chart analytics for <strong className="text-foreground">{profile.name}</strong> over <strong className="text-orange-400">{timeRange.toUpperCase()}</strong> horizon: scatter radiance vs buffer proximity, polar wind dispersion, LULC donut fuel partition, dual-axis temporal volume, and diurnal heatmaps.
          </p>
        </div>

        {/* Global Controls & Mode Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Zone (States) Selector */}
          <div className="flex items-center bg-secondary/80 p-1 rounded-md border border-border text-xs shadow-xs">
            <span className="text-muted-foreground px-2 text-[11px] font-medium hidden sm:inline">Zone:</span>
            {['ALL', 'Karnataka', 'Telangana', 'Andhra', 'Tamil Nadu'].map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`px-2.5 py-1 rounded text-xs transition-colors font-medium ${
                  selectedZone === zone
                    ? 'bg-orange-500/15 text-orange-400 font-semibold shadow-xs border border-orange-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>

          {/* Time Horizon */}
          <div className="flex items-center bg-secondary/80 p-1 rounded-md border border-border text-xs shadow-xs">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: 'q1', label: 'Q1' },
              { id: 'ytd', label: 'YTD' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as any)}
                className={`px-3 py-1 rounded text-xs transition-colors font-medium ${
                  timeRange === tab.id
                    ? 'bg-orange-500/15 text-orange-400 font-semibold shadow-xs border border-orange-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analytics</span>
          </Button>
        </div>
      </div>

      {/* Filter / View Category Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/80">
        {[
          { id: 'ALL_GRAPHS' as const, label: 'All Graphs & Charts', icon: BarChart3, badge: '8 Chart Types' },
          { id: 'TEMPORAL' as const, label: 'Temporal & Diurnal Trends', icon: Clock, badge: 'Flux & Heatmap' },
          { id: 'SPATIAL_LULC' as const, label: 'Spatial & Fuel Matrix', icon: Compass, badge: 'Scatter & Radar' },
          { id: 'EXCEEDANCE' as const, label: 'Industrial Compliance', icon: Building2, badge: 'Grouped Bars' },
          { id: 'AI_METRICS' as const, label: 'Model ROC & Diagnostics', icon: Cpu, badge: '98.2% AUC' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* SECTION A: SPATIAL & SCATTER PLOT ANALYTICS                   */}
      {/* ============================================================== */}
      {(viewMode === 'ALL_GRAPHS' || viewMode === 'SPATIAL_LULC') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Scatter Plot (FRP vs Distance to Facility Cadastre) */}
          <Card className="lg:col-span-8 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />
                  Thermal Radiance (MW) vs. Facility Cadastre Proximity (km)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Spatial cluster discrimination for <strong>{selectedZone}</strong>. Dotted line demarcates the 5.0 km compliance buffer.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Industrial Flares (&lt;5km)
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Wildfires (&gt;5km)
                </span>
              </div>
            </div>

            {/* Scatter SVG */}
            <div className="relative h-64 w-full bg-secondary/15 rounded-md border border-border p-4 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
                {/* Horizontal grid lines */}
                <line x1="40" y1="30" x2="580" y2="30" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="80" x2="580" y2="80" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="130" x2="580" y2="130" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="180" x2="580" y2="180" stroke="var(--border)" strokeWidth="1" />

                {/* Vertical 5km Buffer Threshold Line */}
                <line x1="310" y1="10" x2="310" y2="190" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
                <text x="316" y="24" fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="600">
                  5.0 km Cadastre Buffer Threshold
                </text>

                {/* Y-Axis Labels */}
                <text x="5" y="34" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">150 MW</text>
                <text x="5" y="84" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">100 MW</text>
                <text x="5" y="134" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">50 MW</text>
                <text x="5" y="184" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">0 MW</text>

                {/* Scatter Points */}
                {scatterPoints.map((pt) => {
                  const cx = 40 + (pt.dist / 10) * 540;
                  const cy = 180 - (pt.frp / 150) * 160;
                  const r = (pt.conf / 100) * 5 + 2;
                  const isHovered = hoveredScatterPoint?.id === pt.id;

                  return (
                    <circle
                      key={pt.id}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? r + 3 : r}
                      fill={pt.color}
                      stroke="var(--card)"
                      strokeWidth={isHovered ? 2 : 1}
                      className="cursor-pointer transition-all hover:opacity-100 opacity-85"
                      onMouseEnter={() => setHoveredScatterPoint(pt)}
                      onMouseLeave={() => setHoveredScatterPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* X-Axis Labels */}
              <div className="flex justify-between pl-10 pr-2 pt-1 text-[9px] font-mono text-muted-foreground border-t border-border mt-1">
                <span>0 km (Direct Stack)</span>
                <span>2.5 km</span>
                <span className="text-amber-500 font-semibold">5.0 km (Buffer Limit)</span>
                <span>7.5 km</span>
                <span>10.0 km (External)</span>
              </div>

              {/* Hover Floating Tooltip */}
              {hoveredScatterPoint && (
                <div className="absolute top-3 left-14 bg-card/95 backdrop-blur-md border border-border shadow-lg p-2 rounded text-xs pointer-events-none font-mono">
                  <div className="font-semibold text-foreground font-sans">{hoveredScatterPoint.type}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Radiant Power: <strong className="text-foreground">{hoveredScatterPoint.frp} MW</strong> | Buffer Distance: <strong className="text-foreground">{hoveredScatterPoint.dist} km</strong>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Chart 2: Radial / Donut Chart (LULC Fuel Matrix) */}
          <Card className="lg:col-span-4 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                Land Cover Fuel Matrix
              </h3>
              <Badge variant="outline" className="text-[10px]">{selectedZone}</Badge>
            </div>

            {/* Donut SVG */}
            <div className="relative flex items-center justify-center h-44">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="var(--border)" strokeWidth="12" />

                {/* Slices calculated via strokeDasharray & strokeDashoffset */}
                {(() => {
                  const circumference = 2 * Math.PI * 38; // ~238.76
                  let cumulativePct = 0;

                  return lulcDonutData.map((slice, idx) => {
                    const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((cumulativePct / 100) * circumference);
                    cumulativePct += slice.pct;
                    const isHovered = hoveredDonutSlice === idx;

                    return (
                      <circle
                        key={slice.label}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={slice.strokeColor}
                        strokeWidth={isHovered ? 15 : 12}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all cursor-pointer hover:opacity-90"
                        onMouseEnter={() => setHoveredDonutSlice(idx)}
                      />
                    );
                  });
                })()}
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-lg font-bold font-mono text-foreground leading-none">
                  {hoveredDonutSlice !== null && lulcDonutData[hoveredDonutSlice] 
                    ? `${lulcDonutData[hoveredDonutSlice].pct}%` 
                    : totalCount.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 max-w-[80px] truncate">
                  {hoveredDonutSlice !== null && lulcDonutData[hoveredDonutSlice] 
                    ? lulcDonutData[hoveredDonutSlice].label.split(' ')[0] 
                    : 'Total Hits'}
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-1 text-xs pt-1">
              {lulcDonutData.map((slice, idx) => (
                <div
                  key={slice.label}
                  onMouseEnter={() => setHoveredDonutSlice(idx)}
                  className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                    hoveredDonutSlice === idx ? 'bg-secondary font-medium' : 'hover:bg-secondary/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="text-[11px] text-foreground">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">({slice.count.toLocaleString()})</span>
                    <span className="font-mono text-[11px] text-foreground font-semibold">{slice.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION B: DUAL-AXIS VOLUME & TEMPORAL HEATMAP MATRIX         */}
      {/* ============================================================== */}
      {(viewMode === 'ALL_GRAPHS' || viewMode === 'TEMPORAL') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 3: Dual-Axis Chart (Bars: Hotspots Count | Line: Mean MW) */}
          <Card className="lg:col-span-6 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Dual-Axis Hotspot Volume vs. Mean Radiance ({timeRange.toUpperCase()})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Temporal volume for <strong>{selectedZone}</strong> vs mean radiative flux (MW).
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-foreground/80" /> Detections (L)
                </span>
                <span className="flex items-center gap-1.5 text-destructive">
                  <span className="w-2.5 h-0.5 bg-destructive" /> Mean FRP MW (R)
                </span>
              </div>
            </div>

            {/* Dual Axis SVG */}
            <div className="relative h-60 w-full bg-secondary/15 rounded-md border border-border p-4">
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Horizontal reference lines */}
                <line x1="30" y1="20" x2="470" y2="20" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="30" y1="70" x2="470" y2="70" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="30" y1="120" x2="470" y2="120" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="30" y1="170" x2="470" y2="170" stroke="var(--border)" strokeWidth="1" />

                {/* Left Y-Axis labels (Count) */}
                <text x="2" y="24" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">{maxDualCount}</text>
                <text x="2" y="94" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">{Math.round(maxDualCount / 2)}</text>
                <text x="2" y="174" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">0</text>

                {/* Right Y-Axis labels (MW) */}
                <text x="475" y="24" fill="var(--destructive)" fontSize="8" fontFamily="monospace">{Math.round(maxDualMw * 1.2)}M</text>
                <text x="475" y="94" fill="var(--destructive)" fontSize="8" fontFamily="monospace">{Math.round(maxDualMw * 0.6)}M</text>
                <text x="475" y="174" fill="var(--destructive)" fontSize="8" fontFamily="monospace">0M</text>

                {/* Bars for Detections Count */}
                {dualAxisData.map((d, idx) => {
                  const len = dualAxisData.length;
                  const barWidth = Math.max(16, Math.floor(280 / len));
                  const cx = 50 + idx * ((470 - 50) / Math.max(1, len - 1));
                  const x = cx - barWidth / 2;
                  const height = (d.count / (maxDualCount * 1.15 || 1)) * 140;
                  const y = 170 - height;

                  return (
                    <rect
                      key={d.period}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      fill="var(--foreground)"
                      opacity="0.8"
                      rx="3"
                      className="hover:opacity-100 transition-opacity"
                    />
                  );
                })}

                {/* Spline Path for Mean FRP MW */}
                <path
                  d={splinePath}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                />

                {/* Line Points */}
                {dualAxisData.map((d, idx) => {
                  const len = dualAxisData.length;
                  const cx = 50 + idx * ((470 - 50) / Math.max(1, len - 1));
                  const cy = 170 - (d.mw / (maxDualMw * 1.2 || 1)) * 140;

                  return (
                    <circle
                      key={`pt-${d.period}`}
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="#ef4444"
                      stroke="var(--card)"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>

              {/* X-Axis Labels */}
              <div className="flex justify-between pl-6 pr-6 pt-1 text-[9px] font-mono text-muted-foreground border-t border-border mt-1">
                {dualAxisData.map((d) => (
                  <span key={d.period}>{d.period}</span>
                ))}
              </div>
            </div>
          </Card>

          {/* Chart 4: Day-of-Week × Time-of-Day Activity Heatmap Matrix */}
          <Card className="lg:col-span-6 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Day-of-Week × Time-of-Day Intensity Matrix
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Diurnal distribution for <strong>{selectedZone}</strong> ({timeRange.toUpperCase()}).
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <span>Low</span>
                <div className="flex h-2.5 w-16 rounded overflow-hidden">
                  <div className="w-1/4 bg-foreground/10" />
                  <div className="w-1/4 bg-amber-500/40" />
                  <div className="w-1/4 bg-orange-500/70" />
                  <div className="w-1/4 bg-red-600" />
                </div>
                <span>Peak</span>
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="space-y-1.5">
              {/* Header Time Slots */}
              <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono text-muted-foreground pl-10 text-center">
                {timeSlots.map((slot) => (
                  <span key={slot}>{slot}</span>
                ))}
              </div>

              {/* Rows */}
              {daysOfWeek.map((day, rowIdx) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-8 text-[11px] font-mono text-muted-foreground shrink-0">{day}</span>
                  <div className="grid grid-cols-6 gap-1.5 flex-1">
                    {heatmapMatrix[rowIdx].map((val, colIdx) => {
                      const intensity = val / maxHeatmapVal;
                      const timeLabel = timeSlots[colIdx];

                      const bgStyle = intensity > 0.75 
                        ? 'bg-red-600 text-white' 
                        : intensity > 0.5 
                        ? 'bg-orange-500/80 text-white' 
                        : intensity > 0.25 
                        ? 'bg-amber-500/50 text-foreground' 
                        : 'bg-secondary text-muted-foreground';

                      return (
                        <div
                          key={`${day}-${colIdx}`}
                          onMouseEnter={() => setHoveredHeatmapCell({ day, time: timeLabel, count: val })}
                          onMouseLeave={() => setHoveredHeatmapCell(null)}
                          className={`h-6 rounded flex items-center justify-center font-mono text-[10px] font-medium cursor-pointer transition-transform hover:scale-105 ${bgStyle}`}
                        >
                          {val}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Hover Tooltip Detail for Heatmap */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
              {hoveredHeatmapCell ? (
                <>
                  <span className="text-foreground">
                    Selected: <strong>{hoveredHeatmapCell.day} {hoveredHeatmapCell.time}</strong>
                  </span>
                  <span className="text-primary font-semibold">
                    {hoveredHeatmapCell.count} Anomaly Detections Recorded
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-[11px]">
                  Hover over any time block to inspect historical detection density in {selectedZone}.
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION C: INDUSTRIAL EXCEEDANCE & WIND RADAR DISPERSION       */}
      {/* ============================================================== */}
      {(viewMode === 'ALL_GRAPHS' || viewMode === 'EXCEEDANCE') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 5: Facility Permit Cap vs Observed Peak Grouped Bar Chart */}
          <Card className="lg:col-span-8 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Industrial Stack Compliance: Permitted Baseline vs. Observed Peak (MW)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filtered facilities for <strong>{selectedZone}</strong> comparing baseline limits against satellite overpass thermal FRP spikes.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded bg-muted-foreground/30" /> Permitted Limit (MW)
                </span>
                <span className="flex items-center gap-1.5 text-destructive">
                  <span className="w-2.5 h-2.5 rounded bg-destructive" /> Observed Peak (MW)
                </span>
              </div>
            </div>

            {/* Grouped Horizontal Bars */}
            <div className="space-y-3.5 pt-1">
              {facilityPermitBars.map((fac) => {
                const maxVal = 400;
                const capWidth = (fac.cap / maxVal) * 100;
                const peakWidth = (fac.peak / maxVal) * 100;

                return (
                  <div key={fac.name} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">
                        {fac.name} <span className="text-muted-foreground font-mono text-[10px]">({fac.state})</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-muted-foreground">Limit: {fac.cap} MW</span>
                        <span className="font-semibold text-destructive">Peak: {fac.peak} MW</span>
                        <Badge variant="destructive" className="text-[10px] py-0 px-1 font-mono">
                          {fac.delta}
                        </Badge>
                      </div>
                    </div>

                    <div className="h-3 w-full bg-secondary rounded flex overflow-hidden relative">
                      {/* Permitted Baseline */}
                      <div
                        style={{ width: `${capWidth}%` }}
                        className="bg-muted-foreground/40 h-full border-r border-border"
                      />
                      {/* Exceedance Segment */}
                      <div
                        style={{ width: `${peakWidth - capWidth}%` }}
                        className="bg-destructive h-full animate-pulse"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Chart 6: Wind Dispersion Radar / Rose Chart */}
          <Card className="lg:col-span-4 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Wind className="w-4 h-4 text-primary" />
                Plume Dispersion Radar (Wind Rose)
              </h3>
              <Badge variant="outline" className="text-[10px]">{selectedZone}</Badge>
            </div>

            {/* Radar / Polar Chart SVG */}
            <div className="relative flex items-center justify-center h-52">
              <svg className="w-56 h-52" viewBox="0 0 300 220">
                {/* Concentric Rings */}
                <circle cx="150" cy="110" r="25" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx="150" cy="110" r="50" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx="150" cy="110" r="75" fill="none" stroke="var(--border)" strokeWidth="1" />

                {/* Axes */}
                <line x1="150" y1="25" x2="150" y2="195" stroke="var(--border)" strokeWidth="1" />
                <line x1="65" y1="110" x2="235" y2="110" stroke="var(--border)" strokeWidth="1" />
                <line x1="90" y1="50" x2="210" y2="170" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="90" y1="170" x2="210" y2="50" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

                {/* Labels */}
                <text x="150" y="20" fill="var(--foreground)" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">N</text>
                <text x="245" y="113" fill="var(--foreground)" fontSize="9" fontFamily="monospace" textAnchor="start" fontWeight="bold">E</text>
                <text x="150" y="210" fill="var(--foreground)" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">S</text>
                <text x="50" y="113" fill="var(--foreground)" fontSize="9" fontFamily="monospace" textAnchor="end" fontWeight="bold">W</text>
                <text x="215" y="60" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">NE</text>
                <text x="80" y="60" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">NW</text>

                {/* Dispersion Polygon */}
                <polygon
                  points={radarPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(239, 68, 68, 0.25)"
                  stroke="#ef4444"
                  strokeWidth="2"
                />

                {/* Vertex Points */}
                {radarPoints.map((p) => (
                  <circle key={p.dir} cx={p.x} cy={p.y} r="3" fill="#ef4444" />
                ))}
              </svg>
            </div>

            <div className="pt-1 border-t border-border space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Prevailing Trajectory:</span>
                <span className="font-semibold text-foreground">{profile.trajectory}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Sensitive Populated Zone:</span>
                <span className="text-destructive font-semibold">{profile.downwind}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION D: AI MODEL ROC-AUC & CONFUSION MATRIX                 */}
      {/* ============================================================== */}
      {(viewMode === 'ALL_GRAPHS' || viewMode === 'AI_METRICS') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 7: ROC-AUC Discrimination Curve */}
          <Card className="lg:col-span-6 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Receiver Operating Characteristic (ROC-AUC Curve)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Binary discrimination between true vegetation fires and stationary industrial stack emitters.
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">AUC = 0.982</Badge>
            </div>

            {/* ROC SVG */}
            <div className="relative h-56 w-full bg-secondary/15 rounded-md border border-border p-4">
              <svg className="w-full h-full" viewBox="0 0 300 180" preserveAspectRatio="none">
                {/* Diagonal reference (random guess) */}
                <line x1="20" y1="160" x2="280" y2="20" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

                {/* ROC Curve */}
                <path
                  d="M 20,160 Q 25,35 60,25 T 140,22 T 280,20"
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth="2.5"
                />

                {/* Operational Operating Point */}
                <circle cx="60" cy="25" r="4" fill="var(--foreground)" stroke="var(--card)" strokeWidth="1.5" />

                <text x="70" y="32" fill="var(--foreground)" fontSize="9" fontFamily="monospace">
                  Optimal Op Point (TPR: 0.95, FPR: 0.04)
                </text>
                <text x="25" y="175" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">0.0 FPR</text>
                <text x="250" y="175" fill="var(--muted-foreground)" fontSize="8" fontFamily="monospace">1.0 FPR</text>
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
              <div className="p-2 rounded bg-secondary/30 border border-border">
                <div className="text-[10px] text-muted-foreground">Precision</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">95.4%</div>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border">
                <div className="text-[10px] text-muted-foreground">Recall</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">93.1%</div>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border">
                <div className="text-[10px] text-muted-foreground">F1-Score</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">94.2%</div>
              </div>
            </div>
          </Card>

          {/* Chart 8: Multiclass Confusion Matrix Heatmap */}
          <Card className="lg:col-span-6 p-6 space-y-4 bg-card border-border shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  Multiclass Classification Confusion Matrix
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ground-truth cross-validation across 1,130 manually labeled satellite episodes.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">Test Split: 1,130</Badge>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border">
                    <th className="p-2 text-left">Ground Truth \ Predicted</th>
                    <th className="p-2">Industrial</th>
                    <th className="p-2">Wildfire</th>
                    <th className="p-2">Glint / Noise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  <tr>
                    <td className="p-2.5 text-left font-sans text-foreground font-medium">Industrial Flare</td>
                    <td className="p-2.5 bg-foreground/10 text-foreground font-semibold">698 (96%)</td>
                    <td className="p-2.5 text-muted-foreground">18 (2%)</td>
                    <td className="p-2.5 text-muted-foreground">12 (2%)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left font-sans text-foreground font-medium">Wildfire Front</td>
                    <td className="p-2.5 text-muted-foreground">14 (3%)</td>
                    <td className="p-2.5 bg-foreground/10 text-foreground font-semibold">372 (93%)</td>
                    <td className="p-2.5 text-muted-foreground">14 (4%)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left font-sans text-foreground font-medium">Solar Glint / Noise</td>
                    <td className="p-2.5 text-muted-foreground">2 (1%)</td>
                    <td className="p-2.5 text-muted-foreground">1 (1%)</td>
                    <td className="p-2.5 bg-foreground/10 text-foreground font-semibold">99 (98%)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall Multiclass Accuracy:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">95.4%</span>
            </div>
          </Card>
        </div>
      )}

      {/* Review Queue Shortcut Banner */}
      <Card className="p-4 bg-secondary/30 border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">
              Human-in-the-Loop Active Calibration ({selectedZone})
            </div>
            <div className="text-[11px] text-muted-foreground">
              Reviewing pending anomalies continuously refines the decision boundaries and suppresses false positives.
            </div>
          </div>
        </div>

        <Button
          onClick={onOpenReviewQueue}
          className="text-xs font-medium gap-1.5 shrink-0"
        >
          <span>Open Anomaly Review Queue</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </Card>
    </div>
  );
};
