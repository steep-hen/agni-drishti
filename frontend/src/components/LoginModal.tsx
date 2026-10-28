import React, { useState } from 'react';
import { Flame, Lock, ShieldCheck, Mail, Eye, EyeOff, X } from 'lucide-react';
import { AnalystUser } from '../types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalyst: AnalystUser;
  onLoginSuccess: (analyst: AnalystUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentAnalyst,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('analyst@geoint.gov.in');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        ...currentAnalyst,
        email,
        isAuthenticated: true,
      });
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="max-w-md w-full p-6 sm:p-8 bg-card border-border shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-sm">
            <Flame className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Operator Authentication
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign in to manage thermal verifications and facility cadastre.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              Work Email / Operator ID
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@agency.gov.in"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-medium text-foreground">Password / Token</label>
              <a 
                href="#forgot" 
                onClick={(e) => { e.preventDefault(); alert("Contact security administrator."); }} 
                className="text-primary hover:underline text-[11px]"
              >
                Forgot?
              </a>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Remember session</span>
            </label>

            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Encrypted Session
            </span>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full text-xs font-semibold"
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Console'}
          </Button>
        </form>

        <div className="pt-2 border-t border-border text-[10px] text-muted-foreground text-center leading-relaxed">
          Authorized personnel access only. Actions are logged and auditable.
        </div>
      </Card>
    </div>
  );
};
