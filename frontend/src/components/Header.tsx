import React, { useState } from 'react';
import { 
  Flame, 
  Search, 
  Bell, 
  ShieldCheck, 
  Lock, 
  LogOut, 
  User, 
  Activity,
  ChevronDown,
  Map,
  TableProperties,
  Building,
  BarChart3,
  History,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { ScreenTab, AnalystUser } from '../types';
import { useTheme } from '../lib/theme';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface HeaderProps {
  activeTab: ScreenTab;
  setActiveTab: (tab: ScreenTab) => void;
  reviewCount: number;
  analyst: AnalystUser;
  onOpenSearch: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  reviewCount,
  analyst,
  onOpenSearch,
  onOpenLogin,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: 'historical' as ScreenTab, label: 'Historical (2019–2026)', icon: History },
    { id: 'map' as ScreenTab, label: 'Tactical Map', icon: Map },
    { id: 'episodes' as ScreenTab, label: 'Episodes', icon: TableProperties },
    { id: 'facilities' as ScreenTab, label: 'Facilities', icon: Building },
    { id: 'analytics' as ScreenTab, label: 'Analytics', icon: BarChart3 },
    { id: 'review' as ScreenTab, label: 'Review Queue', icon: CheckCircle2, badge: reviewCount },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border px-4 lg:px-6 h-13 flex items-center justify-between gap-4">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-4 shrink-0">
        <div 
          onClick={() => setActiveTab('map')} 
          className="cursor-pointer flex items-center gap-2.5 group"
        >
          <div className="h-7 w-7 rounded-md bg-secondary border border-border flex items-center justify-center text-foreground group-hover:bg-accent transition-colors">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-tight text-foreground">
                Agni-Drishti
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                v2.1
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground leading-none hidden md:block">
              Geospatial Risk &amp; Thermal Engine
            </div>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-border text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-foreground">VIIRS / MODIS</span>
          <span>•</span>
          <span>Southern Sector</span>
        </div>
      </div>

      {/* Modular Navigation Bar */}
      <nav className="hidden lg:flex items-center gap-1 bg-secondary/60 p-1 rounded-md border border-border">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors ${
                isActive
                  ? 'bg-background text-foreground font-medium shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-medium ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground border border-border'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Utility & Profile Controls */}
      <div className="flex items-center gap-2">
        {/* Quick Search Shortcut */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSearch}
          className="h-8 gap-2 px-2.5 text-muted-foreground hover:text-foreground border-border bg-secondary/30 hidden sm:flex"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search anomalies...</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[9px] text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Theme Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-95"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-700" />
          )}
        </Button>

        {/* Notifications Popover */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-foreground" />
          </Button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  System Notifications
                </span>
                <Badge variant="outline" className="text-[10px]">3 New</Badge>
              </div>
              <div className="divide-y divide-border text-xs">
                <div 
                  className="py-2 hover:bg-secondary/50 px-2 rounded-md cursor-pointer transition-colors" 
                  onClick={() => { setActiveTab('review'); setNotifDropdownOpen(false); }}
                >
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="font-medium text-foreground">EP-2026-04821</span>
                    <span className="text-[10px] text-muted-foreground">High Radiance</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-1">Dense Canopy Corridor — Unconfirmed Fire Front</p>
                  <span className="text-[10px] text-muted-foreground font-mono">3h ago • VIIRS SNPP</span>
                </div>
                <div 
                  className="py-2 hover:bg-secondary/50 px-2 rounded-md cursor-pointer transition-colors" 
                  onClick={() => { setActiveTab('facilities'); setNotifDropdownOpen(false); }}
                >
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="font-medium text-foreground">FAC-WRI-0072</span>
                    <span className="text-[10px] text-muted-foreground">Exceedance</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-1">Power Station buffer anomaly: 1419 detections</p>
                  <span className="text-[10px] text-muted-foreground font-mono">34m ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-md border border-border hover:bg-secondary transition-colors"
          >
            <div className="h-6 w-6 rounded-md bg-secondary border border-border flex items-center justify-center text-xs font-medium text-foreground">
              {analyst.name.charAt(0)}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-medium text-foreground leading-none flex items-center gap-1">
                {analyst.name}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {analyst.role}
              </div>
            </div>
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-popover border border-border rounded-lg shadow-xl p-2.5 z-50">
              <div className="pb-2 border-b border-border px-1.5">
                <div className="text-xs font-medium text-foreground">{analyst.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{analyst.email}</div>
                <div className="mt-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Verified Operator
                  </Badge>
                </div>
              </div>
              <div className="pt-1.5 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setActiveTab('auth');
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-foreground flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Operator Profile
                </button>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-foreground flex items-center gap-2 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Switch Session
                </button>
                <button
                  onClick={() => {
                    toggleTheme();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-foreground flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                    <span>Interface Theme</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                    {theme}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setActiveTab('auth');
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-destructive/10 text-destructive-foreground flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
