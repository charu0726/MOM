import React, { useState } from 'react';
import { 
  FileText, Download, Copy, Check, BarChart3, Users, 
  Layers, CheckSquare, HelpCircle, Target, Sparkles, 
  Clock, Calendar, Globe, AlertTriangle, ChevronRight, Hash, ArrowLeft, Printer
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { MeetingDetail, SpeakerStat } from '../types';
import { api } from '../services/api';
import { MoMWhiteSheet } from './MoMWhiteSheet';

interface MeetingResultsViewProps {
  meeting: MeetingDetail;
  onBackToHome: () => void;
}

export const MeetingResultsView: React.FC<MeetingResultsViewProps> = ({
  meeting,
  onBackToHome,
}) => {
  const [activeTab, setActiveTab] = useState<
    'mom' | 'original' | 'english' | 'speakers' | 'topics' | 'actions' | 'decisions' | 'datamining' | 'analytics'
  >('mom');
  const [copied, setCopied] = useState(false);

  const segments = meeting.transcript_segments || [];
  const actionItems = meeting.action_items || [];
  const decisions = meeting.decisions || [];
  const questions = meeting.questions || [];
  const topics = meeting.topics || [];
  const analytics = meeting.analytics;
  const momDoc = meeting.mom_document;
  const summary = meeting.summary;

  // Parse speaker stats from analytics
  const speakerStats: SpeakerStat[] = analytics?.speaker_stats_json
    ? JSON.parse(analytics.speaker_stats_json)
    : [];

  // Parse segment types
  const segmentTypes = analytics?.segment_types_json
    ? JSON.parse(analytics.segment_types_json)
    : {};

  const segmentTypeChartData = Object.entries(segmentTypes).map(([name, value]) => ({
    name,
    count: value,
  }));

  // Parse language distribution
  const langDist = analytics?.language_distribution_json
    ? JSON.parse(analytics.language_distribution_json)
    : { English: 60, 'Hindi / Hinglish': 40 };

  const langChartData = Object.entries(langDist).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  const handlePrintPDF = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    if (momDoc?.markdown_content) {
      navigator.clipboard.writeText(momDoc.markdown_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadMarkdown = () => {
    window.open(api.getExportMarkdownUrl(meeting.code), '_blank');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner - Hidden during PDF Print */}
      <div className="no-print bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold mb-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {meeting.title}
              </h1>
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300">
                {meeting.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex flex-wrap items-center gap-4 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                {new Date(meeting.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Duration: ~{Math.round((analytics?.duration_seconds || 120) / 60)} mins
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                {speakerStats.length || 2} Speakers Identified
              </span>
            </p>
          </div>

          {/* Action Buttons: PDF Download, Copy & Export */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/20 transition-all"
            >
              <Printer className="h-4 w-4" />
              <span>Download PDF / Print</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow"
            >
              {copied ? <Check className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied MoM!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow"
            >
              <Download className="h-4 w-4" />
              <span>Export .MD</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 pb-1 gap-1 text-xs font-semibold scrollbar-thin">
          {[
            { id: 'mom', label: 'Minutes of Meeting (White Sheet)', icon: FileText },
            { id: 'original', label: 'Original Transcript', icon: Globe },
            { id: 'english', label: 'English Version', icon: Globe },
            { id: 'speakers', label: 'Speaker Diarization', icon: Users },
            { id: 'topics', label: 'Topic Clusters', icon: Layers },
            { id: 'actions', label: `Action Items (${actionItems.length})`, icon: CheckSquare },
            { id: 'decisions', label: `Decisions & Questions`, icon: Target },
            { id: 'datamining', label: 'Data Mining & NLP', icon: Sparkles },
            { id: 'analytics', label: 'Visual Analytics', icon: BarChart3 },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 1. MoM WHITE SHEET DOCUMENT TAB */}
      {activeTab === 'mom' && (
        <div className="space-y-4">
          <div className="no-print flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-400" />
              <span>Viewing formatted corporate White Sheet document. Click <strong>Download PDF / Print</strong> to save as a professional PDF.</span>
            </span>
            <button
              onClick={handlePrintPDF}
              className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
            >
              Print / Save PDF
            </button>
          </div>

          <MoMWhiteSheet meeting={meeting} />
        </div>
      )}

      {/* 2. ORIGINAL TRANSCRIPT TAB (Verbatim untouched) */}
      {activeTab === 'original' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Verbatim Spoken Transcript</h3>
              <p className="text-xs text-slate-400">Original multilingual speech preserved exactly as spoken (Hinglish/English/Hindi)</p>
            </div>
            <span className="text-xs text-teal-400 font-mono font-bold bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30">
              {segments.length} Utterances
            </span>
          </div>

          <div className="space-y-3">
            {segments.map((s, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-teal-300">
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30">
                      {s.speaker_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatTime(s.start_time)} - {formatTime(s.end_time)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Segment #{s.id}
                  </span>
                </div>
                <p className="text-sm text-slate-100 font-medium">{s.original_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ENGLISH VERSION TAB */}
      {activeTab === 'english' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Proper English Transcript Version</h3>
              <p className="text-xs text-slate-400">Normalized and translated to clear, professional English</p>
            </div>
          </div>

          <div className="space-y-3">
            {segments.map((s, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                    {s.speaker_name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{s.english_text || s.original_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SPEAKER DIARIZATION TAB */}
      {activeTab === 'speakers' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Speaker Diarization & Speaking Metrics</h3>
            <p className="text-xs text-slate-400">Calculated from timestamped segments with ECAPA-TDNN embeddings</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Speaking Time Bar Chart */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Speaking Duration (Seconds)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speakerStats}>
                    <XAxis dataKey="name" stroke="#64748b" textAnchor="middle" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                    <Bar dataKey="duration_seconds" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Speaking Percentage Pie */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Speaking Share (%)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={speakerStats}
                      dataKey="percentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.name || 'Speaker'} (${entry.percentage ?? Math.round((entry.percent || 0) * 100)}%)`}
                    >
                      {speakerStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Speaker Contributions Table */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Speaker</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Speaking %</th>
                  <th className="p-4">Words Spoken</th>
                  <th className="p-4">Utterances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {speakerStats.map((spk, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="p-4 font-semibold text-teal-300">{spk.name}</td>
                    <td className="p-4 font-mono">{spk.duration_seconds}s</td>
                    <td className="p-4 font-mono">{spk.percentage}%</td>
                    <td className="p-4 font-mono">{spk.words}</td>
                    <td className="p-4 font-mono">{spk.turn_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TOPICS & CLUSTERING TAB */}
      {activeTab === 'topics' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Agglomerative / TF-IDF Topic Clusters</h3>
            <p className="text-xs text-slate-400">Extracted using Sentence Transformers, TF-IDF vectorization, and hierarchical clustering</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {topics.map((top, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-teal-300">{top.topic_name}</h4>
                  <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold">
                    Cluster {idx + 1}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{top.summary}</p>
                <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                  <strong className="text-slate-300">Keywords:</strong> {top.keywords}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. ACTION ITEMS TAB (Traceable) */}
      {activeTab === 'actions' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-teal-400" />
                <span>Action Items Matrix</span>
              </h3>
              <p className="text-xs text-slate-400">Each action item is traceable to its source transcript segment</p>
            </div>
            <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30">
              {actionItems.length} Tasks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">Task Description</th>
                  <th className="p-4">Assigned To</th>
                  <th className="p-4">Deadline</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Traceable Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {actionItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No formal action items detected in transcript.
                    </td>
                  </tr>
                ) : (
                  actionItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/60 transition-colors">
                      <td className="p-4 font-medium text-white">{item.task}</td>
                      <td className="p-4 font-semibold text-teal-300">{item.assigned_to}</td>
                      <td className="p-4 font-mono text-amber-300">{item.deadline}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px]">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-slate-800 font-mono text-teal-400 text-[11px] border border-slate-700">
                          #{item.segment_id}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. DECISIONS & QUESTIONS TAB */}
      {activeTab === 'decisions' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Decisions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-400" />
              <span>Finalized Decisions ({decisions.length})</span>
            </h3>
            <div className="space-y-3">
              {decisions.length === 0 ? (
                <p className="text-xs text-slate-500">No decisions recorded.</p>
              ) : (
                decisions.map((d, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-950 border border-emerald-500/20 space-y-1.5">
                    <p className="text-xs text-slate-100 font-medium">{d.decision_text}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span className="text-emerald-400 font-semibold">Impact: {d.impact || 'Medium'}</span>
                      <span className="font-mono text-slate-500">Traceable: Segment #{d.segment_id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-cyan-400" />
              <span>Open & Raised Questions ({questions.length})</span>
            </h3>
            <div className="space-y-3">
              {questions.length === 0 ? (
                <p className="text-xs text-slate-500">No open questions logged.</p>
              ) : (
                questions.map((q, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-950 border border-cyan-500/20 space-y-1.5">
                    <p className="text-xs text-slate-100 font-medium">{q.question_text}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Asked by: <strong className="text-cyan-300">{q.asked_by || 'Unknown'}</strong></span>
                      <span className="font-mono text-slate-500">Traceable: Segment #{q.segment_id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. DATA MINING & NLP INSIGHTS */}
      {activeTab === 'datamining' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Data Mining, NER & Outlier Filtering</h3>
            <p className="text-xs text-slate-400">Detailed inspection of analytical filtering, entity extraction, and anomaly detection</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Outlier & Anomaly Detection (IsolationForest)</h4>
            <div className="space-y-2">
              {segments.filter(s => s.is_outlier).length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                  No acoustic outliers or noisy segments detected. Audio quality confidence was nominal.
                </div>
              ) : (
                segments.filter(s => s.is_outlier).map((s, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs">
                    <span className="text-rose-200">{s.original_text}</span>
                    <span className="text-rose-300 text-[11px] font-mono">{s.outlier_reason || 'Low confidence'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. VISUAL ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Duration</span>
              <h4 className="text-2xl font-black text-teal-400">{Math.round((analytics?.duration_seconds || 120) / 60)} min</h4>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Words Spoken</span>
              <h4 className="text-2xl font-black text-cyan-400">{analytics?.words_spoken || segments.reduce((acc, s) => acc + s.original_text.split(' ').length, 0)}</h4>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Action Items</span>
              <h4 className="text-2xl font-black text-amber-400">{actionItems.length}</h4>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Decisions</span>
              <h4 className="text-2xl font-black text-emerald-400">{decisions.length}</h4>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Segment Type Distribution */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Segment Classification Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentTypeChartData}>
                    <XAxis dataKey="name" stroke="#64748b" textAnchor="middle" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                    <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Language Distribution */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Spoken Language Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={langChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.name || 'Language'} (${entry.value}%)`}
                    >
                      <Cell fill="#14b8a6" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
