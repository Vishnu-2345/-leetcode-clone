import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/axios';
import { Trophy, Code, CheckCircle, TrendingUp } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: async () => {
      const response = await api.get(`/users/${user?.id}/stats`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 h-20 w-20 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {user?.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{user?.username}</h1>
            <p className="text-gray-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Total Solved</span>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {stats?.stats?.total_solved || 0}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Easy</span>
            <Code className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {stats?.stats?.easy_solved || 0}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Medium</span>
            <Code className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {stats?.stats?.medium_solved || 0}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Hard</span>
            <Code className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {stats?.stats?.hard_solved || 0}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Submission Stats</h2>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Submissions</span>
              <span className="text-white font-semibold">
                {stats?.stats?.total_submissions || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Acceptance Rate</span>
              <span className="text-green-500 font-semibold">
                {stats?.stats?.acceptance_rate || 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Ranking</h2>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-yellow-500 mb-2">#--</div>
            <p className="text-gray-400">Global Rank</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {stats?.recentActivity?.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              No recent activity. Start solving problems!
            </p>
          ) : (
            stats?.recentActivity?.map((activity: any) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0"
              >
                <div>
                  <div className="text-white font-medium">{activity.title}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      activity.status === 'Accepted'
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {activity.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
