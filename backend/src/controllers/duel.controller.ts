import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export const getDuelsLeaderboard = async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT 
       id, 
       username, 
       COALESCE(rating, 1200) as rating, 
       COALESCE(duels_won, 0) as duels_won, 
       COALESCE(duels_lost, 0) as duels_lost,
       CASE 
         WHEN (COALESCE(duels_won, 0) + COALESCE(duels_lost, 0)) > 0 
         THEN ROUND((COALESCE(duels_won, 0)::numeric / (COALESCE(duels_won, 0) + COALESCE(duels_lost, 0))::numeric) * 100, 1)
         ELSE 0.0
       END as win_rate
     FROM users
     ORDER BY rating DESC, duels_won DESC
     LIMIT 30`
  );

  res.json({
    status: 'success',
    data: {
      leaderboard: result.rows,
    },
  });
};

export const getUserDuelStats = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const userResult = await pool.query(
    `SELECT id, username, rating, duels_won, duels_lost FROM users WHERE id = $1`,
    [userId]
  );

  const historyResult = await pool.query(
    `SELECT 
       d.id, 
       d.room_id, 
       d.status, 
       d.created_at, 
       d.finished_at,
       p.title as problem_title,
       w.username as winner_name,
       p1.username as player1_name,
       p2.username as player2_name
     FROM duels d
     JOIN problems p ON d.problem_id = p.id
     JOIN users p1 ON d.player1_id = p1.id
     JOIN users p2 ON d.player2_id = p2.id
     LEFT JOIN users w ON d.winner_id = w.id
     WHERE d.player1_id = $1 OR d.player2_id = $1
     ORDER BY d.created_at DESC
     LIMIT 10`,
    [userId]
  );

  res.json({
    status: 'success',
    data: {
      stats: userResult.rows[0] || { rating: 1200, duels_won: 0, duels_lost: 0 },
      recentDuels: historyResult.rows,
    },
  });
};

