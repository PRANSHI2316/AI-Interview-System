import React, { useState, useEffect, useRef } from 'react';

const MediaDebugger = ({ setCurrentScreen }) => {
  const [logs, setLogs] = useState([]);
  const [browserInfo, setBrowserInfo] = useState({});
  const [devices, setDevices] = useState([]);
  const [testResults, setTestResults] = useState({});
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Collect browser information
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      speechSynthesis: 'speechSynthesis' in window,
      https: window.location.protocol === 'https:',
      hostname: window.location.hostname
    };
    setBrowserInfo(info);
    addLog('Browser info collected', info);
    
    // Enumerate devices
    enumerateDevices();
  }, []);

  const addLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, data }]);
    console.log(`[${timestamp}] ${message}`, data || '');
  };

  const enumerateDevices = async () => {
    try {
      addLog('Enumerating devices...');
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);
      addLog('Devices found', deviceList.length);
      
      const videoDevices = deviceList.filter(d => d.kind === 'videoinput');
      const audioDevices = deviceList.filter(d => d.kind === 'audioinput');
      
      addLog('Video devices', videoDevices.length);
      addLog('Audio devices', audioDevices.length);
      
      deviceList.forEach(device => {
        addLog(`Device: ${device.kind} - ${device.label || 'Unnamed'}`, {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label,
          groupId: device.groupId
        });
      });
    } catch (error) {
      addLog('Error enumerating devices', error.message);
    }
  };

  const testBasicGetUserMedia = async () => {
    try {
      addLog('Testing basic getUserMedia...');
      
      // Test 1: Basic video only
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        addLog('✓ Video only - SUCCESS');
        videoStream.getTracks().forEach(track => track.stop());
        setTestResults(prev => ({ ...prev, videoOnly: 'SUCCESS' }));
      } catch (error) {
        addLog('✗ Video only - FAILED', error.message);
        setTestResults(prev => ({ ...prev, videoOnly: `FAILED: ${error.message}` }));
      }
      
      // Test 2: Basic audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        addLog('✓ Audio only - SUCCESS');
        audioStream.getTracks().forEach(track => track.stop());
        setTestResults(prev => ({ ...prev, audioOnly: 'SUCCESS' }));
      } catch (error) {
        addLog('✗ Audio only - FAILED', error.message);
        setTestResults(prev => ({ ...prev, audioOnly: `FAILED: ${error.message}` }));
      }
      
      // Test 3: Both together
      try {
        const bothStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        addLog('✓ Video + Audio - SUCCESS');
        bothStream.getTracks().forEach(track => track.stop());
        setTestResults(prev => ({ ...prev, both: 'SUCCESS' }));
      } catch (error) {
        addLog('✗ Video + Audio - FAILED', error.message);
        setTestResults(prev => ({ ...prev, both: `FAILED: ${error.message}` }));
      }
      
    } catch (error) {
      addLog('Error in basic test', error.message);
    }
  };

  const testAdvancedGetUserMedia = async () => {
    try {
      addLog('Testing advanced getUserMedia with constraints...');
      
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        addLog('✓ Advanced constraints - SUCCESS');
        
        // Test video preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          addLog('Video preview started');
        }
        
        setTestResults(prev => ({ ...prev, advanced: 'SUCCESS' }));
      } catch (error) {
        addLog('✗ Advanced constraints - FAILED', error.message);
        setTestResults(prev => ({ ...prev, advanced: `FAILED: ${error.message}` }));
      }
      
    } catch (error) {
      addLog('Error in advanced test', error.message);
    }
  };

  const stopTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    addLog('Test stopped');
  };

  const testSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      addLog('Testing speech synthesis...');
      const utterance = new SpeechSynthesisUtterance('This is a test of the speech synthesis system.');
      utterance.onstart = () => addLog('Speech synthesis started');
      utterance.onend = () => addLog('Speech synthesis ended');
      utterance.onerror = (e) => addLog('Speech synthesis error', e.error);
      
      window.speechSynthesis.speak(utterance);
      setTestResults(prev => ({ ...prev, speech: 'SUCCESS' }));
    } else {
      addLog('Speech synthesis not supported');
      setTestResults(prev => ({ ...prev, speech: 'NOT_SUPPORTED' }));
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setTestResults({});
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

      <h1>🔧 Media Device Debugger</h1>

      {/* Browser Info */}
      <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <h2>Browser Information</h2>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify(browserInfo, null, 2)}
        </pre>
      </div>

      {/* Test Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h2>Tests</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={testBasicGetUserMedia} style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>
            Test Basic getUserMedia
          </button>
          <button onClick={testAdvancedGetUserMedia} style={{ padding: '10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px' }}>
            Test Advanced getUserMedia
          </button>
          <button onClick={stopTest} style={{ padding: '10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px' }}>
            Stop Test
          </button>
          <button onClick={testSpeechSynthesis} style={{ padding: '10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '5px' }}>
            Test Speech Synthesis
          </button>
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
          <h2>Test Results</h2>
          {Object.entries(testResults).map(([test, result]) => (
            <div key={test} style={{ marginBottom: '5px' }}>
              <strong>{test}:</strong> <span style={{ color: result.includes('SUCCESS') ? '#28a745' : '#dc3545' }}>{result}</span>
            </div>
          ))}
        </div>
      )}

      {/* Video Preview */}
      <div style={{ marginBottom: '20px' }}>
        <h2>Video Preview</h2>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{ width: '320px', height: '240px', backgroundColor: '#000', border: '1px solid #ccc' }}
        />
      </div>

      {/* Device List */}
      {devices.length > 0 && (
        <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
          <h2>Available Devices ({devices.length})</h2>
          {devices.map((device, index) => (
            <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>
              <strong>{device.kind}:</strong> {device.label || 'Unnamed'} 
              <span style={{ color: '#888', marginLeft: '10px' }}>{device.deviceId.slice(0, 8)}...</span>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '5px' }}>
        <h2>Debug Logs ({logs.length})</h2>
        <div style={{ maxHeight: '400px', overflow: 'auto', fontSize: '12px' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '5px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
              <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
              {log.data && (
                <div style={{ marginLeft: '20px', color: '#aaa' }}>
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MediaDebugger;
