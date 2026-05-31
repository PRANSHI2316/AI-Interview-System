import React, { useState } from 'react';
import './App.css';
import LandingPage from './components/LandingPage';
import TermsConditions from './components/TermsConditions';
import DeviceSetup from './components/DeviceSetup';
import InterviewScreen from './components/InterviewScreen';
import FeedbackPage from './components/FeedbackPage';
import MediaDebugger from './components/MediaDebugger';
import MicrophoneTest from './components/MicrophoneTest';

function App() {
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [feedback, setFeedback] = useState(null);

  const handleStart = () => {
    setCurrentScreen('terms');
  };

  const handleTermsAccept = () => {
    setCurrentScreen('setup');
  };

  const handleSetupComplete = () => {
    setCurrentScreen('interview');
  };

  const handleEnd = (interviewFeedback) => {
    setFeedback(interviewFeedback);
    setCurrentScreen('feedback');
  };

  const handleRestart = () => {
    setFeedback(null);
    setCurrentScreen('landing');
  };

  return (
    <div className="App">
      {currentScreen === 'landing' && <LandingPage onStart={handleStart} setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'terms' && <TermsConditions onAccept={handleTermsAccept} />}
      {currentScreen === 'setup' && <DeviceSetup onSetupComplete={handleSetupComplete} />}
      {currentScreen === 'interview' && <InterviewScreen onEnd={handleEnd} />}
      {currentScreen === 'feedback' && <FeedbackPage feedback={feedback} onRestart={handleRestart} />}
      {currentScreen === 'debugger' && <MediaDebugger setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'mic-test' && <MicrophoneTest setCurrentScreen={setCurrentScreen} />}
    </div>
  );
}

export default App;