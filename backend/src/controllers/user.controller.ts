import { Response } from 'express';
import { pool } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export const getUserStats = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  // 1. Solved problems count by difficulty & best runtime
  const solvedStats = await pool.query(
    `SELECT 
       COUNT(CASE WHEN p.difficulty = 'Easy' THEN 1 END) as easy_solved,
       COUNT(CASE WHEN p.difficulty = 'Medium' THEN 1 END) as medium_solved,
       COUNT(CASE WHEN p.difficulty = 'Hard' THEN 1 END) as hard_solved,
       COUNT(*) as total_solved,
       MIN(ups.best_runtime) as fastest_runtime
     FROM user_problem_stats ups
     JOIN problems p ON ups.problem_id = p.id
     WHERE ups.user_id = $1 AND ups.is_solved = true`,
    [userId]
  );

  // Total problems in DB by difficulty
  const totalProblemsResult = await pool.query(
    `SELECT 
       COUNT(CASE WHEN difficulty = 'Easy' THEN 1 END) as total_easy,
       COUNT(CASE WHEN difficulty = 'Medium' THEN 1 END) as total_medium,
       COUNT(CASE WHEN difficulty = 'Hard' THEN 1 END) as total_hard,
       COUNT(*) as total_problems
     FROM problems`
  );

  // 2. Total submissions
  const submissionsResult = await pool.query(
    'SELECT COUNT(*) as total_submissions FROM submissions WHERE user_id = $1',
    [userId]
  );

  // 3. Acceptance rate
  const acceptanceResult = await pool.query(
    `SELECT 
       COUNT(CASE WHEN status = 'Accepted' THEN 1 END)::float / NULLIF(COUNT(*), 0)::float * 100 as acceptance_rate
     FROM submissions 
     WHERE user_id = $1`,
    [userId]
  );

  // 4. User profile & duel data
  const userResult = await pool.query(
    `SELECT username, email, COALESCE(rating, 1200) as rating, COALESCE(duels_won, 0) as duels_won, COALESCE(duels_lost, 0) as duels_lost
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  // 5. Recent Activity
  const recentActivity = await pool.query(
    `SELECT s.id, s.status, s.runtime, s.memory, s.created_at, p.title, p.slug, p.difficulty
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [userId]
  );

  // 6. Skill Radar Breakdown across 6 pillars
  const solvedTagsResult = await pool.query(
    `SELECT p.tags
     FROM user_problem_stats ups
     JOIN problems p ON ups.problem_id = p.id
     WHERE ups.user_id = $1 AND ups.is_solved = true`,
    [userId]
  );

  const pillars = {
    'Dynamic Programming': { count: 0, target: 8 },
    'Data Structures': { count: 0, target: 15 },
    'Strings & Text': { count: 0, target: 10 },
    'Two Pointers & Search': { count: 0, target: 10 },
    'Math & Logic': { count: 0, target: 8 },
    'Greedy & Sorting': { count: 0, target: 8 },
  };

  solvedTagsResult.rows.forEach((row: any) => {
    const tags: string[] = row.tags || [];
    tags.forEach((t) => {
      const lower = t.toLowerCase();
      if (lower.includes('dynamic') || lower.includes('recursion')) {
        pillars['Dynamic Programming'].count++;
      }
      if (lower.includes('array') || lower.includes('hash') || lower.includes('stack') || lower.includes('linked') || lower.includes('matrix')) {
        pillars['Data Structures'].count++;
      }
      if (lower.includes('string') || lower.includes('backtracking')) {
        pillars['Strings & Text'].count++;
      }
      if (lower.includes('pointer') || lower.includes('binary search') || lower.includes('divide')) {
        pillars['Two Pointers & Search'].count++;
      }
      if (lower.includes('math') || lower.includes('bit')) {
        pillars['Math & Logic'].count++;
      }
      if (lower.includes('greedy') || lower.includes('sort')) {
        pillars['Greedy & Sorting'].count++;
      }
    });
  });

  const skillRadar = Object.entries(pillars).map(([pillar, val]) => ({
    skill: pillar,
    score: Math.min(100, Math.round((val.count / val.target) * 100)),
    solved: val.count,
  }));

  // 7. Submission Calendar Heatmap (Last 365 Days)
  const calendarResult = await pool.query(
    `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
     FROM submissions
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '365 days'
     GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
     ORDER BY date ASC`,
    [userId]
  );

  // Compute Streaks
  const activeDates = new Set(calendarResult.rows.map((r: any) => r.date));
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    if (activeDates.has(dateStr)) {
      tempStreak++;
      if (i === 0 || i === 1) {
        currentStreak = tempStreak;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i <= 1 && currentStreak === 0) {
        // Today or yesterday didn't have submissions yet
      }
      tempStreak = 0;
    }
  }

  // 8. RPG Badges Evaluation
  const totalSolved = parseInt(solvedStats.rows[0]?.total_solved || 0);
  const totalSubs = parseInt(submissionsResult.rows[0]?.total_submissions || 0);
  const fastestRuntime = solvedStats.rows[0]?.fastest_runtime;
  const userRow = userResult.rows[0] || {};
  const duelsWon = parseInt(userRow.duels_won || 0);
  const rating = parseInt(userRow.rating || 1200);

  const badges = [
    {
      id: 'first_blood',
      name: 'First Blood',
      description: 'Solved your first algorithmic problem',
      icon: '🎯',
      tier: 'Bronze',
      unlocked: totalSolved >= 1,
    },
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Achieved an execution runtime under 10ms',
      icon: '⚡',
      tier: 'Gold',
      unlocked: fastestRuntime !== null && fastestRuntime !== undefined && fastestRuntime <= 10,
    },
    {
      id: 'dp_sorcerer',
      name: 'DP Sorcerer',
      description: 'Conquered 2+ Dynamic Programming challenges',
      icon: '🧙‍♂️',
      tier: 'Diamond',
      unlocked: pillars['Dynamic Programming'].count >= 2,
    },
    {
      id: 'arena_gladiator',
      name: 'Arena Gladiator',
      description: 'Claimed victory in a live 1v1 speed duel',
      icon: '⚔️',
      tier: 'Silver',
      unlocked: duelsWon >= 1,
    },
    {
      id: 'centurion',
      name: 'Code Centurion',
      description: 'Submitted 10+ code executions to the judge',
      icon: '💎',
      tier: 'Gold',
      unlocked: totalSubs >= 10,
    },
    {
      id: 'elo_master',
      name: 'Grandmaster',
      description: 'Achieved an Arena Elo rating above 1220',
      icon: '👑',
      tier: 'Master',
      unlocked: rating >= 1220,
    },
    {
      id: 'streak_flame',
      name: 'Streak Flame',
      description: 'Maintained a multi-day coding streak',
      icon: '🔥',
      tier: 'Silver',
      unlocked: longestStreak >= 2,
    },
  ];

  res.json({
    status: 'success',
    data: {
      user: {
        ...userRow,
        rating,
        duels_won: duelsWon,
        duels_lost: parseInt(userRow.duels_lost || 0),
      },
      stats: {
        total_solved: totalSolved,
        easy_solved: parseInt(solvedStats.rows[0]?.easy_solved || 0),
        medium_solved: parseInt(solvedStats.rows[0]?.medium_solved || 0),
        hard_solved: parseInt(solvedStats.rows[0]?.hard_solved || 0),
        total_submissions: totalSubs,
        acceptance_rate: parseFloat(acceptanceResult.rows[0]?.acceptance_rate || 0).toFixed(1),
        fastest_runtime: fastestRuntime !== null ? `${fastestRuntime}ms` : 'N/A',
      },
      totals: totalProblemsResult.rows[0] || {
        total_easy: 20,
        total_medium: 20,
        total_hard: 10,
        total_problems: 50,
      },
      skillRadar,
      calendar: calendarResult.rows,
      streak: {
        currentStreak,
        longestStreak,
      },
      badges,
      recentActivity: recentActivity.rows,
    },
  });
};

export const getLeaderboard = async (req: any, res: Response) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT 
       u.id,
       u.username,
       COALESCE(u.rating, 1200) as rating,
       COUNT(DISTINCT ups.problem_id) as problems_solved,
       COUNT(s.id) as total_submissions,
       COUNT(CASE WHEN s.status = 'Accepted' THEN 1 END)::float / NULLIF(COUNT(s.id), 0)::float * 100 as acceptance_rate
     FROM users u
     LEFT JOIN user_problem_stats ups ON u.id = ups.user_id AND ups.is_solved = true
     LEFT JOIN submissions s ON u.id = s.user_id
     GROUP BY u.id, u.username, u.rating
     ORDER BY problems_solved DESC, rating DESC, acceptance_rate DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  res.json({
    status: 'success',
    data: {
      leaderboard: result.rows,
    },
  });
};
