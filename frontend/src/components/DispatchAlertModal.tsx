import React from 'react';
import { Radio, CheckCircle2, X } from 'lucide-react';
import { ThermalEpisode } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface DispatchAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: ThermalEpisode | null;
  classification: string;
  confidence: number;
}

export const DispatchAlertModal: React.FC<DispatchAlertModalProps> = ({
  isOpen,
  onClose,
  episode,
  classification,
  confidence,
}) => {
  if (!isOpen || !episode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="max-w-lg w-full p-6 space-y-4 bg-card border-border shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-secondary border border-border flex items-center justify-center text-foreground">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                Emergency Dispatch Service
              </span>
              <span className="text-sm font-semibold text-foreground">
                Notification Broadcast Dispatched
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Telegram Packet Visual */}
        <div className="bg-secondary/30 p-3.5 rounded-md border border-border space-y-3 text-xs">
          <div className="flex justify-between pb-2 border-b border-border text-[10px]">
            <span className="text-muted-foreground font-mono">Disaster Alert Protocol</span>
            <Badge variant="outline" className="text-[10px] h-4">Transmitted</Badge>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-medium text-foreground">Recipients:</div>
            <div className="text-muted-foreground text-xs space-y-0.5">
              <div>• National Disaster Response Force (NDRF) — Crisis Hub</div>
              <div>• State Disaster Management Authority (SDMA) — {episode.districtState}</div>
              <div>• Forest Division Emergency Cell</div>
            </div>
          </div>

          <div className="p-3 rounded-md bg-card border border-border space-y-1">
            <div className="text-foreground font-medium text-xs">{episode.title} ({episode.id})</div>
            <div className="text-muted-foreground font-mono text-[11px]">
              Coordinates: {episode.coordinates.latStr}, {episode.coordinates.lngStr}
            </div>
            <div className="text-foreground font-mono text-[11px] font-medium">
              Radiative Power: {episode.radiantHeatMw} MW
            </div>
            <div className="text-muted-foreground text-[11px]">
              Classification: {classification} ({confidence}% Certainty)
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={onClose}
          className="w-full gap-2 text-xs font-medium"
        >
          <CheckCircle2 className="w-4 h-4" />
          Acknowledge &amp; Return
        </Button>
      </Card>
    </div>
  );
};
