import { Router } from 'express';
import { getUserStats, getLeaderboard } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:userId/stats', authenticate, getUserStats);
router.get('/leaderboard', getLeaderboard);

export default router;
