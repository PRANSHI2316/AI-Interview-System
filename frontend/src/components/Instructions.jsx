import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, Volume2, CheckCircle, ArrowRight } from 'lucide-react';

const Instructions = ({ onBegin }) => {
  const [agreed, setAgreed] = useState(false);

  const steps = [
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Allow Camera Access",
      description: "Enable your camera for facial expression analysis and confidence tracking"
    },
    {
      icon: <Mic className="w-6 h-6" />,
      title: "Allow Microphone Access",
      description: "Enable your microphone for speech transcription and voice analysis"
    },
    {
      icon: <Volume2 className="w-6 h-6" />,
      title: "Sit in a Quiet Environment",
      description: "Find a quiet space to ensure clear audio recording and minimal distractions"
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: "Speak Clearly",
      description: "Answer questions naturally and clearly for the best AI analysis"
    }
  ];

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
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get Ready for Your Interview
          </h1>
          <p className="text-xl text-gray-200">
            Follow these steps for the best experience
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-6 mb-10"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * index, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              className="glass-dark rounded-xl p-6 flex items-start gap-4"
            >
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0"
              >
                {step.icon}
              </motion.div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-2">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-gray-300">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="glass-dark rounded-xl p-6 mb-8"
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-purple-400 bg-transparent text-purple-500 focus:ring-purple-500 focus:ring-2"
            />
            <span className="text-white">
              I understand the requirements and agree to start the interview
            </span>
          </label>
        </motion.div>

        <motion.button
          whileHover={{ scale: agreed ? 1.05 : 1 }}
          whileTap={{ scale: agreed ? 0.95 : 1 }}
          onClick={onBegin}
          disabled={!agreed}
          className={`w-full font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 shadow-lg flex items-center justify-center gap-3 ${
            agreed
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Begin Interview
          <ArrowRight className="w-6 h-6" />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-gray-300 text-center mt-6 text-sm"
        >
          Your privacy is important to us. All data is processed locally.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Instructions;
