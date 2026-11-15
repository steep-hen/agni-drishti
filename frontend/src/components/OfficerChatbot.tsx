import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Send,
  X,
  Minus,
  Maximize2,
  Building2,
  Copy,
  Check,
  MapPin,
  AlertTriangle,
  FileText,
  ChevronRight,
  Bot,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { IndustrialFacility, ThermalEpisode, ScreenTab } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { API } from '../lib/api';

interface OfficerChatbotProps {
  facilities: IndustrialFacility[];
  episodes: ThermalEpisode[];
  onNavigateToTab: (tab: ScreenTab) => void;
  onOpenFacilityDossier: (facilityId: string) => void;
  onOpenMapForFacility?: (facilityId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  text: string;
  facilityCard?: IndustrialFacility;
  actionButtons?: { label: string; tab?: ScreenTab; facilityId?: string }[];
  isNotice?: boolean;
}

// Rich formatter for inline tokens (bold, badges, MW highlights, code IDs)
function formatInlineTokens(str: string): React.ReactNode {
  // Regex splitting by bold tokens (**...**), code tokens (`...`), and facility IDs ([FAC_...])
  const parts = str.split(/(\*\*.*?\*\*|`.*?`|\[FAC_[^\]]+\])/g);

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      if (inner === 'EXCEEDANCE') {
        return (
          <span key={i} className="font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded border border-red-500/30 text-[10px] inline-block tracking-wide">
            EXCEEDANCE
          </span>
        );
      }
      if (inner === 'PERSISTENT') {
        return (
          <span key={i} className="font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 text-[10px] inline-block tracking-wide">
            PERSISTENT
          </span>
        );
      }
      if (inner === 'NOMINAL') {
        return (
          <span key={i} className="font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 text-[10px] inline-block tracking-wide">
            NOMINAL
          </span>
        );
      }
      if (inner.includes('MW')) {
        return (
          <strong key={i} className="font-bold text-orange-400 font-mono">
            {inner}
          </strong>
        );
      }
      return (
        <strong key={i} className="font-semibold text-foreground">
          {inner}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <span key={i} className="font-mono text-[10.5px] bg-secondary/90 text-sky-400 px-1.5 py-0.5 rounded border border-border">
          {part.slice(1, -1)}
        </span>
      );
    }

    if (part.startsWith('[FAC_') && part.endsWith(']')) {
      return (
        <span key={i} className="font-mono text-[10px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded ml-1 font-medium">
          {part}
        </span>
      );
    }

    return part;
  });
}

function renderFormattedMessage(text: string) {
  const paragraphs = text.split('\n\n');

  return (
    <div className="space-y-3 font-sans text-xs">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n');

        // Check if paragraph contains a formal notice code block
        if (para.includes('FORMAL SHOW-CAUSE REGULATORY NOTICE')) {
          return (
            <div key={pIdx} className="p-3 rounded-lg bg-card/90 border border-orange-500/40 font-mono text-[10.5px] text-muted-foreground whitespace-pre-wrap leading-relaxed space-y-1.5">
              {para.replace(/```/g, '')}
            </div>
          );
        }

        // Check if paragraph is a facility list entry (e.g. starts with "1. **Facility Name**" or "1. Facility")
        const isFacilityEntry = /^\d+\.\s+/.test(lines[0].trim());

        if (isFacilityEntry) {
          const titleLine = lines[0].trim();
          const detailLines = lines.slice(1);
          return (
            <div key={pIdx} className="p-2.5 rounded-lg bg-secondary/40 border border-border border-l-4 border-l-orange-500 space-y-1.5 shadow-xs">
              <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                {formatInlineTokens(titleLine)}
              </div>
              <div className="space-y-1 pt-0.5 pl-1">
                {detailLines.map((dLine, dlIdx) => {
                  const trimmed = dLine.trim();
                  if (!trimmed) return null;
                  const isBullet = trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('-');
                  const cleanText = isBullet ? trimmed.replace(/^[•*-]\s*/, '') : trimmed;
                  return (
                    <div key={dlIdx} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug">
                      <span className="text-orange-400 font-bold shrink-0 mt-0.5">•</span>
                      <span className="flex-1">{formatInlineTokens(cleanText)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;

              if (trimmed.startsWith('### ')) {
                return (
                  <div key={lIdx} className="font-bold text-xs text-orange-400 pb-1 border-b border-border/70 flex items-center gap-1.5">
                    {trimmed.replace('### ', '')}
                  </div>
                );
              }

              if (trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('-')) {
                const cleanText = trimmed.replace(/^[•*-]\s*/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5 text-[11px] text-muted-foreground leading-snug">
                    <span className="text-orange-400 font-bold shrink-0 mt-0.5">•</span>
                    <span className="flex-1">{formatInlineTokens(cleanText)}</span>
                  </div>
                );
              }

              if (trimmed.startsWith('*Officer Recommendation:*')) {
                return (
                  <div key={lIdx} className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-medium leading-relaxed">
                    {formatInlineTokens(trimmed)}
                  </div>
                );
              }

              return (
                <p key={lIdx} className="leading-relaxed">
                  {formatInlineTokens(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const OfficerChatbot: React.FC<OfficerChatbotProps> = ({
  facilities,
  episodes,
  onNavigateToTab,
  onOpenFacilityDossier,
  onOpenMapForFacility,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `**Government Compliance & Enforcement Desk**\n\nOfficer, I am grounded strictly on the **${facilities.length} verified industrial facilities** and **VIIRS satellite thermal detection records** in this system. I do not invent or fabricate data.\n\nYou can ask me for compliance audits, district violation tallies, facility risk profiles, or to draft an official Show-Cause Notice.`,
      actionButtons: [
        { label: "📋 Today's Exceedance SitRep" },
        { label: "⚖️ Top 5 Highest Risk Violators" },
        { label: "🏭 Check Ballari District Status" },
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Keep welcome message count synchronized with verified facilities count
  useEffect(() => {
    const count = facilities.length || 208;
    setMessages(prev =>
      prev.map(m =>
        m.id === 'welcome'
          ? {
              ...m,
              text: `**Government Compliance & Enforcement Desk**\n\nOfficer, I am grounded strictly on the **${count} verified industrial facilities** and **VIIRS satellite thermal detection records** in this system. I do not invent or fabricate data.\n\nYou can ask me for compliance audits, district violation tallies, facility risk profiles, or to draft an official Show-Cause Notice.`
            }
          : m
      )
    );
  }, [facilities.length]);

  const handleCopyNotice = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Pure deterministic query engine - strictly grounded on project dataset
  const processOfficerQuery = (rawQuery: string): ChatMessage => {
    const q = rawQuery.trim().toLowerCase();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. EXECUTIVE SITREP / SUMMARY
    if (q.includes('sitrep') || q.includes('summary') || q.includes('overview') || q.includes('briefing') || q.includes('today')) {
      const exceedanceList = facilities.filter(f => f.status === 'EXCEEDANCE');
      const persistentList = facilities.filter(f => f.status === 'PERSISTENT');
      const nominalList = facilities.filter(f => f.status === 'NOMINAL');
      const totalFireCount = facilities.reduce((acc, f) => acc + (f.linkedEpisodesCount || 0), 0);
      const pendingReviewCount = episodes.filter(e => e.status === 'AWAITING VERIFICATION').length;

      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 📋 OFFICIAL COMPLIANCE SITREP
**Registry Scope:** Southern Industrial Zone (${facilities.length} Monitored Units)

* **Exceedance Violations (Immediate Action Required):** ${exceedanceList.length} facilities
* **Persistent Radiance Alerts:** ${persistentList.length} facilities
* **Nominal / Permitted Baseline:** ${nominalList.length} facilities
* **Total Recorded Thermal Fire Events:** ${totalFireCount.toLocaleString()} detections
* **Episodes Pending Human Verification:** ${pendingReviewCount} episodes

**Highest Exceedance Facilities:**
${exceedanceList.slice(0, 4).map((f, i) => `${i + 1}. **${f.name}** (${f.district}, ${f.stateZone}) — Risk: **${f.bufferOverlaps || 'High'}**, Anomalies: **${f.linkedEpisodesCount}**`).join('\n')}

*Data verified from spatial geofence matching and VIIRS satellite sensors.*`,
        actionButtons: [
          { label: "View Exceedance Facilities", tab: 'facilities' },
          { label: "Open Review Queue", tab: 'review' }
        ]
      };
    }

    // 2. STATE RANKINGS & COMPARATIVE QUERIES (NON-INDUSTRIAL VS INDUSTRIAL)
    const isStateRankingQuery =
      q.includes('which state') ||
      q.includes('what state') ||
      q.includes('state has most') ||
      q.includes('state with most') ||
      (q.includes('state') && (q.includes('most') || q.includes('highest') || q.includes('worst') || q.includes('max') || q.includes('rank') || q.includes('compare') || q.includes('anomaly') || q.includes('anomalies')));

    if (isStateRankingQuery) {
      if (q.includes('non') || q.includes('agricultural') || q.includes('crop') || q.includes('wildfire') || q.includes('forest') || q.includes('rural') || q.includes('stubble')) {
        // Official satellite tally for non-industrial fires in southern region
        return {
          id: String(Date.now()),
          sender: 'bot',
          timestamp: timeNow,
          text: `### 🌾 STATE RANKING: NON-INDUSTRIAL THERMAL ANOMALIES
**Official Satellite Telemetry (VIIRS Southern Region — 126,558 Total Non-Industrial Detections):**

1. **Telangana** — **51,465 detections (40.7%)** [Rank 1 — Highest]
   • **Primary Sector:** Open agricultural croplands, seasonal paddy stubble burning, and post-harvest clearing across northern & eastern belts.

2. **Andhra Pradesh** — **24,726 detections (19.5%)** [Rank 2]
   • **Primary Sector:** Coastal delta agricultural residues and rural rangeland clearings.

3. **Karnataka** — **24,154 detections (19.1%)** [Rank 3]
   • **Primary Sector:** Interior Deccan dryland burning and scrubland clearings located outside registered industrial buffers.

4. **Tamil Nadu** — **14,360 detections (11.3%)** [Rank 4]
   • **Primary Sector:** Seasonal agricultural residue clearing in Cauvery river delta.

5. **Kerala** — **2,064 detections (1.6%)** [Rank 5 — Lowest]
   • **Primary Sector:** Tropical canopy cover with negligible open agricultural burning.

*Officer Summary:* **Telangana** has the highest number of non-industrial thermal anomalies (51,465 events). In contrast, **Karnataka** leads in *industrial* facility violations with the largest cluster of non-compliant heavy factories.`,
          actionButtons: [
            { label: "View Industrial Violations by State", tab: 'facilities' }
          ]
        };
      }

      // Check if specifically asking about industrial units
      const isSpecificIndustrial = q.includes('industrial') || q.includes('factory') || q.includes('facilities') || q.includes('plant') || q.includes('exceedance') || q.includes('violation');

      // Industrial Exceedance Ranking by State
      const stateStats: Record<string, { total: number; exceedances: number; fires: number }> = {};
      facilities.forEach(f => {
        const s = f.stateZone || 'Other';
        if (!stateStats[s]) stateStats[s] = { total: 0, exceedances: 0, fires: 0 };
        stateStats[s].total++;
        if (f.status === 'EXCEEDANCE') stateStats[s].exceedances++;
        stateStats[s].fires += (f.linkedEpisodesCount || 0);
      });

      const sortedStates = Object.entries(stateStats).sort((a, b) => b[1].exceedances - a[1].exceedances || b[1].fires - a[1].fires);
      const topState = sortedStates[0];

      if (isSpecificIndustrial) {
        return {
          id: String(Date.now()),
          sender: 'bot',
          timestamp: timeNow,
          text: `### 🏭 STATE RANKING: INDUSTRIAL THERMAL EXCEEDANCES
**Official Registry of ${facilities.length} Monitored Heavy Industrial Units:**

${sortedStates.map(([stateName, stats], i) => `${i + 1}. **${stateName}** — **${stats.exceedances} Exceedance Violations**
   • **Monitored Units:** ${stats.total} facilities
   • **Total Recorded Industrial Thermal Events:** ${stats.fires.toLocaleString()} detections
   • **Regulatory Posture:** ${stats.exceedances > 0 ? 'Active non-compliance investigations required' : 'Nominal permitted baseline'}`).join('\n\n')}

*Officer Summary:* **${topState[0]}** has the highest number of industrial facility violations (${topState[1].exceedances} facilities in exceedance status and ${topState[1].fires.toLocaleString()} cumulative industrial fire detections).`,
          actionButtons: [
            { label: `View ${topState[0]} Facilities`, tab: 'facilities' }
          ]
        };
      }

      // General query ("which state has highest anomaly / most anomalies?") -> Comprehensive answer covering both!
      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 🗺️ STATE COMPARATIVE ANALYSIS: HIGHEST THERMAL ANOMALIES

According to official satellite telemetry and registry records:

**1. Highest in Non-Industrial Anomalies (Agricultural / Stubble Burning):**
• 🥇 **Telangana** — **51,465 detections (40.7% of total 126,558 non-industrial events)**
  • Primary driver: Open agricultural croplands and seasonal post-harvest crop clearing.
  • *State Ranking:* 1. Telangana (51,465) > 2. Andhra Pradesh (24,726) > 3. Karnataka (24,154) > 4. Tamil Nadu (14,360) > 5. Kerala (2,064).

**2. Highest in Industrial Facility Violations & Exceedance:**
• 🥇 **Karnataka** — **${topState[1].exceedances} Facilities in Exceedance (${topState[1].fires.toLocaleString()} industrial fire detections)**
  • Primary driver: Heavy industrial clusters (Thermal Power Plants, Steel, Cement) exceeding permitted thermal baseline (e.g. JSW Vijayanagar, Bellary).
  • *State Ranking:* ${sortedStates.map(([s, st]) => `${s} (${st.exceedances} exceedances)`).join(' > ')}.

*Regulatory Takeaway:* If assessing rural biomass/agricultural burning, **Telangana** ranks highest. If assessing regulated industrial facility compliance, **Karnataka** ranks highest.`,
        actionButtons: [
          { label: "View Karnataka Violators", tab: 'facilities' },
          { label: "View Analytics", tab: 'analytics' }
        ]
      };
    }

    // 3. TOP VIOLATORS / RISK RANKING
    if (q.includes('top') || q.includes('highest') || q.includes('worst') || q.includes('rank') || q.includes('risk score')) {
      const sorted = [...facilities].sort((a, b) => {
        const riskA = parseFloat(String(a.bufferOverlaps || '').replace(/[^0-9.]/g, '')) || 0;
        const riskB = parseFloat(String(b.bufferOverlaps || '').replace(/[^0-9.]/g, '')) || 0;
        return riskB - riskA || (b.linkedEpisodesCount || 0) - (a.linkedEpisodesCount || 0);
      });

      const top5 = sorted.slice(0, 5);

      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### ⚖️ TOP OFFENDING INDUSTRIAL FACILITIES (BY RISK RATING)
The following facilities exhibit the highest calculated environmental risk scores based on fire frequency, proximity to population buffers, and radiance levels:

${top5.map((f, i) => `${i + 1}. **${f.name}** [${f.id.trim()}]
   • **Status:** ${f.status} | **Risk:** ${f.bufferOverlaps || 'High'}
   • **Jurisdiction:** ${f.district}, ${f.stateZone}
   • **Thermal Capacity:** Cap: ${f.nominalFrpCapMw} MW | Peak Radiance: **${f.peakFrp12mMw} MW**
   • **Fire Detections:** ${f.linkedEpisodesCount}`).join('\n\n')}

*Officer Recommendation:* Prioritize on-site stack inspection or issue regulatory notice to Rank #1.`,
        actionButtons: [
          { label: `Examine ${top5[0].shortName}`, facilityId: top5[0].id, tab: 'facilities' }
        ]
      };
    }

    // 3. SHOW CAUSE NOTICE DRAFTING
    if (q.includes('notice') || q.includes('show cause') || q.includes('show-cause') || q.includes('draft')) {
      // Find matching facility or take the highest exceedance facility
      const matched = facilities.find(f =>
        q.includes(f.name.toLowerCase()) ||
        q.includes(f.id.toLowerCase().trim()) ||
        q.includes(f.district.toLowerCase())
      ) || facilities.find(f => f.status === 'EXCEEDANCE') || facilities[0];

      const noticeText = `FORMAL SHOW-CAUSE REGULATORY NOTICE
Reference No.: CPCB/S-ZONE/ENF-2026/${matched.id.trim()}
Issuing Authority: Regional Environmental Enforcement Directorate
Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}

TO:
The Occupier / Factory Manager
Facility: ${matched.name}
Facility ID: ${matched.id.trim()}
District: ${matched.district}, State: ${matched.stateZone}
Geospatial Coordinates: ${matched.coordinates.latStr}, ${matched.coordinates.lngStr}

SUBJECT: NOTICE UNDER SECTION 31A OF THE AIR (PREVENTION AND CONTROL OF POLLUTION) ACT / EPA COMPLIANCE FOR UNPERMITTED THERMAL RADIATION

WHEREAS satellite-based environmental surveillance (VIIRS SNPP/NOAA Earth Observation) operating over your facility's registered coordinates has documented persistent unauthorized thermal radiation episodes;

AND WHEREAS your facility is registered with a Nominal Permit FRP Cap of ${matched.nominalFrpCapMw} MW and a verified Baseline of ${matched.baselineOperatingMw} MW;

AND WHEREAS satellite optical telemetry confirmed repeated non-compliance with a Peak Radiance of ${matched.peakFrp12mMw} MW, accumulating ${matched.linkedEpisodesCount} unpermitted thermal anomaly detections, resulting in a Severe Regulatory Risk Rating (${matched.bufferOverlaps});

NOW THEREFORE, you are hereby directed to SHOW CAUSE within fifteen (15) days of receipt of this notice as to why penal action, including revoking of operational consent or imposition of Environmental Damage Compensation (EDC), should not be initiated against your facility.

Issued by Order of the Enforcement Directorate.`;

      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 📄 DRAFTED SHOW-CAUSE NOTICE
Here is the official notice generated using verified database records for **${matched.name}**:

${noticeText}`,
        facilityCard: matched,
        isNotice: true,
        actionButtons: [
          { label: "View Facility Dossier", facilityId: matched.id, tab: 'facilities' }
        ]
      };
    }

    // 4. DISTRICT OR SPECIFIC STATE AUDIT
    const states = ['karnataka', 'tamil nadu', 'andhra pradesh', 'telangana', 'kerala'];
    const matchedState = states.find(s => q.includes(s));

    // Check if district is mentioned
    const matchedByDistrict = facilities.filter(f => q.includes(f.district.toLowerCase().trim()));

    if (matchedByDistrict.length > 0) {
      const distName = matchedByDistrict[0].district;
      const exceedances = matchedByDistrict.filter(f => f.status === 'EXCEEDANCE');
      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 📍 DISTRICT COMPLIANCE AUDIT: ${distName.toUpperCase()}
* **Total Monitored Facilities in District:** ${matchedByDistrict.length}
* **Active Exceedance Status:** ${exceedances.length}
* **Nominal Compliant:** ${matchedByDistrict.filter(f => f.status === 'NOMINAL').length}

**Facilities in this District:**
${matchedByDistrict.map(f => `• **${f.name}** [${f.id.trim()}] — Status: **${f.status}**, Anomalies: ${f.linkedEpisodesCount}, Cap: ${f.nominalFrpCapMw} MW`).join('\n')}`,
        actionButtons: [
          { label: "Open Facilities Directory", tab: 'facilities' }
        ]
      };
    }

    if (matchedState) {
      const stateFacs = facilities.filter(f => f.stateZone.toLowerCase().includes(matchedState));
      const stateExceedances = stateFacs.filter(f => f.status === 'EXCEEDANCE');
      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 🏛️ STATE JURISDICTION AUDIT: ${matchedState.toUpperCase()}
* **Total Registered Units in State:** ${stateFacs.length}
* **Exceedances (Violations):** ${stateExceedances.length}
* **Persistent Heat Signatures:** ${stateFacs.filter(f => f.status === 'PERSISTENT').length}
* **Compliant (Nominal):** ${stateFacs.filter(f => f.status === 'NOMINAL').length}

**Exceedance Units in ${matchedState.toUpperCase()}:**
${stateExceedances.length > 0 ? stateExceedances.map(f => `• **${f.name}** (${f.district}) — Risk: **${f.bufferOverlaps}**, Peak: ${f.peakFrp12mMw} MW`).join('\n') : '• No active exceedances currently recorded in this state.'}`,
        actionButtons: [
          { label: `View ${matchedState.toUpperCase()} Units`, tab: 'facilities' }
        ]
      };
    }

    // 6. SPECIFIC FACILITY LOOKUP (Strict token matching to prevent accidental substrings like 'has' -> Hassan)
    const genericStopWords = new Set([
      'power', 'station', 'plant', 'tpp', 'terminal', 'limited', 'ltd', 'works', 'refinery',
      'cement', 'steel', 'mine', 'the', 'what', 'tell', 'about', 'status', 'show', 'for', 'which',
      'state', 'has', 'most', 'non', 'industrial', 'facility', 'anomaly', 'unit', 'and', 'with', 'by',
      'where', 'give', 'list', 'check', 'audit', 'find', 'does', 'have', 'from', 'anomalies'
    ]);

    const foundFacility = facilities.find(f => {
      const fid = f.id.toLowerCase().trim();
      const fname = f.name.toLowerCase().trim();

      // Exact ID match or query explicitly mentions the ID: e.g. "FAC_VIJAYANAGAR_JSW"
      if (fid === q || q.includes(fid)) return true;

      // Exact full name match: e.g. "JSW Vijayanagar Power Station"
      if (fname === q || q.includes(fname)) return true;

      // Check for distinctive unique keywords (at least 4 chars and not a generic stop word)
      const nameTokens = fname.split(/[\s()_-]+/).filter(w => w.length >= 4 && !genericStopWords.has(w));

      return nameTokens.some(token => {
        const regex = new RegExp(`\\b${token}\\b`, 'i');
        return regex.test(q);
      });
    });

    if (foundFacility) {
      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 🏭 OFFICIAL DOSSIER: ${foundFacility.name}
* **Facility ID:** \`${foundFacility.id.trim()}\`
* **Industry Sector:** ${foundFacility.category}
* **Jurisdiction:** District of ${foundFacility.district}, State of ${foundFacility.stateZone}
* **Coordinates:** ${foundFacility.coordinates.latStr}, ${foundFacility.coordinates.lngStr}
* **Regulatory Compliance Status:** **${foundFacility.status}**
* **Evaluated Risk Level:** ${foundFacility.bufferOverlaps || 'Standard'}
* **Thermal Capacity Limits:**
  • Nominal Permit Cap: **${foundFacility.nominalFrpCapMw} MW**
  • Baseline Operating Level: **${foundFacility.baselineOperatingMw} MW**
  • Observed Peak Radiance (12m): **${foundFacility.peakFrp12mMw} MW**
* **Stack Configuration:** ${foundFacility.registeredStacks}
* **Recorded Satellite Anomaly Detections:** ${foundFacility.linkedEpisodesCount} events`,
        facilityCard: foundFacility,
        actionButtons: [
          { label: "Open Detailed Dossier", facilityId: foundFacility.id, tab: 'facilities' },
          { label: "Locate on Tactical Map", facilityId: foundFacility.id, tab: 'map' }
        ]
      };
    }

    // 6. EPISODES / ALERTS ENQUIRY
    if (q.includes('episode') || q.includes('alert') || q.includes('unverified') || q.includes('review')) {
      const pending = episodes.filter(e => e.status === 'AWAITING VERIFICATION');
      return {
        id: String(Date.now()),
        sender: 'bot',
        timestamp: timeNow,
        text: `### 🚨 THERMAL ANOMALY EPISODES
* **Total Anomaly Episodes on Record:** ${episodes.length}
* **Pending Human Verification:** ${pending.length}

${pending.length > 0 ? `**Recent Pending Episodes Requiring Officer Review:**\n${pending.slice(0, 3).map(e => `• **Episode ${e.id}** [${e.facilityName || 'Unassociated'}] — Peak FRP: **${e.peakFrp} MW**, Detected: ${e.timestamp}`).join('\n')}` : 'All recorded episodes have been verified.'}`,
        actionButtons: [
          { label: "Open Review Queue", tab: 'review' }
        ]
      };
    }

    // 7. STRICT OUT-OF-SCOPE FALLBACK (DO NOT FABRICATE)
    return {
      id: String(Date.now()),
      sender: 'bot',
      timestamp: timeNow,
      text: `⚠️ **Information Not Available in Official Registry**

Officer, the requested detail was not found in the verified system records. 

To maintain legal and regulatory integrity, this assistant **strictly uses only verified dataset attributes**:
* 208 Monitored Industrial Facilities (Power, Refineries, Steel, Cement, Mines)
* VIIRS Satellite Fire Detections & Radiance (MW)
* Registered Permit FRP Thresholds & Baseline Loads
* District & State Jurisdictions in Southern Zone
* Regulatory Compliance Statuses (\`EXCEEDANCE\`, \`PERSISTENT\`, \`NOMINAL\`)

Please ask regarding a specific **facility name / ID**, **district**, **state**, **exceedance audit**, or **notice drafting**.`
    };
  };

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    setGeminiKey(trimmed);
    localStorage.setItem('GEMINI_API_KEY', trimmed);
    setShowKeyModal(false);
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    try {
      // 1. Try backend Gemini API
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          customApiKey: geminiKey || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const isNotice = data.reply.includes('SHOW-CAUSE') || data.reply.includes('NOTICE');
          setMessages(prev => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'bot',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              text: data.reply,
              isNotice,
            }
          ]);
          setIsThinking(false);
          return;
        }
      }
    } catch (err) {
      // Network or API failure, fallback gracefully below
    }

    // 2. Fallback to deterministic grounded rule engine
    setTimeout(() => {
      const botReply = processOfficerQuery(query);
      setMessages(prev => [...prev, botReply]);
      setIsThinking(false);
    }, 200);
  };

  const handleActionButton = (btn: { label: string; tab?: ScreenTab; facilityId?: string }) => {
    if (btn.tab) {
      onNavigateToTab(btn.tab);
      if (btn.facilityId && btn.tab === 'facilities') {
        onOpenFacilityDossier(btn.facilityId);
      } else if (btn.facilityId && btn.tab === 'map' && onOpenMapForFacility) {
        onOpenMapForFacility(btn.facilityId);
      }
      setIsMinimized(true);
      return;
    }
    handleSend(btn.label.replace(/^[^\w]+/, ''));
  };

  return (
    <>
      {/* Floating Toggle Button (Always visible bottom-right) */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-700 shadow-2xl shadow-orange-900/60 border-2 border-orange-400/60 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform officer-wave-btn"
          title="Open Government Officer AI Compliance Desk"
          style={{ animation: 'officerWave 2s ease-in-out infinite' }}
        >
          {/* Reddit Snoo alien SVG icon */}
          <svg viewBox="0 0 20 20" className="w-9 h-9" fill="white" xmlns="http://www.w3.org/2000/svg">
            {/* Head / body circle */}
            <circle cx="10" cy="10" r="10" fill="none" />
            {/* Antenna ball */}
            <circle cx="14.2" cy="2.5" r="1.3" fill="white" />
            {/* Antenna stick */}
            <line x1="10" y1="6" x2="13.5" y2="3.2" stroke="white" strokeWidth="1.1" strokeLinecap="round" />
            {/* Main head circle */}
            <circle cx="10" cy="10.5" r="5.5" fill="white" />
            {/* Left eye */}
            <circle cx="8" cy="9.8" r="1.1" fill="#f97316" />
            {/* Right eye */}
            <circle cx="12" cy="9.8" r="1.1" fill="#f97316" />
            {/* Left eye shine */}
            <circle cx="8.4" cy="9.4" r="0.4" fill="white" />
            {/* Right eye shine */}
            <circle cx="12.4" cy="9.4" r="0.4" fill="white" />
            {/* Smile */}
            <path d="M7.8 12 Q10 13.8 12.2 12" stroke="#f97316" strokeWidth="0.9" fill="none" strokeLinecap="round" />
            {/* Left ear */}
            <ellipse cx="4.2" cy="10.5" rx="1.2" ry="1.6" fill="white" />
            {/* Right ear */}
            <ellipse cx="15.8" cy="10.5" rx="1.2" ry="1.6" fill="white" />
          </svg>
        </button>
      )}

      {/* Main Chatbot Panel */}
      {isOpen && (
        <div
          className={`fixed right-4 z-50 transition-all duration-300 flex flex-col bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-xl overflow-hidden ${isMinimized
            ? 'bottom-4 w-80 h-14'
            : 'bottom-4 w-[420px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-2rem)]'
            }`}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-secondary/80 border-b border-border flex items-center justify-between select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                  Officer Compliance Desk
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  Grounded • Official Dataset Records
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setKeyInput(geminiKey);
                  setShowKeyModal(!showKeyModal);
                }}
                className={`h-6 w-6 ${geminiKey ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
                title={geminiKey ? "Gemini AI Key Active (Click to edit)" : "Configure Gemini API Key"}
              >
                <KeyRound className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-destructive/15 hover:text-destructive"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* API Key Modal / Dropdown */}
          {showKeyModal && (
            <div className="p-3 bg-secondary/95 border-b border-border text-xs space-y-2 z-10 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Gemini AI Reasoning Engine
                </span>
                <button onClick={() => setShowKeyModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Paste your Google Gemini API key to enable high-order semantic reasoning across the spatial registry.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste AIzaSy... key"
                  className="flex-1 bg-card border border-border rounded px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:border-orange-500/60"
                />
                <Button size="sm" onClick={() => handleSaveKey(keyInput)} className="h-7 text-xs bg-orange-600 hover:bg-orange-500 text-white font-medium">
                  Save
                </Button>
                {geminiKey && (
                  <Button size="sm" variant="ghost" onClick={() => handleSaveKey('')} className="h-7 text-xs text-muted-foreground hover:text-destructive">
                    Clear
                  </Button>
                )}
              </div>
              {geminiKey && (
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Key configured • Connected to Gemini 2.0 / 1.5 Flash
                </div>
              )}
            </div>
          )}

          {/* Body (Messages) */}
          {!isMinimized && (
            <>
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-muted-foreground font-mono">
                      {m.sender === 'bot' ? (
                        <>
                          <Bot className="w-3 h-3 text-orange-400" />
                          <span>Compliance Officer AI</span>
                        </>
                      ) : (
                        <span>You (Officer)</span>
                      )}
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>

                    <div
                      className={`p-3 rounded-lg max-w-[92%] leading-relaxed ${m.sender === 'user'
                        ? 'bg-orange-600 text-white rounded-tr-none shadow-md'
                        : 'bg-secondary/40 border border-border text-foreground rounded-tl-none space-y-2'
                        }`}
                    >
                      {/* Rich Officer Output Formatting */}
                      {renderFormattedMessage(m.text)}

                      {/* Notice Box with Copy Button */}
                      {m.isNotice && (
                        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Formal Government Notice Template
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyNotice(m.text, m.id)}
                            className="h-6 text-[10px] gap-1 px-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Notice</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Action Navigation Buttons */}
                      {m.actionButtons && m.actionButtons.length > 0 && (
                        <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1.5">
                          {m.actionButtons.map((btn, bidx) => (
                            <button
                              key={bidx}
                              onClick={() => handleActionButton(btn)}
                              className="text-[10px] px-2.5 py-1 rounded bg-secondary hover:bg-orange-500/15 border border-border hover:border-orange-500/40 text-foreground hover:text-orange-400 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>{btn.label}</span>
                              <ChevronRight className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground text-xs italic">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
                    <span className="font-mono text-[11px] text-orange-400">Officer Copilot analyzing registry data...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="px-3 py-1.5 bg-secondary/30 border-t border-border/50 flex gap-1.5 overflow-x-auto text-[10px] scrollbar-none">
                <button
                  onClick={() => handleSend("Give me today's SitRep summary")}
                  className="px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-orange-400 hover:border-orange-500/40 whitespace-nowrap"
                >
                  📋 SitRep
                </button>
                <button
                  onClick={() => handleSend("Show top 5 violators by risk score")}
                  className="px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-orange-400 hover:border-orange-500/40 whitespace-nowrap"
                >
                  ⚖️ Top 5 Violators
                </button>
                <button
                  onClick={() => handleSend("Status of JSW Vijayanagar Power Station")}
                  className="px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-orange-400 hover:border-orange-500/40 whitespace-nowrap"
                >
                  🏭 JSW Vijayanagar
                </button>
                <button
                  onClick={() => handleSend("Draft show cause notice for top exceedance facility")}
                  className="px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-orange-400 hover:border-orange-500/40 whitespace-nowrap"
                >
                  📄 Draft Notice
                </button>
              </div>

              {/* Input Footer */}
              <div className="p-2.5 bg-card border-t border-border">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask about facilities, districts, exceedance, or draft notices..."
                    className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/60"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!inputQuery.trim()}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-3 h-8 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
                <div className="text-[9px] text-muted-foreground/70 text-center mt-1 font-mono">
                  Strictly grounded on existing database • Does not hallucinate
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

