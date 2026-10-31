import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/axios';
import {
  Trophy,
  CheckCircle2,
  Flame,
  Zap,
  Swords,
  Award,
  Lock,
  Calendar,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  Clock,
} from 'lucide-react';

interface SkillData {
  skill: string;
  score: number;
  solved: number;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Master';
  unlocked: boolean;
}

interface CalendarEntry {
  date: string;
  count: number;
}

interface ActivityEntry {
  id: string;
  status: string;
  runtime: number | null;
  memory: number | null;
  created_at: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

// --------------------------------------------------------------------------
// 1. Hexagonal Skill Radar Chart (Pure SVG, zero extra dependencies)
// --------------------------------------------------------------------------
function SkillRadar({ skills }: { skills: SkillData[] }) {
  const size = 320;
  const center = size / 2;
  const radius = 105;
  const numAxes = skills.length || 6;

  // Compute vertex coordinates on radar
  const getCoords = (index: number, r: number) => {
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Concentric polygon grid points
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    return skills
      .map((_, i) => {
        const { x, y } = getCoords(i, radius * lvl);
        return `${x},${y}`;
      })
      .join(' ');
  });

  // Data polygon points
  const dataPolygon = skills
    .map((item, i) => {
      // Ensure at least 12% so empty axes don't collapse to invisible dot
      const val = Math.max(12, Math.min(100, item.score));
      const { x, y } = getCoords(i, (radius * val) / 100);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Concentric Grid Polygons */}
          {gridPolygons.map((points, idx) => (
            <polygon
              key={idx}
              points={points}
              fill="none"
              stroke="#334155"
              strokeWidth={idx === gridPolygons.length - 1 ? '1.5' : '1'}
              strokeDasharray={idx < gridPolygons.length - 1 ? '3 3' : 'none'}
            />
          ))}

          {/* Axis lines from center to vertices */}
          {skills.map((_, i) => {
            const { x, y } = getCoords(i, radius);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#334155"
                strokeWidth="1"
              />
            );
          })}

          {/* Filled Skill Polygon */}
          <polygon
            points={dataPolygon}
            fill="url(#radarGradient)"
            stroke="#60a5fa"
            strokeWidth="2.5"
            filter="url(#glow)"
            className="transition-all duration-700 ease-out"
          />

          {/* Node points at vertices */}
          {skills.map((item, i) => {
            const val = Math.max(12, Math.min(100, item.score));
            const { x, y } = getCoords(i, (radius * val) / 100);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4.5"
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="2"
              />
            );
          })}

          {/* Skill Labels */}
          {skills.map((item, i) => {
            const { x, y } = getCoords(i, radius + 24);
            const anchor =
              Math.abs(x - center) < 15 ? 'middle' : x > center ? 'start' : 'end';
            return (
              <g key={i}>
                <text
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="text-[11px] font-semibold fill-slate-300 tracking-tight"
                >
                  {item.skill}
                </text>
                <text
                  x={x}
                  y={y + 13}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="text-[10px] font-mono fill-cyan-400"
                >
                  {item.score}% ({item.solved})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. GitHub-Style 365-Day Activity Heatmap
// --------------------------------------------------------------------------
function SubmissionHeatmap({
  calendar,
  currentStreak,
  longestStreak,
}: {
  calendar: CalendarEntry[];
  currentStreak: number;
  longestStreak: number;
}) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null);

  // Map calendar array to lookup object
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    calendar.forEach((c) => {
      map.set(c.date, Number(c.count));
    });
    return map;
  }, [calendar]);

  // Generate 52 weeks (364 days + remainder) ending today
  const weeks = useMemo(() => {
    const res: { date: string; count: number; dayOfWeek: number }[][] = [];
    const today = new Date();
    // Align to ending Saturday or today
    const days: { date: string; count: number; dayOfWeek: number }[] = [];

    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = countByDate.get(dateStr) || 0;
      days.push({
        date: dateStr,
        count,
        dayOfWeek: d.getDay(), // 0 = Sun, 6 = Sat
      });
    }

    // Chunk into 7-day columns
    let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
    // Pad first week if it doesn't start on Sunday
    const firstDay = days[0].dayOfWeek;
    for (let p = 0; p < firstDay; p++) {
      currentWeek.push({ date: '', count: -1, dayOfWeek: p });
    }

    days.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        res.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      res.push(currentWeek);
    }

    return res;
  }, [countByDate]);

  const totalYearSubmissions = useMemo(() => {
    return calendar.reduce((acc, c) => acc + Number(c.count), 0);
  }, [calendar]);

  const getColor = (count: number) => {
    if (count === -1) return 'bg-transparent';
    if (count === 0) return 'bg-slate-800/80 border border-slate-700/40 hover:border-slate-500';
    if (count === 1) return 'bg-emerald-950 border border-emerald-800 text-emerald-300';
    if (count <= 3) return 'bg-emerald-700 text-white';
    if (count <= 6) return 'bg-emerald-500 text-white';
    return 'bg-emerald-400 text-slate-900 shadow-sm shadow-emerald-400/50';
  };

  return (
    <div className="bg-slate-850 rounded-xl border border-slate-700/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Activity & Submission Heatmap
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalYearSubmissions} submissions in the past 365 days
          </p>
        </div>

        {/* Streaks Banner */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-950/40 border border-orange-500/30 text-orange-400">
            <Flame className="w-4 h-4 animate-pulse text-orange-400" />
            <div className="text-xs">
              <span className="font-semibold">{currentStreak} Day</span> Streak
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300">
            <Zap className="w-4 h-4 text-purple-400" />
            <div className="text-xs">
              <span className="font-semibold">{longestStreak} Day</span> Max
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="flex gap-[3px]">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onMouseEnter={() => day.count >= 0 && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-[11px] h-[11px] rounded-[2px] transition-colors cursor-pointer ${getColor(
                      day.count
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
        <div>
          {hoveredDay ? (
            <span className="text-emerald-300 font-medium">
              {hoveredDay.count} {hoveredDay.count === 1 ? 'submission' : 'submissions'} on{' '}
              {new Date(hoveredDay.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span>Hover over squares to inspect daily velocity</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Less</span>
          <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-800/80 border border-slate-700/40" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-950 border border-emerald-800" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-700" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-500" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-400" />
          <span className="text-[11px] text-slate-500">More</span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. Badges Showcase Component
// --------------------------------------------------------------------------
function BadgesShowcase({ badges }: { badges: BadgeData[] }) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const filteredBadges = useMemo(() => {
    if (filter === 'unlocked') return badges.filter((b) => b.unlocked);
    if (filter === 'locked') return badges.filter((b) => !b.unlocked);
    return badges;
  }, [badges, filter]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze':
        return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
      case 'Silver':
        return 'text-slate-300 border-slate-400/30 bg-slate-400/10';
      case 'Gold':
        return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
      case 'Diamond':
        return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
      case 'Master':
        return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-800';
    }
  };

  return (
    <div className="bg-slate-850 rounded-xl border border-slate-700/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Achievements & RPG Badges
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {unlockedCount} of {badges.length} badges unlocked
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex rounded-lg bg-slate-900/80 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({badges.length})
          </button>
          <button
            onClick={() => setFilter('unlocked')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'unlocked'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Unlocked ({unlockedCount})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'locked' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Locked ({badges.length - unlockedCount})
          </button>
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredBadges.map((badge) => {
          const tierClasses = getTierColor(badge.tier);
          return (
            <div
              key={badge.id}
              className={`relative rounded-xl p-4 transition-all duration-300 border ${
                badge.unlocked
                  ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 shadow-lg shadow-black/20 hover:scale-[1.02]'
                  : 'bg-slate-900/40 border-slate-800/60 opacity-60'
              }`}
            >
              {badge.unlocked && (
                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierClasses}`}
                  >
                    {badge.tier}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    badge.unlocked
                      ? 'bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 shadow-inner'
                      : 'bg-slate-950 border border-slate-800 text-slate-600'
                  }`}
                >
                  {badge.unlocked ? (
                    badge.icon
                  ) : (
                    <Lock className="w-5 h-5 text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 pr-6">
                  <h4
                    className={`text-sm font-bold truncate ${
                      badge.unlocked ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {badge.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">
                    {badge.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Status</span>
                {badge.unlocked ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Unlocked
                  </span>
                ) : (
                  <span className="text-slate-500">Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// MAIN PROFILE PAGE
// --------------------------------------------------------------------------
export default function ProfilePage() {
  const { user } = useAuthStore();

  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: async () => {
      const response = await api.get(`/users/${user?.id}/stats`);
      return response.data.data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 text-sm font-medium">Computing Algorithmic Radar & Profile...</div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Failed to load developer profile</h2>
        <p className="text-sm text-slate-400 mt-1">Please try refreshing the page or logging in again.</p>
      </div>
    );
  }

  const {
    user: profileUser,
    stats,
    totals,
    skillRadar = [],
    calendar = [],
    streak = { currentStreak: 0, longestStreak: 0 },
    badges = [],
    recentActivity = [],
  } = profileData;

  const totalSolved = stats?.total_solved || 0;
  const totalProblems = totals?.total_problems || 50;
  const solvedPercent = totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0;

  // Level based on total solved & duel victories
  const developerLevel = Math.max(1, Math.floor(totalSolved / 2) + Math.floor((profileUser?.duels_won || 0) / 2));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. HERO PROFILE CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/40 rounded-2xl border border-slate-800 p-6 lg:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar with Level Ring */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-3xl">
                {profileUser?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-xs shadow-md border border-amber-300">
                LVL {developerLevel}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {profileUser?.username}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Engineer
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{profileUser?.email}</p>

              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    <strong className="text-white">{totalSolved}</strong> Problems Solved
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Fastest: <strong className="text-white">{stats?.fastest_runtime || 'N/A'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                  <span>
                    Acceptance: <strong className="text-emerald-400">{stats?.acceptance_rate || 0}%</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Elo & Arena Battle Card */}
          <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 min-w-[280px]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
              <Swords className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Arena Rating</span>
                <Link
                  to="/arena"
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-0.5 font-medium"
                >
                  Fight <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {profileUser?.rating || 1200}{' '}
                <span className="text-xs font-semibold text-rose-400">Elo</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Record:{' '}
                <strong className="text-emerald-400">{profileUser?.duels_won || 0}W</strong> -{' '}
                <strong className="text-rose-400">{profileUser?.duels_lost || 0}L</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. RADAR & DIFFICULTY MASTERY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Spider Chart (7 cols) */}
        <div className="lg:col-span-7 bg-slate-850 rounded-xl border border-slate-700/80 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Algorithmic Skill Radar
              </h3>
              <span className="text-xs text-slate-400">6 Core Mastery Pillars</span>
            </div>
            <p className="text-xs text-slate-400">
              Evaluated in real-time across your solved submissions by topic tag depth.
            </p>
          </div>

          <div className="my-4">
            <SkillRadar skills={skillRadar} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t border-slate-800">
            {skillRadar.map((item: SkillData, idx: number) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80 text-xs"
              >
                <div className="text-slate-400 truncate font-medium">{item.skill}</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-white font-bold">{item.score}%</span>
                  <span className="text-[11px] text-cyan-400 font-mono">{item.solved} solved</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Breakdown & Overall Progress (5 cols) */}
        <div className="lg:col-span-5 bg-slate-850 rounded-xl border border-slate-700/80 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Difficulty Mastery
            </h3>
            <p className="text-xs text-slate-400">
              Distribution of solved challenges across problem tiers.
            </p>
          </div>

          {/* Big Progress Donut / Bar */}
          <div className="my-6 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-3xl font-black text-white">
                {totalSolved} <span className="text-slate-500 text-lg font-semibold">/ {totalProblems}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">Total Solved Completion</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-emerald-400">{solvedPercent}%</div>
              <div className="text-xs text-slate-400 mt-1">Platform Coverage</div>
            </div>
          </div>

          {/* Difficulty Tiers */}
          <div className="space-y-4">
            {/* Easy */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-emerald-400 font-bold">Easy</span>
                <span className="text-slate-300">
                  <strong className="text-white">{stats?.easy_solved || 0}</strong> /{' '}
                  {totals?.total_easy || 20}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totals?.total_easy
                        ? Math.min(100, Math.round(((stats?.easy_solved || 0) / totals.total_easy) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Medium */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-yellow-400 font-bold">Medium</span>
                <span className="text-slate-300">
                  <strong className="text-white">{stats?.medium_solved || 0}</strong> /{' '}
                  {totals?.total_medium || 20}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totals?.total_medium
                        ? Math.min(100, Math.round(((stats?.medium_solved || 0) / totals.total_medium) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Hard */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-rose-500 font-bold">Hard</span>
                <span className="text-slate-300">
                  <strong className="text-white">{stats?.hard_solved || 0}</strong> /{' '}
                  {totals?.total_hard || 10}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totals?.total_hard
                        ? Math.min(100, Math.round(((stats?.hard_solved || 0) / totals.total_hard) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Total Submissions: <strong className="text-white">{stats?.total_submissions || 0}</strong></span>
            <span>Fastest: <strong className="text-emerald-400">{stats?.fastest_runtime || 'N/A'}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. SUBMISSION HEATMAP */}
      <SubmissionHeatmap
        calendar={calendar}
        currentStreak={streak.currentStreak || 0}
        longestStreak={streak.longestStreak || 0}
      />

      {/* 4. RPG ACHIEVEMENTS & BADGES */}
      <BadgesShowcase badges={badges} />

      {/* 5. RECENT ACTIVITY TIMELINE */}
      <div className="bg-slate-850 rounded-xl border border-slate-700/80 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Recent Submission History
          </h3>
          <span className="text-xs text-slate-400">Last 10 Submissions</span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
            <p className="text-slate-400 text-sm">No submissions recorded yet.</p>
            <Link
              to="/problems"
              className="inline-block mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              Solve Your First Problem
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Problem</th>
                  <th className="pb-3 font-semibold">Difficulty</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Runtime</th>
                  <th className="pb-3 font-semibold">Memory</th>
                  <th className="pb-3 font-semibold text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentActivity.map((sub: ActivityEntry) => {
                  const isAccepted = sub.status === 'Accepted';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 pr-4">
                        <Link
                          to={`/problems/${sub.slug}`}
                          className="font-semibold text-white hover:text-blue-400 transition-colors"
                        >
                          {sub.title}
                        </Link>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`font-semibold ${
                            sub.difficulty === 'Easy'
                              ? 'text-emerald-400'
                              : sub.difficulty === 'Medium'
                              ? 'text-yellow-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {sub.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[11px] ${
                            isAccepted
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-slate-300">
                        {sub.runtime !== null ? `${sub.runtime} ms` : '—'}
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-slate-300">
                        {sub.memory !== null ? `${sub.memory.toFixed(1)} MB` : '—'}
                      </td>
                      <td className="py-3.5 text-right text-slate-400">
                        {new Date(sub.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
