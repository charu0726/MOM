import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { SpeakerDashboard } from './components/SpeakerDashboard';
import { ListenerDashboard } from './components/ListenerDashboard';
import { MeetingResultsView } from './components/MeetingResultsView';
import { VoiceEnrollmentModal } from './components/VoiceEnrollmentModal';
import { MeetingDetail } from './types';
import { api } from './services/api';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'speaker_room' | 'listener_room' | 'results'>('landing');
  const [currentMeeting, setCurrentMeeting] = useState<MeetingDetail | null>(null);
  const [userName, setUserName] = useState<string>('Host');
  const [userRole, setUserRole] = useState<'HOST' | 'LISTENER'>('HOST');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Check URL parameters for direct meeting join link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      handleJoinMeeting(code, 'Guest Listener');
    }
  }, []);

  const handleCreateMeeting = async (title: string, hostName: string) => {
    const meeting = await api.createMeeting(title, hostName);
    setCurrentMeeting(meeting);
    setUserName(hostName);
    setUserRole('HOST');
    // Navigate to speaker dashboard in SCHEDULED state so Host can click Start Meeting
    setCurrentView('speaker_room');
  };

  const handleJoinMeeting = async (code: string, displayName: string) => {
    const meeting = await api.joinMeeting(code, displayName, 'LISTENER');
    setCurrentMeeting(meeting);
    setUserName(displayName);
    setUserRole('LISTENER');
    
    if (meeting.status === 'COMPLETED') {
      const fullDetail = await api.getMeeting(meeting.code);
      setCurrentMeeting(fullDetail);
      setCurrentView('results');
    } else {
      setCurrentView('listener_room');
    }
  };

  const handleOpenResults = async (code: string) => {
    try {
      const fullDetail = await api.getMeeting(code);
      setCurrentMeeting(fullDetail);
      setCurrentView('results');
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndMeeting = async () => {
    if (!currentMeeting) return;
    try {
      const updated = await api.getMeeting(currentMeeting.code);
      setCurrentMeeting(updated);
      setCurrentView('results');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white font-sans">
      {/* Global Navigation */}
      <Navbar
        onOpenVoiceEnrollment={() => setIsVoiceModalOpen(true)}
        onGoHome={() => {
          setCurrentView('landing');
          setCurrentMeeting(null);
        }}
        activeMeetingCode={currentMeeting?.code}
        role={userRole}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            onCreateMeeting={handleCreateMeeting}
            onJoinMeeting={handleJoinMeeting}
            onOpenResults={handleOpenResults}
            onOpenVoiceEnrollment={() => setIsVoiceModalOpen(true)}
          />
        )}

        {currentView === 'speaker_room' && currentMeeting && (
          <SpeakerDashboard
            meeting={currentMeeting}
            hostName={userName}
            onEndMeeting={handleEndMeeting}
            onOpenVoiceEnrollment={() => setIsVoiceModalOpen(true)}
          />
        )}

        {currentView === 'listener_room' && currentMeeting && (
          <ListenerDashboard
            meeting={currentMeeting}
            listenerName={userName}
            onViewMoM={() => handleOpenResults(currentMeeting.code)}
          />
        )}

        {currentView === 'results' && currentMeeting && (
          <MeetingResultsView
            meeting={currentMeeting}
            onBackToHome={() => {
              setCurrentView('landing');
              setCurrentMeeting(null);
            }}
          />
        )}
      </main>

      {/* Global Voice Profile Enrollment Modal */}
      <VoiceEnrollmentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  );
}

export default App;
