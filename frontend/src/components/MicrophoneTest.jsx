import React, { useState, useRef } from 'react';

const MicrophoneTest = ({ setCurrentScreen }) => {
  const [logs, setLogs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micStatus, setMicStatus] = useState('idle');
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const addLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, data }]);
    console.log(`[${timestamp}] ${message}`, data || '');
  };

  const testMicrophoneBasic = async () => {
    try {
      addLog('Testing basic microphone access...');
      setMicStatus('requesting');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      addLog('✓ Basic microphone access granted');
      addLog('Stream details:', {
        active: stream.active,
        tracks: stream.getAudioTracks().length,
        id: stream.id
      });
      
      streamRef.current = stream;
      setMicStatus('active');
      
      // Test audio levels
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      addLog('Audio context created successfully');
      
      // Start monitoring audio levels
      monitorAudioLevels();
      
    } catch (error) {
      addLog('✗ Basic microphone test failed', error.message);
      addLog('Error details:', {
        name: error.name,
        message: error.message,
        constraint: error.constraint
      });
      
      if (error.name === 'NotAllowedError') {
        addLog('User denied microphone permission');
        setMicStatus('denied');
      } else if (error.name === 'NotFoundError') {
        addLog('No microphone device found');
        setMicStatus('not_found');
      } else if (error.name === 'NotReadableError') {
        addLog('Microphone is already in use');
        setMicStatus('in_use');
      } else {
        addLog('Unknown microphone error');
        setMicStatus('error');
      }
    }
  };

  const testMicrophoneConstraints = async () => {
    try {
      addLog('Testing microphone with different constraints...');
      
      const constraints = [
        { audio: true },
        { audio: { echoCancellation: false } },
        { audio: { noiseSuppression: false } },
        { audio: { autoGainControl: false } },
        { audio: { sampleRate: 44100 } },
        { audio: { sampleRate: 48000 } },
        { audio: { channelCount: 1 } },
        { audio: { channelCount: 2 } }
      ];
      
      for (let i = 0; i < constraints.length; i++) {
        try {
          addLog(`Testing constraint set ${i + 1}:`, constraints[i]);
          const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          addLog(`✓ Constraint set ${i + 1} successful`);
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          addLog(`✗ Constraint set ${i + 1} failed:`, error.message);
        }
      }
      
    } catch (error) {
      addLog('Constraints test failed:', error.message);
    }
  };

  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!isRecording) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const normalizedLevel = (average / 255) * 100;
      
      setAudioLevel(normalizedLevel);
      
      if (normalizedLevel > 5) {
        addLog('🎤 Audio detected - Level: ' + normalizedLevel.toFixed(1) + '%');
      }
      
      animationRef.current = requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const startRecording = () => {
    if (streamRef.current) {
      setIsRecording(true);
      addLog('🎙 Recording started');
      monitorAudioLevels();
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    addLog('⏹ Recording stopped');
  };

  const stopMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setIsRecording(false);
    setAudioLevel(0);
    setMicStatus('idle');
    addLog('Microphone stopped and cleaned up');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setCurrentScreen('landing')}
          style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', marginRight: '10px' }}
        >
          ← Back to App
        </button>
        <button 
          onClick={clearLogs}
          style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Clear Logs
        </button>
      </div>

      <h1 style={{ marginBottom: '20px' }}>🎤 Microphone Debug Tool</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '15px' }}>Microphone Tests</h3>
          
          <button 
            onClick={testMicrophoneBasic}
            disabled={micStatus === 'requesting'}
            style={{ 
              padding: '10px', 
              backgroundColor: micStatus === 'requesting' ? '#ffc107' : '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              width: '100%',
              marginBottom: '10px',
              cursor: micStatus === 'requesting' ? 'not-allowed' : 'pointer'
            }}
          >
            {micStatus === 'requesting' ? 'Testing...' : 'Test Basic Microphone'}
          </button>

          <button 
            onClick={testMicrophoneConstraints}
            style={{ 
              padding: '10px', 
              backgroundColor: '#17a2b8', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            Test Different Constraints
          </button>

          {streamRef.current && (
            <>
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                style={{ 
                  padding: '10px', 
                  backgroundColor: isRecording ? '#dc3545' : '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px',
                  width: '100%',
                  marginBottom: '10px'
                }}
              >
                {isRecording ? '⏹ Stop Recording' : '🎙 Start Recording'}
              </button>

              <button 
                onClick={stopMicrophone}
                style={{ 
                  padding: '10px', 
                  backgroundColor: '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px',
                  width: '100%'
                }}
              >
                Stop Microphone
              </button>
            </>
          )}

          <div style={{ marginTop: '15px' }}>
            <h4>Status: {micStatus}</h4>
            {streamRef.current && (
              <div>
                <p>Audio Level: {audioLevel.toFixed(1)}%</p>
                <div style={{ 
                  width: '100%', 
                  height: '20px', 
                  backgroundColor: '#333', 
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${audioLevel}%`, 
                    height: '100%', 
                    backgroundColor: audioLevel > 5 ? '#28a745' : '#6c757d',
                    transition: 'width 0.1s'
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '15px' }}>Debug Logs ({logs.length})</h3>
          <div style={{ 
            height: '400px', 
            overflow: 'auto', 
            backgroundColor: '#000', 
            padding: '10px', 
            borderRadius: '5px',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '5px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
                <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                {log.data && (
                  <div style={{ marginLeft: '20px', color: '#aaa', fontSize: '11px' }}>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicrophoneTest;
