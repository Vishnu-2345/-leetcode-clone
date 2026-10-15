import { Link } from 'react-router-dom';
import { Code2, Zap, Users, Award } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6">
            Master Your Coding Skills
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Practice coding problems, compete with others, and level up your programming abilities
            with our comprehensive platform.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/problems"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
            >
              Start Practicing
            </Link>
            <Link
              to="/register"
              className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
            >
              Sign Up Free
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Diverse Problems
            </h3>
            <p className="text-gray-400">
              Hundreds of coding challenges across different difficulty levels and topics.
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="bg-green-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Real-time Execution
            </h3>
            <p className="text-gray-400">
              Test your code instantly with our powerful execution engine.
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="bg-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Community
            </h3>
            <p className="text-gray-400">
              Learn from others and share your solutions with the community.
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="bg-orange-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Award className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Track Progress
            </h3>
            <p className="text-gray-400">
              Monitor your improvement with detailed statistics and leaderboards.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-blue-500 mb-2">500+</div>
            <div className="text-gray-400">Coding Problems</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-500 mb-2">10K+</div>
            <div className="text-gray-400">Active Users</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-500 mb-2">1M+</div>
            <div className="text-gray-400">Solutions Submitted</div>
          </div>
        </div>
      </div>
    </div>
  );
}
