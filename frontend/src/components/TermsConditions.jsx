import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Camera, Mic, Eye } from 'lucide-react';

const TermsConditions = ({ onAccept }) => {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (agreed) {
      onAccept();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-12 max-w-3xl w-full"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Terms & Conditions
          </h1>
          <p className="text-xl text-gray-200">
            Please review and accept our terms to continue
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="glass-dark rounded-2xl p-8 mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-6">Privacy & Data Usage</h2>
          
          <div className="space-y-6">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">Camera Usage</h3>
                <p className="text-gray-300">
                  We access your camera to provide real-time feedback on facial expressions and eye contact during the interview. 
                  Video data is processed locally and not stored permanently.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">Microphone Usage</h3>
                <p className="text-gray-300">
                  Your voice is recorded during the interview to analyze speech patterns, clarity, and provide transcription. 
                  Audio data is processed securely and used only for interview analysis.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">AI Analysis</h3>
                <p className="text-gray-300">
                  Our AI analyzes your responses to provide personalized feedback on communication skills, 
                  confidence, and interview performance. All analysis is confidential.
                </p>
              </div>
            </motion.div>
          </div>

          <div className="mt-8 p-4 bg-gray-800 rounded-xl">
            <h4 className="text-white font-semibold mb-3">Key Points:</h4>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li>• Your data is processed locally and securely</li>
              <li>• No personal information is shared with third parties</li>
              <li>• Interview recordings are not stored permanently</li>
              <li>• You can stop the interview at any time</li>
              <li>• All analysis is used solely for improving your interview skills</li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="glass-dark rounded-2xl p-6 mb-8"
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-purple-400 bg-transparent text-purple-500 focus:ring-purple-500 focus:ring-2"
            />
            <span className="text-white">
              I have read and agree to the terms & conditions
            </span>
          </label>
        </motion.div>

        <motion.button
          whileHover={{ scale: agreed ? 1.05 : 1 }}
          whileTap={{ scale: agreed ? 0.95 : 1 }}
          onClick={handleAccept}
          disabled={!agreed}
          className={`w-full font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 shadow-lg flex items-center justify-center gap-3 ${
            agreed
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transform hover:shadow-purple-500/25'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Accept & Continue
          <ArrowRight className="w-6 h-6" />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-gray-300 text-center mt-6 text-sm"
        >
          Your privacy is our priority. No data is stored without your consent.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default TermsConditions;
