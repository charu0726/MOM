import React from 'react';
import { Mic, Users, Sparkles, AudioWaveform, ShieldCheck, User, LogOut } from 'lucide-react';
import { User as UserType } from '../types';

interface NavbarProps {
  onOpenVoiceEnrollment: () => void;
  onGoHome: () => void;
  activeMeetingCode?: string;
  role?: string;
  currentUser?: UserType | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenVoiceEnrollment,
  onGoHome,
  activeMeetingCode,
  role,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={onGoHome}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
            <AudioWaveform className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">MoM Intelligence</span>
              <span className="text-[10px] uppercase tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full font-semibold">
                AI Diarization
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Live Speaker Diarization • Data Mining • Automated MoM</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {activeMeetingCode && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs text-slate-400">Meeting:</span>
              <span className="text-xs font-mono font-bold text-teal-300">{activeMeetingCode}</span>
              {role && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  role === 'HOST' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {role}
                </span>
              )}
            </div>
          )}

          <button
            onClick={onOpenVoiceEnrollment}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-teal-500/40 text-xs font-medium transition-all shadow-sm"
          >
            <Mic className="h-3.5 w-3.5 text-teal-400" />
            <span>Voice Profiles</span>
          </button>

          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <div className="h-5 w-5 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-200 font-semibold hidden sm:inline">{currentUser.full_name || currentUser.username}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
