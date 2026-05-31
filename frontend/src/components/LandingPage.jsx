import React from 'react';
import { motion } from 'framer-motion';
import { Play, Mic, Camera, Brain } from 'lucide-react';

const LandingPage = ({ onStart, setCurrentScreen }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-12 max-w-4xl w-full text-center"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
            >
              <Brain className="w-10 h-10 text-white" />
            </motion.div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            AI Interview Assistant
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-8">
            Practice smarter. Get real-time AI feedback.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-dark rounded-xl p-6"
          >
            <Camera className="w-8 h-8 text-purple-300 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Camera Analysis</h3>
            <p className="text-gray-300 text-sm">Real-time facial expression analysis</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-dark rounded-xl p-6"
          >
            <Mic className="w-8 h-8 text-purple-300 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Voice Analysis</h3>
            <p className="text-gray-300 text-sm">Speech clarity and fluency tracking</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-dark rounded-xl p-6"
          >
            <Brain className="w-8 h-8 text-purple-300 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">AI Feedback</h3>
            <p className="text-gray-300 text-sm">Personalized improvement suggestions</p>
          </motion.div>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-6 px-12 rounded-full text-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-2xl flex items-center gap-4 mx-auto transform hover:shadow-purple-500/25"
        >
          <Play className="w-8 h-8" />
          Start Interview
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-gray-300 mt-6 text-sm"
        >
          No registration required • Free to use • Privacy-focused
        </motion.p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentScreen('debugger')}
          className="glass-dark text-white font-medium py-2 px-6 rounded-full hover:bg-gray-700 transition-all mt-4"
        >
          🔧 Debug Camera & Mic
        </motion.button>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentScreen('mic-test')}
          className="glass-dark text-white font-medium py-2 px-6 rounded-full hover:bg-gray-700 transition-all mt-2"
        >
          🎤 Test Microphone
        </motion.button>
      </motion.div>
    </div>
  );
};

export default LandingPage;
