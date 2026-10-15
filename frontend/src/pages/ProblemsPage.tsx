import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Search, Filter } from 'lucide-react';

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  acceptance_rate: number;
  total_submissions: number;
}

const difficultyColors = {
  Easy: 'text-green-500',
  Medium: 'text-yellow-500',
  Hard: 'text-red-500',
};

export default function ProblemsPage() {
  const [difficulty, setDifficulty] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['problems', difficulty],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (difficulty) params.append('difficulty', difficulty);
      const response = await api.get(`/problems?${params.toString()}`);
      return response.data.data;
    },
  });

  const filteredProblems = data?.problems?.filter((problem: Problem) =>
    problem.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Problems</h1>
        <p className="text-gray-400">
          Practice coding with our collection of algorithmic problems
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Difficulty Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setDifficulty('')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              difficulty === ''
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDifficulty('Easy')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              difficulty === 'Easy'
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Easy
          </button>
          <button
            onClick={() => setDifficulty('Medium')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              difficulty === 'Medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Medium
          </button>
          <button
            onClick={() => setDifficulty('Hard')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              difficulty === 'Hard'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Hard
          </button>
        </div>
      </div>

      {/* Problems Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Difficulty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Acceptance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : filteredProblems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                  No problems found
                </td>
              </tr>
            ) : (
              filteredProblems.map((problem: Problem) => (
                <tr key={problem.id} className="hover:bg-slate-750 transition">
                  <td className="px-6 py-4">
                    <Link
                      to={`/problems/${problem.slug}`}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {problem.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${difficultyColors[problem.difficulty]}`}>
                      {problem.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {problem.acceptance_rate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {problem.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-slate-700 text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
