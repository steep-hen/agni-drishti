import React, { useState } from 'react';
import { 
  Flame, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { AnalystUser, ScreenTab } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AuthScreenProps {
  currentAnalyst: AnalystUser;
  onLoginSuccess: (analyst: AnalystUser) => void;
  onNavigateToConsole: (tab?: ScreenTab) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentAnalyst,
  onLoginSuccess,
  onNavigateToConsole,
}) => {
  const [email, setEmail] = useState('r.vance@geoint.gov.in');
  const [password, setPassword] = useState('SecretToken2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage('Authenticating token with secure gateway...');

    setTimeout(() => {
      setIsLoading(false);
      setStatusMessage('Authenticated. Loading session...');
      
      const updatedAnalyst: AnalystUser = {
        ...currentAnalyst,
        email,
        isAuthenticated: true,
      };

      onLoginSuccess(updatedAnalyst);

      setTimeout(() => {
        onNavigateToConsole('review');
      }, 350);
    }, 600);
  };

  const handleQuickFill = (analystEmail: string) => {
    setEmail(analystEmail);
    setPassword('SecretToken2026!');
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full flex items-center justify-center bg-background px-4 py-12">
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Bar Quick Link */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <Badge variant="outline" className="text-xs text-muted-foreground border-border/80">
          <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          Secure Gateway Active
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateToConsole('review')}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <span>Return to Console</span>
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
        </Button>
      </div>

      {/* Modular Auth Card */}
      <Card className="relative z-10 w-full max-w-[420px] p-8 bg-card border-border shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-sm">
            <Flame className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Agni-Drishti
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Geospatial Fire &amp; Industrial Anomaly Risk Platform
            </p>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              Operator Email
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@agency.gov.in"
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-foreground">
                Security Password / Token
              </label>
              <button
                type="button"
                onClick={() => alert("Please contact system administrator.")}
                className="text-xs text-primary hover:underline"
              >
                Forgot?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span>{statusMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full text-xs font-semibold"
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Console'}
          </Button>
        </form>

        {/* Demo Fast-Select Personnel Badges */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>Demo Operator Profiles</span>
            <span className="text-emerald-400 font-mono text-[10px]">1-Click</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('r.vance@geoint.gov.in')}
              className="p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-left transition-colors"
            >
              <div className="font-medium text-foreground text-xs">Capt. Vance</div>
              <div className="text-[10px] text-muted-foreground">Lead Analyst</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('p.sharma@geoint.gov.in')}
              className="p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-left transition-colors"
            >
              <div className="font-medium text-foreground text-xs">Dr. Sharma</div>
              <div className="text-[10px] text-muted-foreground">IR Specialist</div>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
