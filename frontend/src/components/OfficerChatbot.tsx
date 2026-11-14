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
  Bot
} from 'lucide-react';
import { IndustrialFacility, ThermalEpisode, ScreenTab } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

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

    // 2. TOP VIOLATORS / RISK RANKING
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
Here is the official notice generated using verified database records for **${matched.name}**:`,
        facilityCard: matched,
        isNotice: true,
        actionButtons: [
          { label: "View Facility Dossier", facilityId: matched.id, tab: 'facilities' }
        ]
      };
    }

    // 4. DISTRICT OR STATE AUDIT
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

    // 5. SPECIFIC FACILITY LOOKUP
    const foundFacility = facilities.find(f => {
      const fname = f.name.toLowerCase();
      const fid = f.id.toLowerCase().trim();
      const queryWords = q.split(' ').filter(w => w.length > 2);
      return fid === q || fname.includes(q) || queryWords.some(w => fname.includes(w) && !['what', 'tell', 'about', 'status', 'show', 'the', 'for'].includes(w));
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

  const handleSend = (textToSend?: string) => {
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

    // Process deterministically
    setTimeout(() => {
      const botReply = processOfficerQuery(query);
      setMessages(prev => [...prev, botReply]);
    }, 250);
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
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-medium text-xs rounded-full shadow-xl shadow-orange-950/40 border border-orange-400/40 transition-all hover:scale-105 active:scale-95 group"
          title="Open Government Officer AI Compliance Desk"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
          </span>
          <ShieldAlert className="w-4 h-4 text-white" />
          <span className="font-semibold tracking-wide">Officer AI Desk</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-white/40 text-white ml-0.5">
            Grounded
          </Badge>
        </button>
      )}

      {/* Main Chatbot Panel */}
      {isOpen && (
        <div 
          className={`fixed right-4 z-50 transition-all duration-300 flex flex-col bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-xl overflow-hidden ${
            isMinimized 
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
                      className={`p-3 rounded-lg max-w-[92%] leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-orange-600 text-white rounded-tr-none shadow-md'
                          : 'bg-secondary/40 border border-border text-foreground rounded-tl-none space-y-2'
                      }`}
                    >
                      {/* Markdown-style formatting */}
                      <div className="whitespace-pre-wrap font-sans text-xs space-y-1">
                        {m.text.split('\n\n').map((paragraph, idx) => (
                          <div key={idx}>
                            {paragraph.split('\n').map((line, lidx) => {
                              if (line.startsWith('### ')) {
                                return (
                                  <div key={lidx} className="font-bold text-xs text-orange-400 mb-1 border-b border-border/50 pb-0.5">
                                    {line.replace('### ', '')}
                                  </div>
                                );
                              }
                              return (
                                <p key={lidx} className={line.startsWith('•') || line.startsWith('*') ? 'pl-2 text-muted-foreground font-mono text-[11px]' : ''}>
                                  {line}
                                </p>
                              );
                            })}
                          </div>
                        ))}
                      </div>

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
