import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import {
  Swords,
  Users,
  Trophy,
  Clock,
  Play,
  Copy,
  AlertTriangle,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface DuelPlayer {
  socketId: string;
  user: {
    id: string;
    username: string;
    rating: number;
  };
  progress: number;
  totalCases: number;
  status: 'coding' | 'running' | 'accepted' | 'forfeited';
}

interface DuelRoom {
  roomId: string;
  roomCode?: string;
  problem: {
    id: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    constraints?: string;
    examples?: any[];
    testCases?: any[];
  };
  durationSeconds: number;
  players: DuelPlayer[];
}

const defaultTemplates: Record<string, string> = {
  python: `class Solution:
    def solution(self, *args, **kwargs):
        # Write your duel solution here
        pass`,
  javascript: `class Solution {
  solution(...args) {
    // Write your duel solution here
  }
}`,
  java: `class Solution {
    public Object solution(String input) {
        return null;
    }
}`,
  cpp: `#include <iostream>
#include <string>

std::string solution(std::string input) {
    return "";
}`,
};

export default function ArenaPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const socket = getSocket();

  // Matchmaking & Room State
  const [inQueue, setInQueue] = useState(false);
  const [queueTimer, setQueueTimer] = useState(0);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);

  // In-Match State
  const [activeMatch, setActiveMatch] = useState<DuelRoom | null>(null);
  const [matchSecondsRemaining, setMatchSecondsRemaining] = useState(900);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(defaultTemplates.python);

  // Match Progress
  const [myProgress, setMyProgress] = useState({ passed: 0, total: 1 });
  const [opponentProgress, setOpponentProgress] = useState({
    username: 'Opponent',
    progress: 0,
    total: 1,
    status: 'coding',
  });

  // Run / Submit status in match
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    won: boolean;
    winner: string;
    ratingDelta: number;
    reason: string;
  } | null>(null);

  // 1. Fetch Duels Leaderboard
  const { data: leaderboardData, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['duelsLeaderboard'],
    queryFn: async () => {
      const res = await api.get('/duels/leaderboard');
      return res.data.data.leaderboard;
    },
  });

  // 2. Fetch User Duel Stats
  const { data: userStatsData, refetch: refetchUserStats } = useQuery({
    queryKey: ['userDuelStats'],
    queryFn: async () => {
      const res = await api.get('/duels/stats');
      return res.data.data.stats;
    },
    enabled: isAuthenticated,
  });

  // Socket Event Listeners
  useEffect(() => {
    socket.on('arena:queue_status', ({ inQueue }) => {
      setInQueue(inQueue);
      if (!inQueue) setQueueTimer(0);
    });

    socket.on('arena:custom_room_created', (data) => {
      setCreatedRoomCode(data.roomCode);
      toast.success(`Room ${data.roomCode} created! Share this code with your rival.`);
    });

    socket.on('arena:match_found', (data: DuelRoom) => {
      setInQueue(false);
      setCreatedRoomCode(null);
      setActiveMatch(data);
      setMatchSecondsRemaining(data.durationSeconds || 900);
      setCode(defaultTemplates[language] || defaultTemplates.python);

      const opponent = data.players.find((p) => p.user.id !== user?.id);
      if (opponent) {
        setOpponentProgress({
          username: opponent.user.username,
          progress: 0,
          total: 1,
          status: 'coding',
        });
      }

      toast.success('⚔️ MATCH FOUND! Duel begins now!', { duration: 4000 });
    });

    socket.on('arena:opponent_progress', (data) => {
      setOpponentProgress({
        username: data.username,
        progress: data.progress,
        total: data.totalCases || 1,
        status: data.status,
      });
    });

    socket.on('arena:match_ended', (data) => {
      const won = data.winner === user?.username;
      setMatchResult({
        won,
        winner: data.winner,
        ratingDelta: data.ratingDelta || 25,
        reason: data.reason,
      });

      if (won) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        toast.success('🏆 VICTORY! You won the duel!');
      } else {
        toast.error(`Defeat! ${data.winner} won the duel.`);
      }

      refetchLeaderboard();
      refetchUserStats();
    });

    socket.on('arena:opponent_disconnected', (data) => {
      toast.error(`${data.disconnectedUser} disconnected! You win by forfeit!`);
      setMatchResult({
        won: true,
        winner: user?.username || 'You',
        ratingDelta: 20,
        reason: 'Opponent disconnected',
      });
      confetti({ particleCount: 80 });
      refetchLeaderboard();
      refetchUserStats();
    });

    socket.on('arena:error', (msg: string) => {
      toast.error(msg);
      setInQueue(false);
    });

    return () => {
      socket.off('arena:queue_status');
      socket.off('arena:custom_room_created');
      socket.off('arena:match_found');
      socket.off('arena:opponent_progress');
      socket.off('arena:match_ended');
      socket.off('arena:opponent_disconnected');
      socket.off('arena:error');
    };
  }, [user, language]);

  // Queue Timer Tick
  useEffect(() => {
    let interval: any;
    if (inQueue) {
      interval = setInterval(() => {
        setQueueTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inQueue]);

  // Match Countdown Timer
  useEffect(() => {
    let interval: any;
    if (activeMatch && !matchResult) {
      interval = setInterval(() => {
        setMatchSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleForfeit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeMatch, matchResult]);

  // Actions
  const handleJoinQueue = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to enter the 1v1 Arena');
      navigate('/login');
      return;
    }
    socket.emit('arena:join_queue', {
      id: user?.id,
      username: user?.username,
      rating: userStatsData?.rating || 1200,
    });
    setInQueue(true);
  };

  const handleLeaveQueue = () => {
    socket.emit('arena:leave_queue');
    setInQueue(false);
    setQueueTimer(0);
  };

  const handleCreateCustomRoom = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in first');
      navigate('/login');
      return;
    }
    socket.emit('arena:create_custom_room', {
      id: user?.id,
      username: user?.username,
      rating: userStatsData?.rating || 1200,
    });
  };

  const handleJoinCustomRoom = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in first');
      navigate('/login');
      return;
    }
    if (!joinCodeInput.trim()) {
      toast.error('Enter a valid 6-letter room code');
      return;
    }
    socket.emit('arena:join_custom_room', {
      roomCode: joinCodeInput.trim(),
      user: {
        id: user?.id,
        username: user?.username,
        rating: userStatsData?.rating || 1200,
      },
    });
  };

  // Run Code in Match
  const handleRunCode = async () => {
    if (!activeMatch || !code.trim() || isRunning) return;
    setIsRunning(true);
    socket.emit('arena:update_progress', {
      roomId: activeMatch.roomId,
      passed: myProgress.passed,
      total: myProgress.total,
      status: 'running',
    });

    try {
      const res = await api.post('/submissions/run', {
        problemId: activeMatch.problem.id,
        code,
        language,
      });
      const runId = res.data.data.runId;

      // Poll run result
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await api.get(`/submissions/run/${runId}`);
          if (pollRes.data.status === 'success' && pollRes.data.data) {
            clearInterval(poll);
            setIsRunning(false);
            const rData = pollRes.data.data;
            const passed = rData.results?.filter((r: any) => r.status === 'Accepted').length || 0;
            const total = rData.results?.length || 1;
            setMyProgress({ passed, total });

            socket.emit('arena:update_progress', {
              roomId: activeMatch.roomId,
              passed,
              total,
              status: passed === total ? 'accepted' : 'coding',
            });

            if (passed === total) {
              toast.success(`Passed sample test cases (${passed}/${total})! Submit for the win!`);
            } else {
              toast.error(`Sample tests: ${passed}/${total} passed`);
            }
          }
        } catch (_) {}

        if (attempts > 15) {
          clearInterval(poll);
          setIsRunning(false);
        }
      }, 600);
    } catch (err: any) {
      setIsRunning(false);
      toast.error(err.response?.data?.message || 'Run failed');
    }
  };

  // Submit Code in Match (The Deciding Factor)
  const handleSubmitCode = async () => {
    if (!activeMatch || !code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    toast.success('Submitting against full test suite for the win...');

    try {
      const res = await api.post('/submissions', {
        problemId: activeMatch.problem.id,
        code,
        language,
      });
      const subId = res.data.data.submission.id;

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await api.get(`/submissions/${subId}`);
          const sub = pollRes.data.data.submission;

          if (sub.status !== 'Pending' && sub.status !== 'Running') {
            clearInterval(poll);
            setIsSubmitting(false);

            const passed = sub.test_cases_passed || 0;
            const total = sub.test_cases_total || 1;
            setMyProgress({ passed, total });

            socket.emit('arena:update_progress', {
              roomId: activeMatch.roomId,
              passed,
              total,
              status: sub.status === 'Accepted' ? 'accepted' : 'coding',
            });

            if (sub.status === 'Accepted') {
              // 100% Accepted -> Claim Victory!
              socket.emit('arena:match_won', { roomId: activeMatch.roomId });
            } else {
              toast.error(`${sub.status}: ${passed}/${total} test cases passed`);
            }
          }
        } catch (_) {}

        if (attempts > 25) {
          clearInterval(poll);
          setIsSubmitting(false);
        }
      }, 600);
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err.response?.data?.message || 'Submission failed');
    }
  };

  const handleForfeit = () => {
    if (!activeMatch) return;
    socket.emit('arena:forfeit', { roomId: activeMatch.roomId });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // =========================================================================
  // VIEW 1: ACTIVE LIVE 1V1 DUEL WORKSPACE
  // =========================================================================
  if (activeMatch) {
    const myPct = Math.min(100, Math.round((myProgress.passed / Math.max(1, myProgress.total)) * 100));
    const oppPct = Math.min(100, Math.round((opponentProgress.progress / Math.max(1, opponentProgress.total)) * 100));

    return (
      <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-950 text-slate-100 font-sans">
        {/* ================= BATTLE HUD HEADER ================= */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-xl">
          {/* Left Player (You) */}
          <div className="flex items-center gap-3 w-1/3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-blue-400 text-lg shadow-inner">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{user?.username} (You)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {userStatsData?.rating || 1200} Elo
                </span>
              </div>
              {/* My Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 mt-1.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${myPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                <span>{myProgress.passed} / {myProgress.total} test cases</span>
                <span className="font-semibold text-blue-400">{myPct}%</span>
              </div>
            </div>
          </div>

          {/* Center VS & Timer */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-xs font-mono">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className={`font-bold ${matchSecondsRemaining < 120 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
                {formatTime(matchSecondsRemaining)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-[11px] font-semibold tracking-wider uppercase">
              <Swords className="h-3.5 w-3.5 text-rose-500" />
              <span>Speed Duel</span>
            </div>
          </div>

          {/* Right Player (Opponent) */}
          <div className="flex items-center gap-3 w-1/3 justify-end">
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  1250 Elo
                </span>
                <span className="font-bold text-white text-sm">{opponentProgress.username}</span>
              </div>
              {/* Opponent Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 mt-1.5 overflow-hidden border border-slate-700 flex justify-end">
                <div
                  className="bg-gradient-to-r from-rose-500 to-orange-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${oppPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                <span className="font-semibold text-rose-400">{oppPct}%</span>
                <span>{opponentProgress.progress} / {opponentProgress.total} test cases</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center font-bold text-rose-400 text-lg shadow-inner">
              {opponentProgress.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ================= WORKSPACE (PROBLEM + MONACO EDITOR) ================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Problem Statement & Examples */}
          <div className="w-1/2 border-r border-slate-800 overflow-y-auto p-6 space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white">{activeMatch.problem.title}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {activeMatch.problem.difficulty}
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {activeMatch.problem.description}
              </div>
            </div>

            {/* Examples */}
            {activeMatch.problem.examples && activeMatch.problem.examples.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Examples</h4>
                {activeMatch.problem.examples.map((ex: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5">
                    <div>
                      <span className="text-slate-400">Input: </span>
                      <code className="text-blue-300 font-mono">{ex.input}</code>
                    </div>
                    <div>
                      <span className="text-slate-400">Output: </span>
                      <code className="text-emerald-300 font-mono">{ex.output}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Constraints */}
            {activeMatch.problem.constraints && (
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Constraints:</div>
                <div className="whitespace-pre-wrap font-mono text-[11px]">{activeMatch.problem.constraints}</div>
              </div>
            )}

            {/* Surrender Button */}
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={handleForfeit}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Forfeit Duel</span>
              </button>
            </div>
          </div>

          {/* Right: Code Editor & Execution Controls */}
          <div className="w-1/2 flex flex-col bg-slate-950">
            {/* Action Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setCode(defaultTemplates[e.target.value] || '');
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript (Node)</option>
                <option value="java">Java 17</option>
                <option value="cpp">C++ (GCC)</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold transition disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5 text-blue-400" />
                  <span>{isRunning ? 'Running...' : 'Run'}</span>
                </button>

                <button
                  onClick={handleSubmitCode}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-xs font-bold transition shadow-md disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Evaluating...' : 'Submit for Win 🏆'}</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1">
              <Editor
                height="100%"
                language={language === 'python' ? 'python' : language === 'javascript' ? 'javascript' : 'cpp'}
                value={code}
                onChange={(val) => setCode(val || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>

        {/* ================= VICTORY / DEFEAT MODAL ================= */}
        {matchResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl space-y-5">
              <div
                className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl ${
                  matchResult.won
                    ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white border border-amber-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {matchResult.won ? '🏆' : '💀'}
              </div>

              <div>
                <h3 className={`text-2xl font-black ${matchResult.won ? 'text-amber-400' : 'text-slate-300'}`}>
                  {matchResult.won ? 'VICTORY!' : 'DEFEAT'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {matchResult.won
                    ? `You defeated ${opponentProgress.username}!`
                    : `${matchResult.winner} solved it first!`}
                </p>
              </div>

              {/* Rating Delta Badge */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-around">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Elo Rating</div>
                  <div className="text-xl font-mono font-bold text-white mt-0.5">
                    {userStatsData?.rating || 1200}
                  </div>
                </div>
                <div
                  className={`text-lg font-mono font-bold px-3 py-1 rounded-lg border ${
                    matchResult.won
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {matchResult.won ? `+${matchResult.ratingDelta}` : `-${matchResult.ratingDelta}`}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setActiveMatch(null);
                    setMatchResult(null);
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  Back to Arena Lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ARENA LOBBY & LEADERBOARD
  // =========================================================================
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Swords className="h-3.5 w-3.5" />
            <span>Competitive Multiplayer Code Arena</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            1v1 Real-Time Speed Duels
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Queue into random matchmaking or challenge a friend to a head-to-head coding duel.
            Pass all test cases first to take the win and climb the Elo ladder.
          </p>
        </div>

        {/* Arena Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Random Matchmaking */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Swords className="h-6 w-6" />
                </div>
                {inQueue && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Searching... ({queueTimer}s)
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mt-4">Ranked Quick Match</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Automatically matches you against an opponent with a similar Elo rating on a random
                algorithmic problem.
              </p>
            </div>

            {inQueue ? (
              <div className="space-y-3">
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
                  <Clock className="h-5 w-5 text-amber-400 animate-spin" />
                  <span className="text-sm font-semibold text-slate-200">
                    Finding worthy opponent... ({queueTimer}s)
                  </span>
                </div>
                <button
                  onClick={handleLeaveQueue}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
                >
                  Cancel Matchmaking
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoinQueue}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2 group"
              >
                <span>Find 1v1 Match</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </button>
            )}
          </div>

          {/* Card 2: Custom Friend Duels */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="p-3 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30 w-fit">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mt-4">Private Room Duel</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Create a private room to get a 6-letter room code, or paste a code to join an active friend's room.
              </p>
            </div>

            {createdRoomCode ? (
              <div className="p-4 bg-slate-950 border border-rose-500/30 rounded-xl space-y-3 text-center">
                <span className="text-xs text-slate-400">Your Duel Room Code:</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-mono font-black text-rose-400 tracking-wider">
                    {createdRoomCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoomCode);
                      toast.success('Room code copied!');
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                    title="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 italic">Waiting for your friend to enter this code...</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter 6-letter room code..."
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={handleJoinCustomRoom}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
                  >
                    Join
                  </button>
                </div>

                <button
                  onClick={handleCreateCustomRoom}
                  className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <span>Create Private Duel Room</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Duels Leaderboard Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Duelists Elo Leaderboard</h3>
            </div>
            <div className="text-xs text-slate-400">Top Competitive Programmers</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Duelist</th>
                  <th className="py-3 px-4">Elo Rating</th>
                  <th className="py-3 px-4">Win / Loss</th>
                  <th className="py-3 px-4 text-right">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {leaderboardData && leaderboardData.length > 0 ? (
                  leaderboardData.map((d: any, idx: number) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold">
                        {idx === 0 && '🥇 1'}
                        {idx === 1 && '🥈 2'}
                        {idx === 2 && '🥉 3'}
                        {idx > 2 && `#${idx + 1}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                            {d.username.charAt(0).toUpperCase()}
                          </div>
                          <span>{d.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {d.rating || 1200}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="text-emerald-400">{d.duels_won || 0}W</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400">{d.duels_lost || 0}L</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                        {d.win_rate}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No duels recorded yet. Be the first to duel and claim Rank #1!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
