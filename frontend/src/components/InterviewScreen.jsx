import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Send, Brain, Clock, TrendingUp } from 'lucide-react';
import { getApiUrl } from '../config/api';

const InterviewScreen = ({ onEnd }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [fluency, setFluency] = useState(0);
  const [hasLiveMetrics, setHasLiveMetrics] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showSupportMessage, setShowSupportMessage] = useState(false);
  const [facialExpression, setFacialExpression] = useState('neutral');
  const [eyeContact, setEyeContact] = useState(0);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);

  const questions = [
    "Tell me about yourself and your background.",
    "What are your greatest strengths?",
    "Describe a challenging situation you've faced and how you handled it.",
    "Why are you interested in this position?",
    "Where do you see yourself in 5 years?",
    "What are your weaknesses?",
    "How do you handle stress and pressure?",
    "Tell me about a time you worked in a team."
  ];

  // Mount-only: start camera and initial AI prompts (do not re-run on question index changes)
  useEffect(() => {
    startCamera();
    // Start with AI greeting
    setTimeout(() => {
      speakQuestion("Hello, I am your AI interviewer. I'm here to help you practice your interview skills. Let's begin with our first question.");
    }, 1000);
    
    // Ask first question after greeting
    setTimeout(() => {
      speakQuestion(questions[currentQuestionIndex]);
    }, 6000);
    
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const speakQuestion = (questionText) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Get available voices and set a female voice if available
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Karen'));
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const startCamera = async () => {
    try {
      console.log('Starting camera initialization...');
      
      // First check if devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMic = devices.some(device => device.kind === 'audioinput');
      
      if (!hasCamera || !hasMic) {
        throw new Error('Required devices not found');
      }
      
      // Request permissions with fallback options
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (error) {
        console.log('Trying with basic constraints...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Ensure muted to avoid feedback
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, playing...');
          videoRef.current.play().catch(error => {
            console.error('Error playing video:', error);
          });
        };
      }
      
      console.log('Camera and microphone access granted successfully');
      setCameraEnabled(true);
      setMicEnabled(true);
      
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      setCameraEnabled(false);
      setMicEnabled(false);
      
      // Don't show alert immediately, let the user handle it through UI
      console.warn('Camera/microphone access denied or not available');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleMicrophone = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      alert('Camera and microphone not initialized. Please refresh the page and grant permissions.');
      return;
    }
    
    try {
      audioChunksRef.current = [];
      const audioStream = new MediaStream(streamRef.current.getAudioTracks());
      
      // Check for supported MIME types
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }
      
      const mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Recording stopped, blob size:', audioBlob.size);
          await transcribeAudio(audioBlob);
        } catch (error) {
          console.error('Error processing audio blob:', error);
          setTranscript('Error processing recording. Please try again.');
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setTimeElapsed(0);
      
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzeTranscript = (text) => {
    if (!text || !text.trim()) {
      setConfidence(0);
      setClarity(0);
      setFluency(0);
      setHasLiveMetrics(false);
      return;
    }
    console.log('[InterviewScreen] transcript length=', text.trim().length);
    setHasLiveMetrics(false);
  };

  const transcribeAudio = async (audioBlob) => {
    setIsThinking(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      
      const response = await fetch(getApiUrl('/transcribe'), {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setTranscript(result.text);
        analyzeTranscript(result.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setTranscript('Error transcribing audio. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setTranscript('');
      setTimeElapsed(0);
      
      setTimeout(() => {
        speakQuestion(questions[nextIndex]);
      }, 1000);
    } else {
      onEnd(null);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">AI Interview Session</h1>
            <div className="flex items-center gap-4">
              <div className="glass-dark rounded-full px-4 py-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-300" />
                <span className="text-white font-semibold">{formatTime(timeElapsed)}</span>
              </div>
              <button
                onClick={() => onEnd(null)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                End Interview
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Video Feed */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="glass-dark rounded-2xl p-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-64 bg-gray-800 rounded-xl object-cover"
                  />
                  {!cameraEnabled && (
                    <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
                      <VideoOff className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                  {/* Hidden canvas for facial analysis */}
                  <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    className="hidden"
                  />
                </div>
                
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-all ${
                      cameraEnabled 
                        ? 'bg-purple-500 text-white hover:bg-purple-600' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={toggleMicrophone}
                    className={`p-3 rounded-full transition-all ${
                      micEnabled 
                        ? 'bg-purple-500 text-white hover:bg-purple-600' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Real-time Analysis */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="glass-dark rounded-2xl p-6"
              >
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-300" />
                  Real-time Analysis
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Confidence</span>
                      <span className="text-white font-semibold">{Math.round(confidence)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full"
                        style={{ width: `${confidence}%` }}
                        animate={{ width: `${confidence}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Clarity</span>
                      <span className="text-white font-semibold">{Math.round(clarity)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full"
                        style={{ width: `${clarity}%` }}
                        animate={{ width: `${clarity}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Fluency</span>
                      <span className="text-white font-semibold">{Math.round(fluency)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-green-400 to-emerald-400 h-2 rounded-full"
                        style={{ width: `${fluency}%` }}
                        animate={{ width: `${fluency}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Eye Contact</span>
                      <span className="text-white font-semibold">{Math.round(eyeContact)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full"
                        style={{ width: `${eyeContact}%` }}
                        animate={{ width: `${eyeContact}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">Expression:</span>
                    <span className="text-white font-medium capitalize">{facialExpression}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Question and Answer Section */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div className="glass-dark rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-6 h-6 text-purple-300" />
                  <h3 className="text-white font-semibold">Question {currentQuestionIndex + 1} of {questions.length}</h3>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-xl text-white mb-6">
                      {questions[currentQuestionIndex]}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => speakQuestion(questions[currentQuestionIndex])}
                      className="glass-dark text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-gray-700 transition-all flex items-center gap-2"
                    >
                      🔊 Repeat Question
                    </motion.button>
                  </motion.div>
                </AnimatePresence>

                <div className="flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!micEnabled}
                    className={`flex-1 font-semibold py-3 px-6 rounded-full transition-all flex items-center justify-center gap-2 ${
                      isRecording
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : micEnabled
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-5 h-5" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        Start Recording
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Transcript */}
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-dark rounded-2xl p-6"
                >
                  <h3 className="text-white font-semibold mb-3">Your Answer:</h3>
                  <p className="text-gray-300">{transcript}</p>
                </motion.div>
              )}

              {/* Support Message */}
              <AnimatePresence>
                {showSupportMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="glass rounded-xl p-4 text-center"
                  >
                    <p className="text-white">
                      Take your time, you're doing well 👍
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thinking Indicator */}
              {isThinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-dark rounded-2xl p-6 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Brain className="w-5 h-5 text-purple-300 animate-pulse" />
                    <span className="text-white">AI is analyzing your response...</span>
                  </div>
                </motion.div>
              )}

              {/* Next Question Button */}
              {transcript && !isThinking && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextQuestion}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-3 px-6 rounded-full hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview'}
                  <Send className="w-5 h-5" />
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InterviewScreen;
