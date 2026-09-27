import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, Mic, MicOff, Volume2, Sparkles, 
  Send, Edit3, X, Check, UserCheck, Users, Radio, 
  AlertCircle, MessageSquarePlus, Clock, ArrowRight, UserPlus, Shield
} from 'lucide-react';
import { api } from '../services/api';
import { MeetingDetail, TranscriptSegment, Participant, SpeakerProfile } from '../types';

interface SpeakerDashboardProps {
  meeting: MeetingDetail;
  hostName: string;
  onEndMeeting: () => void;
  onOpenVoiceEnrollment: () => void;
}

export const SpeakerDashboard: React.FC<SpeakerDashboardProps> = ({
  meeting,
  hostName,
  onEndMeeting,
  onOpenVoiceEnrollment,
}) => {
  const [meetingStatus, setMeetingStatus] = useState<string>(meeting.status || 'SCHEDULED');
  const [segments, setSegments] = useState<TranscriptSegment[]>(meeting.transcript_segments || []);
  const [participants, setParticipants] = useState<Participant[]>(meeting.participants || []);
  const [enrolledSpeakers, setEnrolledSpeakers] = useState<SpeakerProfile[]>([]);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string>(hostName || 'Host');
  const [activeDiarizedSpeaker, setActiveDiarizedSpeaker] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [interimText, setInterimText] = useState<string>('');

  // Speaker quick add state
  const [showAddSpeakerInput, setShowAddSpeakerInput] = useState(false);
  const [newSpeakerInput, setNewSpeakerInput] = useState('');

  // Manual utterance injector
  const [simText, setSimText] = useState('');

  // Renaming speaker state
  const [renamingTarget, setRenamingTarget] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  const liveWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const currentSpeakerRef = useRef<string>(hostName || 'Host');

  useEffect(() => {
    currentSpeakerRef.current = activeSpeakerName;
  }, [activeSpeakerName]);

  useEffect(() => {
    loadEnrolledSpeakers();
    setupLiveWebSocket();

    if (meetingStatus === 'RECORDING') {
      startTimer();
      startMicrophone();
    }

    return () => {
      stopTimer();
      stopMicrophone();
      if (liveWsRef.current) liveWsRef.current.close();
    };
  }, [meeting.code]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, interimText]);

  const loadEnrolledSpeakers = async () => {
    try {
      const list = await api.getSpeakers();
      setEnrolledSpeakers(list);
    } catch (e) {}
  };

  const startTimer = () => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const setupLiveWebSocket = () => {
    const wsUrl = `ws://localhost:8000/ws/meeting/${meeting.code}/live?name=${encodeURIComponent(hostName)}&role=HOST`;
    const ws = new WebSocket(wsUrl);
    liveWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transcript_segment') {
          setSegments((prev) => {
            if (prev.some(s => s.id === msg.segment.id)) return prev;
            return [...prev, msg.segment];
          });
        } else if (msg.type === 'active_speaker') {
          setActiveDiarizedSpeaker(msg.speaker_name);
          setTimeout(() => setActiveDiarizedSpeaker(null), 3000);
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
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    };
  };

  // 1. START MEETING HANDLER
  const handleStartMeeting = async () => {
    setIsStarting(true);
    setErrorMsg(null);
    try {
      await api.startMeeting(meeting.code);
      setMeetingStatus('RECORDING');
      isRecordingRef.current = true;
      startTimer();
      await startMicrophone();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start meeting.');
    } finally {
      setIsStarting(false);
    }
  };

  // 2. END MEETING HANDLER
  const handleEndMeeting = async () => {
    if (!confirm('Are you sure you want to end this meeting? This will execute Data Mining analysis and generate the official MoM.')) return;
    setIsEnding(true);
    isRecordingRef.current = false;
    stopMicrophone();
    stopTimer();
    try {
      await api.endMeeting(meeting.code);
      setMeetingStatus('COMPLETED');
      onEndMeeting();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to end meeting.');
      setIsEnding(false);
    }
  };

  // 3. MICROPHONE & SPEECH RECOGNITION PIPELINE
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setIsMicActive(true);

      // Audio Visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          animationFrameRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          if (ctx) {
            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const barHeight = (dataArray[i] / 255) * canvas.height;
              ctx.fillStyle = `rgb(20, ${180 + dataArray[i] / 4}, 160)`;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          }
        };
        draw();
      }

      // Continuous Browser Speech Recognition Engine
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = async (event: any) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) {
              if (transcript.length > 0) {
                setInterimText('');
                // Send finalized utterance with the currently active speaker
                try {
                  const seg = await api.addSegment(meeting.code, transcript, currentSpeakerRef.current);
                  setSegments((prev) => {
                    if (prev.some(s => s.id === seg.id)) return prev;
                    return [...prev, seg];
                  });
                } catch (e) {
                  console.error('Failed to post segment:', e);
                }
              }
            } else {
              currentInterim += transcript + ' ';
            }
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (err) {}
          }
        };

        try {
          recognition.start();
        } catch (e) {}
      }
    } catch (err: any) {
      setErrorMsg('Microphone access denied. Please allow microphone permissions in your browser.');
      setIsMicActive(false);
    }
  };

  const stopMicrophone = () => {
    setIsMicActive(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const toggleMic = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  // Quick Speaker Add
  const handleAddNewSpeaker = () => {
    if (!newSpeakerInput.trim()) return;
    const name = newSpeakerInput.trim();
    setActiveSpeakerName(name);
    setNewSpeakerInput('');
    setShowAddSpeakerInput(false);
  };

  // Utterance Injector Handler
  const handleManualUtterance = async (e?: React.FormEvent, customText?: string, customSpeaker?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || simText;
    const speakerToSend = customSpeaker || activeSpeakerName;
    if (!textToSend.trim()) return;

    try {
      const seg = await api.addSegment(meeting.code, textToSend.trim(), speakerToSend.trim());
      setSegments((prev) => {
        if (prev.some(s => s.id === seg.id)) return prev;
        return [...prev, seg];
      });
      if (!customText) setSimText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add speech segment');
    }
  };

  const handleRenameSpeaker = async (oldName: string) => {
    if (!newSpeakerName.trim()) return;
    try {
      await api.renameSpeaker(meeting.code, oldName, newSpeakerName.trim());
      setRenamingTarget(null);
      setNewSpeakerName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rename speaker');
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      case 'Important Information':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Compile all unique speaker names available
  const availableSpeakerNames = Array.from(new Set([
    hostName,
    ...enrolledSpeakers.map(s => s.name),
    ...participants.map(p => p.display_name),
    'Charu',
    'Rahul',
    'Priya',
    activeSpeakerName
  ])).filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${
              meetingStatus === 'RECORDING' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'
            }`} />
            <h2 className="text-xl font-bold text-white">{meeting.title}</h2>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-teal-500/40 text-teal-300">
              Code: {meeting.code}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              meetingStatus === 'RECORDING'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              {meetingStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Host: <strong className="text-slate-200">{hostName}</strong> • Share code with attendees to stream live transcript.
          </p>
        </div>

        {/* Action Controls: START MEETING & END MEETING */}
        <div className="flex items-center gap-3">
          {/* Duration Counter */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-teal-400" />
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          {meetingStatus === 'SCHEDULED' ? (
            <button
              onClick={handleStartMeeting}
              disabled={isStarting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 animate-pulse"
            >
              <Play className="h-4 w-4 fill-slate-950" />
              <span>{isStarting ? 'Starting...' : 'Start Meeting & Microphone'}</span>
            </button>
          ) : (
            <>
              {/* Mic Toggle Button */}
              <button
                onClick={toggleMic}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md ${
                  isMicActive
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isMicActive ? <Mic className="h-4 w-4 text-teal-400" /> : <MicOff className="h-4 w-4 text-slate-500" />}
                <span>{isMicActive ? 'Mic Active' : 'Mic Muted'}</span>
              </button>

              {/* END MEETING BUTTON */}
              <button
                onClick={handleEndMeeting}
                disabled={isEnding}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-white" />
                <span>{isEnding ? 'Generating MoM...' : 'End Meeting & Generate MoM'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* QUICK SPEAKER SELECTION & SWITCHER BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <UserCheck className="h-4 w-4 text-teal-400" />
            <span>Who is Speaking Now? (Active Speaker Tag):</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Current Speaker: <strong className="text-teal-300 underline">{activeSpeakerName}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {availableSpeakerNames.map((spk) => {
            const isSelected = activeSpeakerName === spk;
            return (
              <button
                key={spk}
                onClick={() => setActiveSpeakerName(spk)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 scale-105 font-bold'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-teal-500/40 hover:text-white'
                }`}
              >
                <span>👤</span>
                <span>{spk}</span>
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />}
              </button>
            );
          })}

          {showAddSpeakerInput ? (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl p-1">
              <input
                type="text"
                placeholder="Speaker Name"
                value={newSpeakerInput}
                onChange={(e) => setNewSpeakerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewSpeaker()}
                className="px-2 py-0.5 text-xs bg-transparent text-white focus:outline-none w-28"
                autoFocus
              />
              <button
                onClick={handleAddNewSpeaker}
                className="p-1 text-teal-400 hover:text-teal-300"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowAddSpeakerInput(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSpeakerInput(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-400 hover:text-teal-300 hover:border-teal-500/30 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Speaker</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Live Transcripts + Sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Speaker-Labelled Transcript Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${meetingStatus === 'RECORDING' ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                <h3 className="text-sm font-bold text-white">Live Speaker-Aware Transcript</h3>
              </div>
              <div className="flex items-center gap-2">
                {isMicActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                    MIC LISTENING ({activeSpeakerName})
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  {segments.length} segments
                </span>
              </div>
            </div>

            {/* Transcript Scroll Area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2">
              {segments.length === 0 && !interimText ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-4 text-center p-6">
                  <Volume2 className="h-10 w-10 text-slate-600 animate-bounce" />
                  {meetingStatus === 'SCHEDULED' ? (
                    <div className="space-y-3">
                      <p className="text-slate-300 font-semibold text-sm">Meeting is Ready to Begin</p>
                      <p className="text-slate-400 max-w-sm">
                        Click <strong className="text-teal-400">&quot;Start Meeting & Microphone&quot;</strong> to activate recording.
                      </p>
                      <button
                        onClick={handleStartMeeting}
                        className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20"
                      >
                        Start Meeting Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-teal-300 font-semibold text-sm">Microphone is Active for {activeSpeakerName}!</p>
                      <p className="text-slate-400 max-w-sm">
                        Speak into your laptop mic or click the dialogue injector buttons below.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {segments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition-all space-y-2 group animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-300 font-semibold text-[11px]">
                            <UserCheck className="h-3 w-3" />
                            <span>{seg.speaker_name}</span>
                          </div>

                          <button
                            onClick={() => {
                              setRenamingTarget(seg.speaker_name);
                              setNewSpeakerName(seg.speaker_name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-teal-400 transition-opacity"
                            title="Rename this speaker across transcript"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>

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

                      <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                        <span>Confidence: {Math.round((seg.confidence || 0.9) * 100)}%</span>
                        {seg.english_text && seg.english_text !== seg.original_text && (
                          <span className="text-teal-400/70 truncate max-w-xs">
                            EN: {seg.english_text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Live Interim Speech Bubble */}
                  {interimText && (
                    <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-500/30 border-dashed space-y-1 animate-pulse">
                      <div className="flex items-center gap-2 text-xs text-teal-400 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                        <span>{activeSpeakerName} (Speaking...)</span>
                      </div>
                      <p className="text-sm text-teal-200 italic">{interimText}</p>
                    </div>
                  )}
                </>
              )}
              <div ref={scrollAnchorRef} />
            </div>

            {/* Waveform mini visualizer */}
            {isMicActive && (
              <div className="h-10 w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800 p-1">
                <canvas ref={canvasRef} width={600} height={40} className="w-full h-full" />
              </div>
            )}
          </div>

          {/* Quick Speech Dialogue Injectors */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Multi-Speaker Quick Dialogue Injector</span>
              <span className="text-[11px] text-slate-500">Inject turns as different speakers to test MoM</span>
            </div>

            {/* 1-Click Multi-Speaker Quotes */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleManualUtterance(undefined, "Project Friday tak complete karna hai. Rahul will take care of API integration.", "Charu")}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 transition-colors"
              >
                <strong>Charu:</strong> &quot;Project Friday tak complete karna hai...&quot;
              </button>
              <button
                onClick={() => handleManualUtterance(undefined, "Sure Charu, I will complete the FastAPI backend and database integration by Friday EOD.", "Rahul")}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-colors"
              >
                <strong>Rahul:</strong> &quot;Sure Charu, I will complete by Friday EOD...&quot;
              </button>
              <button
                onClick={() => handleManualUtterance(undefined, "We finalized the decision to use faster-whisper and SpeechBrain for the audio pipeline.", "Charu")}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition-colors"
              >
                <strong>Charu:</strong> &quot;We finalized the decision...&quot;
              </button>
              <button
                onClick={() => handleManualUtterance(undefined, "Should we also enable Docker deployment for the staging server?", "Rahul")}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 transition-colors"
              >
                <strong>Rahul:</strong> &quot;Should we enable Docker deployment?&quot;
              </button>
            </div>

            {/* Custom Input */}
            <form onSubmit={(e) => handleManualUtterance(e)} className="flex gap-2 pt-1">
              <div className="text-xs text-slate-400 flex items-center px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-semibold">
                👤 {activeSpeakerName}:
              </div>
              <input
                type="text"
                placeholder="Type spoken sentence in English or Hinglish..."
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Turn</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Attendees & Diarization Live Stats */}
        <div className="space-y-4">
          {/* Active Speaker Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Speaker Diarization</h3>
            <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/20 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                activeDiarizedSpeaker ? 'bg-teal-500 text-slate-950 animate-bounce' : 'bg-slate-800 text-slate-400'
              }`}>
                {activeDiarizedSpeaker ? activeDiarizedSpeaker.charAt(0).toUpperCase() : activeSpeakerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {activeDiarizedSpeaker || (isMicActive ? `${activeSpeakerName} (Speaking)` : 'Ready')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {activeDiarizedSpeaker ? 'Identified via ECAPA-TDNN' : 'Active Speaker'}
                </p>
              </div>
            </div>
          </div>

          {/* Attendees List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                <span>Participants ({participants.length || 1})</span>
              </h3>
              <span className="text-[10px] text-teal-400 font-mono">Live Room</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {participants.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-white font-medium">{hostName}</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold">
                    HOST
                  </span>
                </div>
              ) : (
                participants.map((p, i) => (
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
                ))
              )}
            </div>
          </div>

          {/* Voice Enrollment Shortcut */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/40 to-slate-900 border border-teal-500/30 space-y-2">
            <h4 className="text-xs font-bold text-teal-300">Speaker Voice Profiles</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enroll voice profiles to automatically recognize speakers by name.
            </p>
            <button
              onClick={onOpenVoiceEnrollment}
              className="w-full py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors"
            >
              Open Voice Enrollment
            </button>
          </div>
        </div>
      </div>

      {/* Rename Speaker Modal */}
      {renamingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Rename Speaker</h3>
              <button onClick={() => setRenamingTarget(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Rename all segments currently labelled as <strong className="text-teal-300">&quot;{renamingTarget}&quot;</strong>:
            </p>
            <input
              type="text"
              placeholder="e.g. Charu, Rahul, Dr. Smith"
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRenamingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRenameSpeaker(renamingTarget)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow"
              >
                Update Segments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
