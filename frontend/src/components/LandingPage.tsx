import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Users, Video, Mic, ArrowRight, Clock, 
  FileText, BarChart3, Globe2, ShieldCheck, ChevronRight, Play 
} from 'lucide-react';
import { api } from '../services/api';
import { MeetingDetail } from '../types';

interface LandingPageProps {
  onCreateMeeting: (title: string, hostName: string) => Promise<void>;
  onJoinMeeting: (code: string, displayName: string) => Promise<void>;
  onOpenResults: (code: string) => void;
  onOpenVoiceEnrollment: () => void;
  defaultHostName?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onCreateMeeting,
  onJoinMeeting,
  onOpenResults,
  onOpenVoiceEnrollment,
  defaultHostName,
}) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [hostName, setHostName] = useState(defaultHostName || 'Host');
  const [joinCode, setJoinCode] = useState('');
  const [listenerName, setListenerName] = useState(defaultHostName || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [recentMeetings, setRecentMeetings] = useState<MeetingDetail[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRecentMeetings();
  }, []);

  const loadRecentMeetings = async () => {
    try {
      const meetings = await api.getMeeting('list').catch(() => []);
      // Fetch meeting list directly
      const res = await fetch('http://localhost:8000/api/meetings');
      if (res.ok) {
        const list = await res.json();
        setRecentMeetings(list);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsCreating(true);
    try {
      await onCreateMeeting(meetingTitle.trim() || 'Sprint Planning Meeting', hostName.trim() || 'Host');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!joinCode.trim()) {
      setErrorMsg('Please enter a meeting code');
      return;
    }
    setIsJoining(true);
    try {
      await onJoinMeeting(joinCode.trim(), listenerName.trim() || 'Listener');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not join meeting. Verify meeting code.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold tracking-wide">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next-Gen Meeting Intelligence & Diarization</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Laptop Mic to Real-time Transcript &{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-cyan-300 to-sky-400">
            Automated MoM
          </span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          Record speaker-aware meetings directly using your laptop microphone with faster-whisper, 
          SpeechBrain voice recognition, NLP classification, and automated traceable Minutes of Meeting in English and Hindi.
        </p>
      </div>

      {errorMsg && (
        <div className="max-w-md mx-auto p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
          {errorMsg}
        </div>
      )}

      {/* Main Action Cards: Host & Listener */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Card 1: Speaker / Host */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl hover:border-teal-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all" />
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Mic className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                Host / Speaker
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Create New Meeting</h3>
              <p className="text-xs text-slate-400">
                Start recording with laptop mic. Generates unique 6-digit code for attendees.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Architecture Sync & Planning"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name (Host)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Charu"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
              >
                <span>{isCreating ? 'Creating Room...' : 'Create & Start Room'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Listener */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl hover:border-cyan-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                Listener (Read-Only)
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Join with Code</h3>
              <p className="text-xs text-slate-400">
                Enter 6-digit meeting code to stream the live synchronized transcript.
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. MOM-4829"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul, Priya"
                  value={listenerName}
                  onChange={(e) => setListenerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                <span>{isJoining ? 'Joining Meeting...' : 'Join Meeting Stream'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto pt-6">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
          <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Mic className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Laptop Mic Direct Recording</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Record seamlessly using laptop microphone without physical conference hardware.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Globe2 className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Verbatim Multilingual STT</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Preserves spoken Hinglish verbatim, plus clean English and Hindi post-meeting translations.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
          <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">NLP & Data Mining</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            DBSCAN clustering, segment classification, NER entity extraction, and outlier detection.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Traceable MoM Generation</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Action items and decisions linked back to exact timestamped transcript segments.
          </p>
        </div>
      </div>

      {/* Recent Meetings List */}
      {recentMeetings.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-400" />
              <span>Recent Meetings</span>
            </h3>
            <span className="text-xs text-slate-500">{recentMeetings.length} recorded</span>
          </div>

          <div className="grid gap-3">
            {recentMeetings.slice(0, 5).map((m) => (
              <div
                key={m.id}
                onClick={() => onOpenResults(m.code)}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 cursor-pointer transition-all hover:bg-slate-900 group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-mono font-bold text-xs">
                    {m.code.slice(-4)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                      {m.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-mono text-teal-400/80">{m.code}</span>
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                        m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                        m.status === 'RECORDING' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {m.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-teal-300 transition-colors">
                  <span>View MoM & Analytics</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
