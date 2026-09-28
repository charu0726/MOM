import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Square, CheckCircle2, AlertCircle, Trash2, Volume2, Sparkles, UserCheck, Shield } from 'lucide-react';
import { api } from '../services/api';
import { SpeakerProfile, VoiceMatchResult } from '../types';
import { WavAudioRecorder } from '../utils/wavRecorder';

interface VoiceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileAdded?: () => void;
}

export const VoiceEnrollmentModal: React.FC<VoiceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onProfileAdded,
}) => {
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [speakerName, setSpeakerName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<VoiceMatchResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'test' | 'list'>('register');

  const wavRecorderRef = useRef<WavAudioRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    } else {
      stopRecording();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      const list = await api.getSpeakers();
      setProfiles(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  const startVisualizer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyserRef.current = analyser;
    analyser.fftSize = 256;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgb(20, ${180 + dataArray[i] / 4}, 160)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startRecording = async (forTesting = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTestResult(null);

    if (!forTesting && !speakerName.trim()) {
      setErrorMsg('Please enter a speaker name before recording.');
      return;
    }

    try {
      const recorder = new WavAudioRecorder(30);
      wavRecorderRef.current = recorder;
      const stream = await recorder.start();
      startVisualizer(stream);

      setIsRecording(true);
      setIsTesting(forTesting);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 25) {
            stopRecording();
            return 25;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMsg('Microphone access denied or not available. Please allow microphone permissions.');
      console.error(err);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopVisualizer();
    setIsRecording(false);

    if (wavRecorderRef.current) {
      const wavBlob = wavRecorderRef.current.getWavBlob();
      wavRecorderRef.current.stop();
      wavRecorderRef.current = null;

      if (wavBlob && wavBlob.size > 2000) {
        if (isTesting) {
          await handleTestVoiceSample(wavBlob);
        } else {
          await handleRegisterVoiceSample(wavBlob);
        }
      } else {
        setErrorMsg('Recorded sample was too short. Please record for at least 3-5 seconds.');
      }
    }
  };

  const handleRegisterVoiceSample = async (audioBlob: Blob) => {
    setIsSubmitting(true);
    try {
      const profile = await api.registerSpeaker(speakerName.trim(), audioBlob);
      setSuccessMsg(`Voice profile successfully registered for "${profile.name}"!`);
      setSpeakerName('');
      loadProfiles();
      onProfileAdded?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register speaker voice profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestVoiceSample = async (audioBlob: Blob) => {
    setIsSubmitting(true);
    try {
      const res = await api.testVoiceMatch(audioBlob);
      setTestResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to match voice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete voice profile for "${name}"?`)) return;
    try {
      await api.deleteSpeaker(id);
      loadProfiles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete profile');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Speaker Voice Registration</h2>
              <p className="text-xs text-slate-400">Enroll speaker voices via laptop mic for ECAPA-TDNN speaker recognition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/30">
          <button
            onClick={() => setActiveTab('register')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'register'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Enroll Voice Profile
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'test'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Test Voice Match
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Registered Voices ({profiles.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: REGISTER VOICE */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Speaker Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Charu, Rahul, Priya, Alex"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  disabled={isRecording || isSubmitting}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Waveform Canvas */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2 h-28 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={100}
                  className="w-full h-full rounded-lg"
                />
                {!isRecording && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[1px] text-slate-400 text-xs gap-1">
                    <Volume2 className="h-5 w-5 text-teal-400/80" />
                    <span>Click Record & speak 10-25 seconds to capture a rich voice sample</span>
                  </div>
                )}
              </div>

              {/* Progress Bar for 25s recording */}
              {isRecording && (
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (recordingSeconds / 25) * 100)}%` }}
                  />
                </div>
              )}

              {/* Recording Controls */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  {isRecording ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-rose-400 font-semibold font-mono">
                        Recording voice sample... {recordingSeconds}s / 25s
                      </span>
                    </>
                  ) : (
                    <span>Speak naturally for 10-25s. You can click Stop anytime when finished.</span>
                  )}
                </div>

                {!isRecording ? (
                  <button
                    onClick={() => startRecording(false)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Start Recording (Up to 25s)</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 transition-all"
                  >
                    <Square className="h-4 w-4" />
                    <span>Stop & Enroll Voice</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TEST VOICE MATCH */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Speak a short sentence to verify if the SpeechBrain / Cosine Similarity engine recognizes your enrolled voice profile.
              </p>

              {/* Waveform Canvas */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2 h-28 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={100}
                  className="w-full h-full rounded-lg"
                />
                {!isRecording && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[1px] text-slate-400 text-xs gap-1">
                    <UserCheck className="h-5 w-5 text-teal-400/80" />
                    <span>Click Test Voice to match against database profiles</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 font-mono">
                  {isRecording && `Testing audio: ${recordingSeconds}s...`}
                </div>
                {!isRecording ? (
                  <button
                    onClick={() => startRecording(true)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs shadow-lg shadow-teal-500/20 transition-all"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Record Voice Test</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 transition-all"
                  >
                    <Square className="h-4 w-4" />
                    <span>Evaluate Match</span>
                  </button>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  testResult.matched
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {testResult.matched ? <CheckCircle2 className="h-4 w-4 text-teal-400" /> : <AlertCircle className="h-4 w-4 text-amber-400" />}
                      {testResult.matched ? `Identified as: ${testResult.speaker_name}` : 'Unknown Speaker'}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                      Similarity: {Math.round(testResult.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{testResult.message}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REGISTERED VOICES LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No speaker voices registered yet. Enroll a voice to enable automatic speaker recognition.
                </div>
              ) : (
                profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          Registered {new Date(p.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteProfile(p.id, p.name)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete profile"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
