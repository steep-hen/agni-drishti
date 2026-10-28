import React, { useState, useEffect } from 'react';
import { Search, Flame, Building2, ChevronRight, X } from 'lucide-react';
import { ThermalEpisode, IndustrialFacility, ScreenTab } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  episodes: ThermalEpisode[];
  facilities: IndustrialFacility[];
  onSelectEpisode: (id: string) => void;
  onSelectFacility: (id: string) => void;
  setActiveTab: (tab: ScreenTab) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  episodes,
  facilities,
  onSelectEpisode,
  onSelectFacility,
  setActiveTab,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchedEpisodes = episodes.filter(
    (e) =>
      e.id.toLowerCase().includes(query.toLowerCase()) ||
      e.title.toLowerCase().includes(query.toLowerCase()) ||
      e.districtState.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  const matchedFacilities = facilities.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.id.toLowerCase().includes(query.toLowerCase()) ||
      f.district.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-background/80 backdrop-blur-sm">
      <Card className="max-w-xl w-full shadow-2xl overflow-hidden bg-card border-border animate-in fade-in zoom-in-95">
        <div className="p-3.5 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anomalies, coordinates, facilities, or states..."
            className="w-full bg-transparent text-foreground text-xs placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Quick Shortcuts */}
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1.5 font-medium">
              Navigation Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setActiveTab('review'); onClose(); }}
                className="p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary border border-border text-left flex items-center justify-between transition-colors"
              >
                <span className="text-foreground font-medium flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-foreground" />
                  Review Queue
                </span>
                <Badge variant="secondary" className="text-[10px]">Queue</Badge>
              </button>
              <button
                onClick={() => { setActiveTab('facilities'); onClose(); }}
                className="p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary border border-border text-left flex items-center justify-between transition-colors"
              >
                <span className="text-foreground font-medium flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-foreground" />
                  Facility Cadastre
                </span>
                <Badge variant="secondary" className="text-[10px]">208 Sites</Badge>
              </button>
            </div>
          </div>

          {/* Thermal Episodes Matches */}
          {matchedEpisodes.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1.5 font-medium">
                Thermal Anomalies
              </div>
              <div className="space-y-1">
                {matchedEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => {
                      onSelectEpisode(ep.id);
                      onClose();
                    }}
                    className="p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-3.5 h-3.5 text-foreground shrink-0" />
                      <div>
                        <div className="text-foreground font-medium text-xs">{ep.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{ep.id} • {ep.districtState} • {ep.radiantHeatMw} MW</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facility Matches */}
          {matchedFacilities.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1.5 font-medium">
                Industrial Facilities
              </div>
              <div className="space-y-1">
                {matchedFacilities.map((fac) => (
                  <div
                    key={fac.id}
                    onClick={() => {
                      onSelectFacility(fac.id);
                      onClose();
                    }}
                    className="p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-3.5 h-3.5 text-foreground shrink-0" />
                      <div>
                        <div className="text-foreground font-medium text-xs">{fac.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{fac.id} • {fac.district} • Cap {fac.nominalFrpCapMw} MW</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
