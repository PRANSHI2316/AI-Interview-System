import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, MicOff, Video, VideoOff, CheckCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

const DeviceSetup = ({ onSetupComplete }) => {
  const [cameraStatus, setCameraStatus] = useState('checking');
  const [micStatus, setMicStatus] = useState('checking');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    checkDevices();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const checkDevices = async () => {
    try {
      console.log('Checking for media devices...');
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('MediaDevices API not available');
        setCameraStatus('not_supported');
        setMicStatus('not_supported');
        setError('MediaDevices API not supported in this browser');
        return;
      }

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('Available devices:', devices);
      
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMic = devices.some(device => device.kind === 'audioinput');
      
      console.log('Device detection - Camera:', hasCamera, 'Microphone:', hasMic);
      
      // Log detailed device information
      devices.forEach((device, index) => {
        console.log(`Device ${index}: ${device.kind} - ${device.label || 'Unnamed'} (${device.deviceId})`);
      });
      
      // Set initial status based on device availability
      setCameraStatus(hasCamera ? 'available' : 'not_found');
      // Always set microphone to 'available' to allow user to try accessing it
      setMicStatus('available');
      
      // Clear any previous errors if camera is available
      if (hasCamera) {
        setError('');
      }
      
      if (!hasMic) {
        console.log('No audioinput devices found in device enumeration, but still allowing user to try');
      }
      
    } catch (error) {
      console.error('Error checking devices:', error);
      setCameraStatus('error');
      setMicStatus('error');
      setError(`Error checking devices: ${error.message}`);
    }
  };

  const toggleCamera = async () => {
    try {
      if (cameraEnabled) {
        // Stop camera
        console.log('Stopping camera...');
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            console.log('Stopping video track');
            videoTrack.stop();
          }
        }
        
        // Clear video element
        if (videoRef.current) {
          console.log('Clearing video element');
          videoRef.current.srcObject = null;
        }
        
        setCameraEnabled(false);
        setCameraStatus('available');
      } else {
        // Start camera
        console.log('Starting camera...');
        setCameraStatus('requesting');
        
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
          
          console.log('Camera access granted');
          
          // Update stream
          let newStream = stream;
          if (!newStream) {
            newStream = cameraStream;
          } else {
            // Add video track to existing stream
            cameraStream.getVideoTracks().forEach(track => {
              newStream.addTrack(track);
            });
          }
          
          setStream(newStream);
          setCameraStatus('granted');
          setCameraEnabled(true);
          
          // Start video preview
          if (videoRef.current) {
            console.log('Video element found:', videoRef.current);
            console.log('Attaching stream to video element:', newStream);
            console.log('Video tracks in stream:', newStream.getVideoTracks().length);
            
            // Debug video element state before attachment
            console.log('Video element before attachment:');
            console.log('- srcObject:', videoRef.current.srcObject);
            console.log('- readyState:', videoRef.current.readyState);
            console.log('- videoWidth:', videoRef.current.videoWidth);
            console.log('- videoHeight:', videoRef.current.videoHeight);
            console.log('- offsetWidth:', videoRef.current.offsetWidth);
            console.log('- offsetHeight:', videoRef.current.offsetHeight);
            console.log('- style.display:', videoRef.current.style.display);
            console.log('- style.visibility:', videoRef.current.style.visibility);
            
            // Clear any existing stream
            videoRef.current.srcObject = null;
            
            // Force a small delay before setting new stream
            setTimeout(() => {
              videoRef.current.srcObject = newStream;
              console.log('Stream attached to video element');
              
              // Ensure video element has proper attributes
              videoRef.current.autoPlay = true;
              videoRef.current.playsInline = true;
              videoRef.current.muted = true;
              videoRef.current.controls = false;
              
              // Force video element to be visible
              videoRef.current.style.display = 'block';
              videoRef.current.style.visibility = 'visible';
              videoRef.current.style.opacity = '1';
              
              console.log('Video element after attachment:');
              console.log('- srcObject:', videoRef.current.srcObject);
              console.log('- autoPlay:', videoRef.current.autoPlay);
              console.log('- playsInline:', videoRef.current.playsInline);
              console.log('- muted:', videoRef.current.muted);
              
              // Wait for metadata to load
              videoRef.current.onloadedmetadata = () => {
                console.log('Video metadata loaded successfully');
                console.log('Video dimensions:', videoRef.current.videoWidth + 'x' + videoRef.current.videoHeight);
                
                // Try to play the video
                videoRef.current.play().then(() => {
                  console.log('Video playback started successfully');
                  console.log('Video playing state:', !videoRef.current.paused);
                  console.log('Video currentTime:', videoRef.current.currentTime);
                }).catch(error => {
                  console.error('Error playing video:', error);
                  
                  // Fallback: try to play with user interaction
                  console.log('Attempting fallback play method...');
                  setTimeout(() => {
                    videoRef.current.play().catch(fallbackError => {
                      console.error('Fallback play also failed:', fallbackError);
                    });
                  }, 100);
                });
              };
              
              // Handle video errors
              videoRef.current.onerror = (error) => {
                console.error('Video element error:', error);
                console.error('Video error code:', videoRef.current.error);
              };
              
              // Handle video canplay event
              videoRef.current.oncanplay = () => {
                console.log('Video can play event fired');
                console.log('Video readyState:', videoRef.current.readyState);
              };
              
              // Handle video playing event
              videoRef.current.onplaying = () => {
                console.log('Video is now playing');
              };
              
            }, 100);
            
          } else {
            console.error('Video ref is null, cannot attach stream');
            setError('Video element not found. Please refresh the page.');
          }
          
          setError('');
          
        } catch (error) {
          console.error('Camera access denied:', error);
          
          if (error.name === 'NotAllowedError') {
            setCameraStatus('denied');
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (error.name === 'NotFoundError') {
            setCameraStatus('not_found');
            setError('No camera found. Please connect a camera and try again.');
          } else {
            setCameraStatus('error');
            setError(`Camera error: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      setError(`Camera toggle error: ${error.message}`);
    }
  };

  const testCameraDirectly = async () => {
    console.log('=== TESTING CAMERA DIRECTLY ===');
    try {
      // Test with minimal constraints
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      
      console.log('Test stream obtained:', testStream);
      console.log('Video tracks:', testStream.getVideoTracks().length);
      
      if (testStream.getVideoTracks().length > 0) {
        const videoTrack = testStream.getVideoTracks()[0];
        console.log('Video track info:', {
          label: videoTrack.label,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
          readyState: videoTrack.readyState
        });
        
        // Try to attach to video element directly
        if (videoRef.current) {
          console.log('Attaching test stream to video element');
          videoRef.current.srcObject = testStream;
          videoRef.current.play().then(() => {
            console.log('Test video playing successfully');
          }).catch(error => {
            console.error('Test video play failed:', error);
          });
        }
        
        // Don't auto-stop test stream - let user control it manually
        console.log('Test stream active - user can stop manually');
      }
      
    } catch (error) {
      console.error('Direct camera test failed:', error);
    }
  };

  const testMicrophoneDirectly = async () => {
    console.log('=== TESTING MICROPHONE DIRECTLY ===');
    try {
      // Test with minimal constraints
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      console.log('Test microphone stream obtained:', testStream);
      console.log('Audio tracks in test stream:', testStream.getAudioTracks().length);
      
      if (testStream.getAudioTracks().length > 0) {
        const audioTrack = testStream.getAudioTracks()[0];
        console.log('Audio track info:', {
          label: audioTrack.label,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          readyState: audioTrack.readyState
        });
        
        // Test audio levels
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(testStream);
        source.connect(analyser);
        
        console.log('Microphone test successful - audio levels detected');
        
        // Stop test stream after 3 seconds
        setTimeout(() => {
          testStream.getTracks().forEach(track => track.stop());
          console.log('Test microphone stream stopped');
        }, 3000);
      }
      
    } catch (error) {
      console.error('Direct microphone test failed:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
    }
  };

  const toggleMicrophone = async () => {
    try {
      if (micEnabled) {
        // Stop microphone
        console.log('Stopping microphone...');
        if (stream) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            console.log('Stopping audio track');
            audioTrack.stop();
          } else {
            console.warn('No audio track found in stream');
          }
        } else {
          console.warn('No stream available to stop microphone');
        }
        setMicEnabled(false);
        setMicStatus('available');
        setError('');
      } else {
        // Start microphone
        console.log('Starting microphone...');
        setMicStatus('requesting');
        
        try {
          // Request microphone access with basic constraints
          console.log('Requesting microphone access...');
          const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
          });
          
          console.log('Microphone access granted!');
          console.log('Stream details:', {
            active: micStream.active,
            id: micStream.id,
            audioTracks: micStream.getAudioTracks().length
          });
          
          // Verify we got audio tracks
          if (micStream.getAudioTracks().length === 0) {
            throw new Error('No audio tracks in granted stream');
          }
          
          // Update stream state
          let newStream = stream;
          if (!newStream) {
            console.log('Creating new stream with microphone');
            newStream = micStream;
          } else {
            console.log('Adding microphone track to existing stream');
            // Add audio track to existing stream
            micStream.getAudioTracks().forEach(track => {
              console.log('Adding audio track:', track.label);
              newStream.addTrack(track);
            });
          }
          
          setStream(newStream);
          setMicStatus('granted');
          setMicEnabled(true);
          setError('');
          
          console.log('Microphone successfully enabled');
          
        } catch (error) {
          console.error('Microphone access failed:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          
          // Handle specific error types
          if (error.name === 'NotAllowedError') {
            console.error('User denied microphone permission');
            setMicStatus('denied');
            setError('Microphone permission denied. Please allow microphone access in your browser settings.');
          } else if (error.name === 'NotFoundError') {
            console.error('No microphone device found');
            setMicStatus('not_found');
            setError('No microphone found. Please connect a microphone and try again.');
          } else if (error.name === 'NotReadableError') {
            console.error('Microphone is already in use');
            setMicStatus('error');
            setError('Microphone is already in use by another application. Please close other apps using microphone.');
          } else if (error.name === 'OverconstrainedError') {
            console.error('Microphone constraints cannot be satisfied');
            setMicStatus('error');
            setError('Microphone constraints cannot be satisfied by available devices.');
          } else {
            console.error('Unknown microphone error:', error);
            setMicStatus('error');
            setError(`Microphone error: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error toggling microphone:', error);
      setError(`Microphone toggle error: ${error.message}`);
    }
  };

  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'available':
        return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'denied':
      case 'not_found':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'checking':
      case 'requesting':
        return <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'not_supported':
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status, deviceType) => {
    switch (status) {
      case 'granted':
        return `${deviceType} access granted`;
      case 'available':
        return `${deviceType} available`;
      case 'denied':
        return `${deviceType} access denied`;
      case 'not_found':
        return `No ${deviceType} found`;
      case 'error':
        return `Error checking ${deviceType}`;
      case 'checking':
        return `Checking ${deviceType}...`;
      case 'requesting':
        return `Requesting ${deviceType}...`;
      case 'not_supported':
        return `${deviceType} not supported`;
      default:
        return '';
    }
  };

  const canProceed = cameraStatus === 'granted' && micStatus === 'granted' && cameraEnabled && micEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-12 max-w-4xl w-full"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Setup Your Devices
          </h1>
          <p className="text-xl text-gray-200">
            We need to access your camera and microphone for the interview
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Camera Setup */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-dark rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-purple-300" />
                Camera Setup
              </h3>
              {getStatusIcon(cameraStatus)}
            </div>
            
            <p className="text-gray-300 mb-4">
              {getStatusText(cameraStatus, 'Camera')}
            </p>

            {cameraStatus === 'granted' && (
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-48 bg-gray-800 rounded-xl object-cover"
                  style={{ 
                    display: 'block', 
                    visibility: 'visible',
                    opacity: '1',
                    transform: 'scaleX(-1)', // Mirror effect for natural camera view
                    backgroundColor: '#000'
                  }}
                />
                {!cameraEnabled && (
                  <div className="absolute inset-0 bg-gray-800 rounded-xl flex items-center justify-center">
                    <VideoOff className="w-12 h-12 text-gray-500" />
                    <span className="text-gray-400 ml-2">Camera Off</span>
                  </div>
                )}
                {/* Debug info overlay */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                  Camera {cameraEnabled ? 'ON' : 'OFF'}
                </div>
              </div>
            )}

            <button
              onClick={toggleCamera}
              disabled={cameraStatus === 'requesting' || cameraStatus === 'not_supported'}
              className={`w-full py-3 px-6 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                cameraStatus === 'requesting'
                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                  : cameraStatus === 'not_supported'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : cameraStatus === 'granted'
                  ? cameraEnabled
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                  : cameraStatus === 'available'
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {cameraStatus === 'requesting' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Requesting...
                </>
              ) : cameraStatus === 'not_supported' ? (
                <>
                  <VideoOff className="w-5 h-5" />
                  Not Supported
                </>
              ) : cameraStatus === 'granted' || cameraStatus === 'available' ? (
                <>
                  {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  {cameraEnabled ? 'Stop Camera' : 'Start Camera'}
                </>
              ) : (
                <>
                  <VideoOff className="w-5 h-5" />
                  Camera Unavailable
                </>
              )}
            </button>
            
            {/* Test Camera Button */}
            <button
              onClick={testCameraDirectly}
              className="w-full py-2 px-4 rounded-full text-sm bg-gray-700 text-white hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
            >
              🔧 Test Camera Directly
            </button>
          </motion.div>

          {/* Microphone Setup */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="glass-dark rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Mic className="w-6 h-6 text-purple-300" />
                Microphone Setup
              </h3>
              {getStatusIcon(micStatus)}
            </div>
            
            <p className="text-gray-300 mb-4">
              {getStatusText(micStatus, 'Microphone')}
            </p>

            {micStatus === 'granted' && (
              <div className="mb-4 p-4 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${micEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-white text-sm">
                    {micEnabled ? 'Microphone is active' : 'Microphone is muted'}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={toggleMicrophone}
              disabled={micStatus === 'requesting' || micStatus === 'not_supported'}
              className={`w-full py-3 px-6 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                micStatus === 'requesting'
                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                  : micStatus === 'not_supported'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : micStatus === 'granted'
                  ? micEnabled
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                  : micStatus === 'available'
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {micStatus === 'requesting' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Requesting...
                </>
              ) : micStatus === 'not_supported' ? (
                <>
                  <MicOff className="w-5 h-5" />
                  Not Supported
                </>
              ) : micStatus === 'granted' || micStatus === 'available' ? (
                <>
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  {micEnabled ? 'Stop Microphone' : 'Start Microphone'}
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5" />
                  Microphone Unavailable
                </>
              )}
            </button>
            
            {/* Test Microphone Button */}
            <button
              onClick={testMicrophoneDirectly}
              className="w-full py-2 px-4 rounded-full text-sm bg-gray-700 text-white hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
            >
              🔧 Test Microphone Directly
            </button>
          </motion.div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="glass-dark rounded-2xl p-6 mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <h4 className="text-white font-semibold">Error</h4>
            </div>
            <p className="text-gray-300 text-sm">{error}</p>
          </motion.div>
        )}

        {/* Start Interview Button */}
        {canProceed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-center"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSetupComplete}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-4 px-8 rounded-full text-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg flex items-center gap-3 mx-auto transform hover:shadow-green-500/25"
            >
              👉 Start Interview
              <ArrowRight className="w-6 h-6" />
            </motion.button>
            
            <p className="text-gray-300 mt-4 text-sm">
              All devices are ready! You can begin your interview now.
            </p>
          </motion.div>
        )}

        {/* Help Text */}
        {cameraStatus === 'denied' || micStatus === 'denied' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="glass-dark rounded-2xl p-6 mt-6"
          >
            <h4 className="text-white font-semibold mb-3">Permission Denied?</h4>
            <div className="space-y-3">
              <p className="text-gray-300 text-sm">
                If you accidentally denied permissions, you can:
              </p>
              <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
                <li>Click the "Enable Camera & Microphone" button above to try again</li>
                <li>Refresh the page and grant permissions when prompted</li>
                <li>Check your browser settings to ensure camera/microphone access is allowed</li>
                <li>Make sure no other application is using the camera or microphone</li>
              </ul>
              <div className="mt-4 p-3 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-xs">
                  <strong>Browser Tips:</strong><br/>
                  • Chrome: Click the lock icon in the address bar to change permissions<br/>
                  • Firefox: Click the info icon in the address bar to change permissions<br/>
                  • Safari: Check Preferences &gt; Websites &gt; Camera &amp; Microphone
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  );
};

export default DeviceSetup;
