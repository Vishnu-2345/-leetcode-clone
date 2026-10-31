import { Router } from 'express';
import { getUserStats, getLeaderboard } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/leaderboard', getLeaderboard);
router.get('/:userId/stats', authenticate, getUserStats);

export default router;
