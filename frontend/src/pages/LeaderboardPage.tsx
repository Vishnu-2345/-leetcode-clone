import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { Trophy, Medal, Award, Flame, Search, CheckCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeaderboardUser {
  id: string;
  username: string;
  problems_solved: string | number;
  total_submissions: string | number;
  acceptance_rate: string | number;
}

export default function LeaderboardPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await api.get('/users/leaderboard?limit=100');
      return response.data.data.leaderboard as LeaderboardUser[];
    },
  });

  const users = data || [];
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/50">
            <Trophy className="h-4 w-4" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-400/20 text-slate-300 font-bold border border-slate-400/50">
            <Medal className="h-4 w-4" />
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-500 font-bold border border-amber-600/50">
            <Award className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <span className="font-mono text-slate-400 font-medium text-sm pl-2">
            #{rank}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <Trophy className="h-7 w-7 text-yellow-500" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Global Leaderboard</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Top programmers ranked by problems solved and overall acceptance rate
            </p>
          </div>

          {/* Search User */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search coder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Podium (Top 3 Users) */}
        {!isLoading && users.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Rank 2 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden order-2 md:order-1">
              <div className="absolute top-3 right-3 text-slate-400">
                <Medal className="h-6 w-6 text-slate-400" />
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-200 text-xl font-bold mb-3 border border-slate-600">
                {users[1].username.charAt(0).toUpperCase()}
              </div>
              <div className="text-lg font-bold text-white">{users[1].username}</div>
              <div className="text-xs text-slate-400 mt-0.5">Rank 2</div>
              <div className="mt-4 flex items-center gap-4 text-xs font-medium">
                <div>
                  <span className="text-slate-400">Solved: </span>
                  <span className="text-green-400 font-bold">{users[1].problems_solved}</span>
                </div>
                <div>
                  <span className="text-slate-400">Rate: </span>
                  <span className="text-blue-400 font-bold">
                    {(parseFloat(String(users[1].acceptance_rate)) || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Rank 1 */}
            <div className="bg-gradient-to-b from-yellow-500/10 to-slate-900/80 border border-yellow-500/30 rounded-xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden order-1 md:order-2 shadow-lg shadow-yellow-500/5">
              <div className="absolute top-3 right-3 text-yellow-400">
                <Trophy className="h-7 w-7 text-yellow-400" />
              </div>
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-300 text-2xl font-black mb-3 border-2 border-yellow-500/50">
                {users[0].username.charAt(0).toUpperCase()}
              </div>
              <div className="text-xl font-extrabold text-white flex items-center gap-1.5">
                {users[0].username}
                <Flame className="h-4 w-4 text-orange-400 inline" />
              </div>
              <div className="text-xs font-semibold text-yellow-400 mt-0.5">Champion • Rank 1</div>
              <div className="mt-4 flex items-center gap-5 text-sm font-semibold">
                <div>
                  <span className="text-slate-400 text-xs block">Problems Solved</span>
                  <span className="text-green-400 text-base">{users[0].problems_solved}</span>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div>
                  <span className="text-slate-400 text-xs block">Acceptance</span>
                  <span className="text-yellow-400 text-base">
                    {(parseFloat(String(users[0].acceptance_rate)) || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Rank 3 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden order-3">
              <div className="absolute top-3 right-3 text-amber-500">
                <Award className="h-6 w-6 text-amber-600" />
              </div>
              <div className="w-14 h-14 rounded-full bg-amber-900/30 flex items-center justify-center text-amber-300 text-xl font-bold mb-3 border border-amber-800">
                {users[2].username.charAt(0).toUpperCase()}
              </div>
              <div className="text-lg font-bold text-white">{users[2].username}</div>
              <div className="text-xs text-slate-400 mt-0.5">Rank 3</div>
              <div className="mt-4 flex items-center gap-4 text-xs font-medium">
                <div>
                  <span className="text-slate-400">Solved: </span>
                  <span className="text-green-400 font-bold">{users[2].problems_solved}</span>
                </div>
                <div>
                  <span className="text-slate-400">Rate: </span>
                  <span className="text-blue-400 font-bold">
                    {(parseFloat(String(users[2].acceptance_rate)) || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-6 w-20">Rank</th>
                  <th className="py-3.5 px-6">User</th>
                  <th className="py-3.5 px-6 text-right">Problems Solved</th>
                  <th className="py-3.5 px-6 text-right">Total Submissions</th>
                  <th className="py-3.5 px-6 text-right">Acceptance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading global rankings...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No coders found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((coder, idx) => {
                    const rank = idx + 1;
                    const solved = parseInt(String(coder.problems_solved)) || 0;
                    const totalSubs = parseInt(String(coder.total_submissions)) || 0;
                    const accRate = parseFloat(String(coder.acceptance_rate)) || 0;

                    return (
                      <tr
                        key={coder.id}
                        className={`hover:bg-slate-850/50 transition ${
                          rank === 1 ? 'bg-yellow-500/[0.02]' : ''
                        }`}
                      >
                        <td className="py-4 px-6">{getRankBadge(rank)}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm">
                              {coder.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                {coder.username}
                                {rank === 1 && (
                                  <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/40">
                                    #1
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-medium text-green-400">
                          {solved}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-slate-300">
                          {totalSubs}
                        </td>
                        <td className="py-4 px-6 text-right font-mono">
                          <span
                            className={`font-semibold ${
                              accRate >= 60
                                ? 'text-green-400'
                                : accRate >= 40
                                ? 'text-yellow-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {accRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Practice CTA */}
        <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-500/20 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-400" />
              Ready to climb the leaderboard?
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Solve algorithmic problems and submit verified solutions to raise your global standing.
            </p>
          </div>
          <Link
            to="/problems"
            className="whitespace-nowrap bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition flex items-center gap-1.5"
          >
            <span>Explore Problems</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

