import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { SpeakerDashboard } from './components/SpeakerDashboard';
import { ListenerDashboard } from './components/ListenerDashboard';
import { MeetingResultsView } from './components/MeetingResultsView';
import { VoiceEnrollmentModal } from './components/VoiceEnrollmentModal';
import { AuthScreen } from './components/AuthScreen';
import { MeetingDetail, User } from './types';
import { api } from './services/api';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('mom_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<'landing' | 'speaker_room' | 'listener_room' | 'results'>('landing');
  const [currentMeeting, setCurrentMeeting] = useState<MeetingDetail | null>(null);
  const [userName, setUserName] = useState<string>(() => currentUser?.full_name || currentUser?.username || 'Host');
  const [userRole, setUserRole] = useState<'HOST' | 'LISTENER'>('HOST');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Check URL parameters for direct meeting join link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      handleJoinMeeting(code, currentUser?.full_name || currentUser?.username || 'Guest Listener');
    }
  }, []);

  const handleAuthenticated = (user: User) => {
    setCurrentUser(user);
    setUserName(user.full_name || user.username);
  };

  const handleLogout = () => {
    localStorage.removeItem('mom_user');
    localStorage.removeItem('mom_token');
    setCurrentUser(null);
    setCurrentMeeting(null);
    setCurrentView('landing');
  };

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

  // If user is not authenticated, show Authentication Screen (Login / Register / Guest)
  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

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
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            onCreateMeeting={handleCreateMeeting}
            onJoinMeeting={handleJoinMeeting}
            onOpenResults={handleOpenResults}
            onOpenVoiceEnrollment={() => setIsVoiceModalOpen(true)}
            defaultHostName={userName}
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
