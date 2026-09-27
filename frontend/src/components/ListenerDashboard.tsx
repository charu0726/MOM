import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Users, MicOff, Lock, Sparkles, UserCheck, 
  Clock, ArrowRight, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { MeetingDetail, TranscriptSegment, Participant } from '../types';

interface ListenerDashboardProps {
  meeting: MeetingDetail;
  listenerName: string;
  onViewMoM: () => void;
}

export const ListenerDashboard: React.FC<ListenerDashboardProps> = ({
  meeting,
  listenerName,
  onViewMoM,
}) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>(meeting.transcript_segments || []);
  const [participants, setParticipants] = useState<Participant[]>(meeting.participants || []);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [meetingStatus, setMeetingStatus] = useState<string>(meeting.status || 'RECORDING');
  const [autoScroll, setAutoScroll] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wsUrl = `ws://localhost:8000/ws/meeting/${meeting.code}/live?name=${encodeURIComponent(listenerName)}&role=LISTENER`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transcript_segment') {
          setSegments((prev) => [...prev, msg.segment]);
        } else if (msg.type === 'active_speaker') {
          setActiveSpeaker(msg.speaker_name);
          setTimeout(() => setActiveSpeaker(null), 3000);
        } else if (msg.type === 'participant_joined' || msg.type === 'participant_left') {
          if (msg.participants) {
            setParticipants(msg.participants.map((p: any, idx: number) => ({
              id: idx,
              meeting_id: meeting.id,
              display_name: p.name,
              role: p.role,
              is_active: true,
              joined_at: new Date().toISOString()
            })));
          }
        } else if (msg.type === 'speaker_renamed') {
          setSegments((prev) =>
            prev.map((s) => (s.speaker_name === msg.old_name ? { ...s, speaker_name: msg.new_name } : s))
          );
        } else if (msg.type === 'meeting_status') {
          setMeetingStatus(msg.status);
        } else if (msg.type === 'mom_ready') {
          setMeetingStatus('COMPLETED');
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [meeting.code]);

  useEffect(() => {
    if (autoScroll) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [segments, autoScroll]);

  const getSegmentTypeColor = (type: string) => {
    switch (type) {
      case 'Action Item':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'Decision':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'Question':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'Problem':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'Suggestion':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white">{meeting.title}</h2>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-500/40 text-cyan-300">
              Code: {meeting.code}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Joined as Listener: <strong className="text-slate-200">{listenerName}</strong> • Live synchronized stream
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Read-Only Microphone Badge */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-400 flex items-center gap-2">
            <MicOff className="h-3.5 w-3.5 text-slate-500" />
            <span>Listener Mic: Disabled (Read-Only)</span>
          </div>

          {meetingStatus === 'COMPLETED' ? (
            <button
              onClick={onViewMoM}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all animate-bounce"
            >
              <span>Meeting Ended • View Final MoM</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Meeting in Progress</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Transcript */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Live Streamed Transcript</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    autoScroll
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
                </button>
                <span className="text-[11px] text-slate-400">
                  {segments.length} utterances
                </span>
              </div>
            </div>

            {/* Transcript Stream */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2">
              {segments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                  <Radio className="h-8 w-8 text-slate-600 animate-pulse" />
                  <p>Connected to live room. Waiting for speaker speech stream...</p>
                </div>
              ) : (
                segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold text-[11px]">
                          <UserCheck className="h-3 w-3" />
                          <span>{seg.speaker_name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {seg.start_time.toFixed(1)}s - {seg.end_time.toFixed(1)}s
                        </span>
                      </div>

                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getSegmentTypeColor(seg.segment_type)}`}>
                        {seg.segment_type}
                      </span>
                    </div>

                    <p className="text-sm text-slate-100 leading-relaxed font-normal">
                      {seg.original_text}
                    </p>

                    {seg.english_text && seg.english_text !== seg.original_text && (
                      <div className="text-[11px] text-teal-400/80 pt-1 font-medium">
                        EN: {seg.english_text}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={scrollAnchorRef} />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Attendees & Info */}
        <div className="space-y-4">
          {/* Active Speaker Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Speaker</h3>
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/20 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                activeSpeaker ? 'bg-cyan-400 text-slate-950 animate-bounce' : 'bg-slate-800 text-slate-400'
              }`}>
                {activeSpeaker ? activeSpeaker.charAt(0).toUpperCase() : <Users className="h-5 w-5" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {activeSpeaker || 'Listening to room...'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {activeSpeaker ? 'Speaking now' : 'Synchronized via WebSocket'}
                </p>
              </div>
            </div>
          </div>

          {/* Attendees List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <span>Participants ({participants.length || 1})</span>
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">Live</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {participants.map((p, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <span className="text-white font-medium">{p.display_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    p.role === 'HOST'
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
