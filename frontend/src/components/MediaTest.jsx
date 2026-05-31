import React, { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../config/api';

const MediaTest = ({ setCurrentScreen }) => {
  const [cameraStatus, setCameraStatus] = useState('Not started');
  const [micStatus, setMicStatus] = useState('Not started');
  const [recordingStatus, setRecordingStatus] = useState('Not recording');
  const [transcript, setTranscript] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported in this browser');
      setCameraStatus('Browser not supported');
      setMicStatus('Browser not supported');
    }
  }, []);

  const startCamera = async () => {
    setCameraStatus('Requesting permission...');
    try {
      console.log('Requesting camera and microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log('Got stream:', stream);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Video source set');
      }
      
      setCameraStatus('Camera active');
      setMicStatus('Microphone active');
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setCameraStatus(`Error: ${error.message}`);
      setMicStatus(`Error: ${error.message}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setCameraStatus('Camera stopped');
      setMicStatus('Microphone stopped');
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setRecordingStatus('No media stream available');
      return;
    }

    try {
      audioChunksRef.current = [];
      const audioStream = new MediaStream(streamRef.current.getAudioTracks());
      
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received:', event.data.size);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Recording stopped, blob size:', audioBlob.size);
          setRecordingStatus('Recording stopped, processing...');
          
          // Send to backend for transcription
          await transcribeAudio(audioBlob);
        } catch (error) {
          console.error('Error processing audio:', error);
          setRecordingStatus(`Error: ${error.message}`);
        }
      };
      
      mediaRecorder.start(1000);
      setRecordingStatus('Recording...');
      console.log('Recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingStatus(`Error: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('Recording stop requested');
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      console.log('Sending audio to backend...');
      const response = await fetch(getApiUrl('/transcribe'), {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      console.log('Backend response:', result);
      
      if (result.status === 'success') {
        setTranscript(result.text);
        setRecordingStatus('Transcription complete');
      } else {
        setRecordingStatus(`Transcription failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setRecordingStatus(`Transcription error: ${error.message}`);
    }
  };

  const testSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Hello, this is a test of the speech synthesis system.');
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      window.speechSynthesis.speak(utterance);
      console.log('Speech synthesis test started');
    } else {
      console.error('Speech synthesis not supported');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setCurrentScreen('landing')}
          style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          ← Back to Interview
        </button>
      </div>
      <h2>Media Device Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Camera Status: {cameraStatus}</h3>
        <h3>Microphone Status: {micStatus}</h3>
        <h3>Recording Status: {recordingStatus}</h3>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{ width: '320px', height: '240px', backgroundColor: '#000', border: '1px solid #ccc' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={startCamera} style={{ marginRight: '10px', padding: '10px' }}>
          Start Camera
        </button>
        <button onClick={stopCamera} style={{ marginRight: '10px', padding: '10px' }}>
          Stop Camera
        </button>
        <button onClick={startRecording} style={{ marginRight: '10px', padding: '10px' }}>
          Start Recording
        </button>
        <button onClick={stopRecording} style={{ marginRight: '10px', padding: '10px' }}>
          Stop Recording
        </button>
        <button onClick={testSpeechSynthesis} style={{ padding: '10px' }}>
          Test Speech
        </button>
      </div>

      {transcript && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
          <h3>Transcript:</h3>
          <p>{transcript}</p>
        </div>
      )}
    </div>
  );
};

export default MediaTest;
