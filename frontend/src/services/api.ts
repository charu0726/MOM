import {
  SpeakerProfile,
  VoiceMatchResult,
  MeetingDetail,
  TranscriptSegment,
  MoMDocument,
  MeetingAnalytics
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = {
  // Speakers
  async getSpeakers(): Promise<SpeakerProfile[]> {
    const res = await fetch(`${API_BASE_URL}/speakers`);
    if (!res.ok) throw new Error('Failed to fetch speaker profiles');
    return res.json();
  },

  async registerSpeaker(name: string, audioBlob: Blob): Promise<SpeakerProfile> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('audio_file', audioBlob, 'voice_enrollment.wav');

    const res = await fetch(`${API_BASE_URL}/speakers/register`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Failed to register speaker');
    }
    return res.json();
  },

  async testVoiceMatch(audioBlob: Blob): Promise<VoiceMatchResult> {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'test_sample.wav');

    const res = await fetch(`${API_BASE_URL}/speakers/test-match`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to test voice match');
    return res.json();
  },

  async deleteSpeaker(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/speakers/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete speaker');
  },

  // Meetings
  async createMeeting(title: string, hostName: string): Promise<MeetingDetail> {
    const res = await fetch(`${API_BASE_URL}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, host_name: hostName }),
    });
    if (!res.ok) throw new Error('Failed to create meeting');
    return res.json();
  },

  async joinMeeting(code: string, displayName: string, role: string = 'LISTENER'): Promise<MeetingDetail> {
    const res = await fetch(`${API_BASE_URL}/meetings/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, display_name: displayName, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Meeting not found' }));
      throw new Error(err.detail || 'Failed to join meeting');
    }
    return res.json();
  },

  async getMeeting(code: string): Promise<MeetingDetail> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}`);
    if (!res.ok) throw new Error('Failed to fetch meeting');
    return res.json();
  },

  async startMeeting(code: string): Promise<MeetingDetail> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}/start`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to start meeting');
    return res.json();
  },

  async endMeeting(code: string): Promise<MeetingDetail> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}/end`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to end meeting');
    return res.json();
  },

  async renameSpeaker(code: string, oldSpeakerName: string, newSpeakerName: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}/rename-speaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id: 0,
        old_speaker_name: oldSpeakerName,
        new_speaker_name: newSpeakerName,
      }),
    });
    if (!res.ok) throw new Error('Failed to rename speaker');
  },

  async addSegment(
    code: string,
    originalText?: string,
    speakerName?: string,
    audioBlob?: Blob
  ): Promise<TranscriptSegment> {
    const formData = new FormData();
    if (originalText) formData.append('original_text', originalText);
    if (speakerName) formData.append('speaker_name', speakerName);
    if (audioBlob) formData.append('audio_file', audioBlob, 'segment.wav');

    const res = await fetch(`${API_BASE_URL}/meetings/${code}/segment`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to add segment');
    return res.json();
  },

  // MoM & Analytics
  async getMoM(code: string): Promise<MoMDocument> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}/mom`);
    if (!res.ok) throw new Error('Failed to fetch MoM');
    return res.json();
  },

  async getAnalytics(code: string): Promise<MeetingAnalytics> {
    const res = await fetch(`${API_BASE_URL}/meetings/${code}/analytics`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  getExportMarkdownUrl(code: string): string {
    return `${API_BASE_URL}/meetings/${code}/mom/export/markdown`;
  }
};
