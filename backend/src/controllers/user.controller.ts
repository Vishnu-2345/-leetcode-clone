import { Response } from 'express';
import { pool } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export const getUserStats = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  // Get solved problems count by difficulty
  const solvedStats = await pool.query(
    `SELECT 
       COUNT(CASE WHEN p.difficulty = 'Easy' THEN 1 END) as easy_solved,
       COUNT(CASE WHEN p.difficulty = 'Medium' THEN 1 END) as medium_solved,
       COUNT(CASE WHEN p.difficulty = 'Hard' THEN 1 END) as hard_solved,
       COUNT(*) as total_solved
     FROM user_problem_stats ups
     JOIN problems p ON ups.problem_id = p.id
     WHERE ups.user_id = $1 AND ups.is_solved = true`,
    [userId]
  );

  // Get total submissions
  const submissionsResult = await pool.query(
    'SELECT COUNT(*) as total_submissions FROM submissions WHERE user_id = $1',
    [userId]
  );

  // Get acceptance rate
  const acceptanceResult = await pool.query(
    `SELECT 
       COUNT(CASE WHEN status = 'Accepted' THEN 1 END)::float / COUNT(*)::float * 100 as acceptance_rate
     FROM submissions 
     WHERE user_id = $1`,
    [userId]
  );

  // Get recent activity
  const recentActivity = await pool.query(
    `SELECT s.id, s.status, s.created_at, p.title, p.slug, p.difficulty
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [userId]
  );

  res.json({
    status: 'success',
    data: {
      stats: {
        ...solvedStats.rows[0],
        total_submissions: parseInt(submissionsResult.rows[0].total_submissions),
        acceptance_rate: parseFloat(acceptanceResult.rows[0].acceptance_rate || 0).toFixed(2),
      },
      recentActivity: recentActivity.rows,
    },
  });
};

export const getLeaderboard = async (req: Request, res: Response) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT 
       u.id,
       u.username,
       COUNT(DISTINCT ups.problem_id) as problems_solved,
       COUNT(s.id) as total_submissions,
       COUNT(CASE WHEN s.status = 'Accepted' THEN 1 END)::float / NULLIF(COUNT(s.id), 0)::float * 100 as acceptance_rate
     FROM users u
     LEFT JOIN user_problem_stats ups ON u.id = ups.user_id AND ups.is_solved = true
     LEFT JOIN submissions s ON u.id = s.user_id
     GROUP BY u.id, u.username
     ORDER BY problems_solved DESC, acceptance_rate DESC
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
