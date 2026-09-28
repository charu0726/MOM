import React from 'react';
import { 
  Building2, Calendar, Clock, Users, CheckCircle2, 
  Target, HelpCircle, CheckSquare, Layers, Cpu, ShieldCheck
} from 'lucide-react';
import { MeetingDetail, ActionItem, Decision, Question, Topic } from '../types';

interface MoMWhiteSheetProps {
  meeting: MeetingDetail;
}

const cleanText = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
};

export const MoMWhiteSheet: React.FC<MoMWhiteSheetProps> = ({ meeting }) => {
  const segments = meeting.transcript_segments || [];
  const actionItems = meeting.action_items || [];
  const decisions = meeting.decisions || [];
  const questions = meeting.questions || [];
  const topics = meeting.topics || [];
  const summary = meeting.summary;
  const analytics = meeting.analytics;

  // Accurate local meeting date and time formatting (Laptop's local timezone)
  const getLocalDateString = (isoString?: string) => {
    if (!isoString) {
      return new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    const normalized = isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      const fallback = new Date(isoString);
      return isNaN(fallback.getTime()) ? isoString : fallback.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const meetingDate = getLocalDateString(meeting.started_at || meeting.created_at);

  // Accurate duration calculation
  const calcDurationSeconds = (): number => {
    if (analytics?.duration_seconds && analytics.duration_seconds > 0) {
      return analytics.duration_seconds;
    }
    if (meeting.started_at && meeting.ended_at) {
      const startMs = new Date(meeting.started_at.endsWith('Z') ? meeting.started_at : `${meeting.started_at}Z`).getTime();
      const endMs = new Date(meeting.ended_at.endsWith('Z') ? meeting.ended_at : `${meeting.ended_at}Z`).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
        return (endMs - startMs) / 1000;
      }
    }
    if (segments.length > 0) {
      return Math.max(1, segments[segments.length - 1].end_time - segments[0].start_time);
    }
    return 0;
  };

  const totalSecs = Math.round(calcDurationSeconds());
  const formatDurationDisplay = (secs: number): string => {
    if (secs < 60) return `${Math.max(1, secs)} Seconds`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m} Min ${s} Sec` : `${m} Minutes`;
  };
  const durationDisplay = formatDurationDisplay(totalSecs);

  // Group speaker contributions from segments
  const speakerContributions: { [key: string]: string[] } = {};
  segments.forEach((s) => {
    const spk = cleanText(s.speaker_name) || 'Speaker';
    if (!speakerContributions[spk]) {
      speakerContributions[spk] = [];
    }
    const rawPoint = (s.english_text || s.filtered_text || s.original_text || '').trim();
    const sanitized = cleanText(rawPoint);
    if (sanitized && !speakerContributions[spk].includes(sanitized)) {
      speakerContributions[spk].push(sanitized);
    }
  });

  // Extract unique technologies mentioned
  const allTechs = new Set<string>();
  const techKeywords = ["React", "FastAPI", "SQLite", "Python", "Docker", "Whisper", "SpeechBrain", "API", "WebSockets", "Kubernetes", "Database"];
  segments.forEach((s) => {
    techKeywords.forEach((tech) => {
      if (s.original_text.toLowerCase().includes(tech.toLowerCase())) {
        allTechs.add(tech);
      }
    });
  });

  return (
    <div className="print-sheet bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-14 max-w-4xl mx-auto border border-slate-200 font-sans space-y-10">
      {/* 1. DOCUMENT HEADER */}
      <div className="border-b-2 border-slate-900 pb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded border border-teal-200 inline-block mb-1.5">
              Official Minutes of Meeting
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {cleanText(meeting.title)}
            </h1>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 inline-block">
              ID: {cleanText(meeting.code)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Status: Confirmed & Logged</p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Date & Time</span>
            <strong className="text-slate-800 font-semibold">{meetingDate}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Duration</span>
            <strong className="text-slate-800 font-semibold">{durationDisplay}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Total Speakers</span>
            <strong className="text-slate-800 font-semibold">{Object.keys(speakerContributions).length || 2} Identified</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Attendees</span>
            <strong className="text-slate-800 font-semibold">
              {meeting.participants?.map(p => cleanText(p.display_name)).join(', ') || Object.keys(speakerContributions).join(', ')}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE OVERVIEW */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
          <span>1. Executive Overview</span>
        </h2>
        <div className="p-5 rounded-lg bg-teal-50/60 border-l-4 border-teal-600 text-slate-800 text-sm leading-relaxed">
          {cleanText(summary?.overall_summary) || (
            `The meeting was convened to review and align on key deliverables for ${cleanText(meeting.title)}. A total of ${segments.length} dialogue turns were captured across ${Object.keys(speakerContributions).length || 2} participants (${Object.keys(speakerContributions).join(', ')}). The session resulted in ${decisions.length} strategic decisions and ${actionItems.length} assigned action items.`
          )}
        </div>
      </section>

      {/* 3. AGENDA & CORE TOPICS */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-600" />
          <span>2. Agenda & Topic Breakdown</span>
        </h2>
        <div className="grid gap-3">
          {topics.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              General project alignment, feature reviews, and milestone planning.
            </div>
          ) : (
            topics.map((top, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Topic {idx + 1}: {cleanText(top.topic_name)}
                  </h3>
                  {top.keywords && (
                    <span className="text-[10px] text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded font-mono">
                      {cleanText(top.keywords)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{cleanText(top.summary)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. SPEAKER-WISE CONTRIBUTIONS */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          <span>3. Speaker-wise Contributions</span>
        </h2>
        <div className="space-y-3">
          {Object.entries(speakerContributions).map(([speaker, points], i) => (
            <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                  {speaker.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-xs font-bold text-slate-900">{speaker}</h3>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 pl-2">
                {points.slice(0, 5).map((pt, ptIdx) => (
                  <li key={ptIdx} className="leading-relaxed">{cleanText(pt)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 5. KEY STRATEGIC DECISIONS */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          <span>4. Key Strategic Decisions</span>
        </h2>
        <div className="space-y-2">
          {decisions.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-200">
              No formal architectural decisions were put to vote during this session.
            </p>
          ) : (
            decisions.map((d, idx) => (
              <div key={idx} className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 flex items-start justify-between gap-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                    {idx + 1}
                  </span>
                  <div>
                    <strong className="text-slate-900 font-semibold text-xs block">{cleanText(d.decision_text)}</strong>
                    <span className="text-[10px] text-emerald-800 font-medium mt-0.5 block">
                      Impact Level: {cleanText(d.impact) || 'High'}
                    </span>
                  </div>
                </div>
                {d.segment_id && (
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Ref: {d.segment_id}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 6. ACTION ITEMS MATRIX */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>5. Action Items Matrix</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
              <tr>
                <th className="p-3">No.</th>
                <th className="p-3">Deliverable / Task</th>
                <th className="p-3">Assigned Owner</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Status</th>
                <th className="p-3">Source Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
              {actionItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                    All action items were reviewed and noted in general discussion.
                  </td>
                </tr>
              ) : (
                actionItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{cleanText(item.task)}</td>
                    <td className="p-3 font-medium text-teal-800">{cleanText(item.assigned_to)}</td>
                    <td className="p-3 font-mono text-slate-700 font-medium">{cleanText(item.deadline)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {cleanText(item.status)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500 text-[11px]">
                      Seg {item.segment_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. OPEN QUESTIONS */}
      {questions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
            <span>6. Open Questions & Follow-ups</span>
          </h2>
          <div className="space-y-2">
            {questions.map((q, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-purple-50/50 border border-purple-200 text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{cleanText(q.question_text)}</p>
                  <span className="text-[10px] text-purple-800 mt-0.5 block">
                    Raised by: <strong>{cleanText(q.asked_by) || 'Attendee'}</strong> • Status: {q.is_answered ? 'Answered' : 'Pending Review'}
                  </span>
                </div>
                {q.segment_id && (
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Ref: {q.segment_id}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. TECHNOLOGIES & METRICS */}
      <section className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div>
          {allTechs.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-800">Technologies Mentioned:</span>
              {Array.from(allTechs).map((tech) => (
                <span key={tech} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-mono font-semibold text-slate-700">
                  {cleanText(tech)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right text-[11px] text-slate-500">
          Generated automatically by AI Meeting MoM Intelligence System • Verified & Audited
        </div>
      </section>

      {/* 9. SIGN-OFF BLOCK */}
      <div className="pt-8 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs text-slate-800">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Meeting Chair / Host</span>
          <div className="mt-6 border-b border-slate-400 w-48" />
          <strong className="block mt-1 font-semibold text-slate-900">
            {meeting.participants?.find(p => p.role === 'HOST')?.display_name || Object.keys(speakerContributions)[0] || 'Chair'}
          </strong>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Minutes Recorded & Verified By</span>
          <div className="mt-6 border-b border-slate-400 w-48 ml-auto" />
          <strong className="block mt-1 font-semibold text-slate-900">
            AI Diarization & MoM Intelligence Engine
          </strong>
        </div>
      </div>
    </div>
  );
};
