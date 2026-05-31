import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, TrendingUp, Award, RefreshCw, Download, Brain } from 'lucide-react';

const FeedbackPage = ({ feedback, onRestart }) => {
  if (!feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-12 text-center">
          <h2 className="text-2xl text-white mb-4">Interview Completed</h2>
          <button
            onClick={onRestart}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            Start New Interview
          </button>
        </div>
      </div>
    );
  }

  const { confidence, clarity, fluency, questions, transcripts } = feedback;
  
  const overallScore = Math.round((confidence + clarity + fluency) / 3);
  
  const getScoreColor = (score) => {
    if (score >= 80) return 'from-green-400 to-emerald-400';
    if (score >= 60) return 'from-yellow-400 to-orange-400';
    return 'from-red-400 to-pink-400';
  };

  const getScoreMessage = (score) => {
    if (score >= 80) return 'Excellent!';
    if (score >= 60) return 'Good job!';
    return 'Keep practicing!';
  };

  const improvements = [
    'Try to reduce filler words (um, uh, like)',
    'Maintain better eye contact with the camera',
    'Speak more clearly and at a moderate pace',
    'Structure your answers with STAR method',
    'Practice active listening skills'
  ];

  const improvedAnswer = "Based on your responses, here's an improved example: 'I'm a dedicated professional with 5 years of experience in customer service. I'm passionate about helping people and solving problems efficiently. In my previous role, I improved customer satisfaction by 30% through implementing new communication strategies.'";

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-12"
        >
          {/* Header */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="flex justify-center mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
              >
                <Award className="w-10 h-10 text-white" />
              </motion.div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Interview Complete!
            </h1>
            <p className="text-xl text-gray-200">
              Here's your detailed performance analysis
            </p>
          </motion.div>

          {/* Overall Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="glass-dark rounded-3xl p-8 mb-8 text-center"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Overall Performance</h2>
            <div className="relative inline-block">
              <div className={`w-32 h-32 rounded-full bg-gradient-to-r ${getScoreColor(overallScore)} flex items-center justify-center`}>
                <div className="w-28 h-28 rounded-full glass flex items-center justify-center">
                  <div>
                    <div className="text-3xl font-bold text-white">{overallScore}%</div>
                    <div className="text-sm text-gray-300">{getScoreMessage(overallScore)}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Detailed Scores */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <div className="glass-dark rounded-2xl p-6 text-center">
              <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${getScoreColor(confidence)} flex items-center justify-center mb-4`}>
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Confidence</h3>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(confidence)}%</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`bg-gradient-to-r ${getScoreColor(confidence)} h-2 rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  transition={{ duration: 1, delay: 0.8 }}
                />
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-6 text-center">
              <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${getScoreColor(clarity)} flex items-center justify-center mb-4`}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Clarity</h3>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(clarity)}%</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`bg-gradient-to-r ${getScoreColor(clarity)} h-2 rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${clarity}%` }}
                  transition={{ duration: 1, delay: 0.9 }}
                />
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-6 text-center">
              <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${getScoreColor(fluency)} flex items-center justify-center mb-4`}>
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Fluency</h3>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(fluency)}%</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`bg-gradient-to-r ${getScoreColor(fluency)} h-2 rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${fluency}%` }}
                  transition={{ duration: 1, delay: 1 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Improvements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"
          >
            <div className="glass-dark rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-400" />
                Areas for Improvement
              </h3>
              <ul className="space-y-3">
                {improvements.map((improvement, index) => (
                  <motion.li
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.3 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-300">{improvement}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="glass-dark rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                Improved Answer Example
              </h3>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-300 italic">
                  "{improvedAnswer}"
                </p>
              </div>
              <p className="text-gray-400 text-sm mt-3">
                Notice how this answer is structured, confident, and provides specific examples.
              </p>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRestart}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-8 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Practice Again
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="glass-dark text-white font-bold py-3 px-8 rounded-full hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Report
            </motion.button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="text-center text-gray-300 mt-6 text-sm"
          >
            Keep practicing to improve your interview skills! 🚀
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default FeedbackPage;
